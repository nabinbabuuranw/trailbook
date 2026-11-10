"""Browser QA for Trailbook (Day 8). Runs real Chromium against the local harness.
Usage: python3 qa/browser_qa.py http://localhost:8795 <out_dir>
Prints one line per check. Exit code 1 if any check fails."""
import sys, json, os, re
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://localhost:8795'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'qa/screenshots'
os.makedirs(OUT, exist_ok=True)
WIDTHS = [375, 768, 1024, 1440]
results = []
console_errors = []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS' if ok else 'FAIL'), name, detail, flush=True)

def no_overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)

PAGES = [
    ('home', '/'), ('departures', '/departures'), ('departure-detail', '/departures/1'),
    ('login', '/login'), ('terms', '/terms'), ('privacy', '/privacy'), ('not-found', '/nothing-here'),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    # 1. Public pages at four widths: no horizontal scroll, an h1, no console errors.
    for w in WIDTHS:
        ctx = browser.new_context(viewport={'width': w, 'height': 900}, device_scale_factor=1)
        page = ctx.new_page()
        page.on('console', lambda m, w=w: console_errors.append(f'{w}:{m.text}') if m.type == 'error' and 'status of 404' not in m.text else None)
        page.on('pageerror', lambda e, w=w: console_errors.append(f'{w}:pageerror:{e}'))
        # Any failed asset or API call is an error, except the deliberate unknown page used for the 404 check.
        page.on('response', lambda r, w=w: console_errors.append(f'{w}:{r.status} {r.url}') if r.status >= 400 and '/nothing-here' not in r.url else None)
        for name, path in PAGES:
            page.goto(BASE + path, wait_until='networkidle')
            page.wait_for_selector('h1', timeout=8000)
            check(f'{w}px {name} renders an h1', page.locator('h1').count() >= 1)
            check(f'{w}px {name} no horizontal scroll', no_overflow(page))
            if name in ('home', 'departures', 'departure-detail', 'login', 'terms'):
                shot(page, f'{w}-{name}')
        ctx.close()

    # 2. Flows at 375 (phone) and 1440 (desktop).
    for w in (375, 1440):
        ctx = browser.new_context(viewport={'width': w, 'height': 900})
        page = ctx.new_page()
        page.on('pageerror', lambda e, w=w: console_errors.append(f'{w}:pageerror:{e}'))
        page.on('response', lambda r, w=w: console_errors.append(f'{w}:{r.status} {r.url}') if r.status >= 400 and '/nothing-here' not in r.url and not (r.status == 403 and False) else None)
        # Demo client one-tap sign-in.
        page.goto(BASE + '/login', wait_until='networkidle')
        page.get_by_role('button', name='Client', exact=True).click()
        page.wait_for_url(re.compile(r'/trips$'), timeout=8000)
        check(f'{w}px demo client lands on My trips', page.get_by_role('heading', name='My trips').is_visible())
        check(f'{w}px demo booking TB-DEMO01 is listed', page.get_by_text('TB-DEMO01').first.is_visible())
        shot(page, f'{w}-trips')
        # Open the demo trip; check the permit disclaimer and tick a document.
        page.goto(BASE + '/trips/TB-DEMO01', wait_until='networkidle')
        page.wait_for_selector('text=Permit checklist', timeout=8000)
        check(f'{w}px trip shows permit disclaimer', page.get_by_text('not government approvals').first.is_visible())
        box = page.get_by_label('Passport valid for the whole trip')
        box.check()
        page.reload(wait_until='networkidle')
        page.wait_for_selector('text=Documents to bring', timeout=8000)
        check(f'{w}px document tick survives reload', page.get_by_label('Passport valid for the whole trip').is_checked())
        shot(page, f'{w}-trip-detail')
        # Book seats on an open departure as the same client.
        page.goto(BASE + '/departures/3', wait_until='networkidle')
        page.get_by_label('Mobile number').fill('9800000011')
        page.get_by_label('Lead traveller name').fill('Demo Client')
        page.get_by_role('button', name='Request seats').click()
        ok = page.get_by_text('Seats requested').first
        ok.wait_for(timeout=8000)
        check(f'{w}px booking success state shows reference', ok.is_visible())
        shot(page, f'{w}-booking-success')
        # Bad phone is refused on the client before a request.
        page.goto(BASE + '/departures/2', wait_until='networkidle')
        page.get_by_label('Mobile number').fill('12345')
        page.get_by_label('Lead traveller name').fill('Demo Client')
        page.get_by_role('button', name='Request seats').click()
        check(f'{w}px bad mobile shows an error', page.get_by_text('Enter a Nepal mobile number').first.is_visible())
        # Client cannot reach staff pages: sees "Not for this account".
        page.goto(BASE + '/staff', wait_until='networkidle')
        check(f'{w}px client sees role refusal on /staff', page.get_by_text('Not for this account').first.is_visible())
        # Sign out, then anonymous /trips asks to sign in.
        page.get_by_role('button', name='Sign out').click()
        page.wait_for_timeout(500)
        page.goto(BASE + '/trips', wait_until='networkidle')
        check(f'{w}px anonymous /trips asks to sign in', page.get_by_text('Sign in to continue').first.is_visible())
        # Staff: confirm the new request on the first departure.
        page.goto(BASE + '/login', wait_until='networkidle')
        page.get_by_role('button', name='Staff', exact=True).click()
        page.wait_for_url(re.compile(r'/staff$'), timeout=8000)
        check(f'{w}px staff lands on operations', page.get_by_role('heading', name='Departures to run').is_visible())
        shot(page, f'{w}-staff')
        page.goto(BASE + '/staff/departures/3', wait_until='networkidle')
        page.wait_for_selector('text=Passengers and requests', timeout=8000)
        confirm = page.get_by_role('button', name='Confirm').first
        if confirm.count():
            confirm.click()
            page.wait_for_timeout(800)
            check(f'{w}px staff confirms a request', page.get_by_text('Confirmed.').first.is_visible())
        shot(page, f'{w}-staff-departure')
        # Permit item change by staff (select).
        page.locator('select[id^="st-restricted"]').select_option('checking') if page.locator('select[id^="st-restricted"]').count() else None
        check(f'{w}px staff sees permit selects', page.locator('select[id^="st-"]').count() >= 5)
        page.get_by_role('button', name='Sign out').click()
        page.wait_for_timeout(400)
        # Admin: roles page and audit log.
        page.goto(BASE + '/login', wait_until='networkidle')
        page.get_by_role('button', name='Admin', exact=True).click()
        page.wait_for_url(re.compile(r'/admin$'), timeout=8000)
        page.wait_for_selector('text=People and roles', timeout=8000)
        check(f'{w}px admin sees the activity log', page.get_by_text('Activity log').first.is_visible())
        check(f'{w}px admin dashboard shows payments taken 0', page.get_by_text('NPR 0').first.is_visible())
        shot(page, f'{w}-admin')
        ctx.close()

    browser.close()

check('no console errors or page errors across all runs', not console_errors, '; '.join(console_errors[:5]))
failed = [r for r in results if not r[1]]
print(f'SUMMARY {len(results) - len(failed)} of {len(results)} checks pass')
json.dump([{'check': n, 'ok': o, 'detail': d} for n, o, d in results], open(os.path.join(OUT, '..', 'browser_checks.json'), 'w'), indent=1)
sys.exit(1 if failed else 0)
