"""Read-only smoke on the published URL. Signs in with the demo one-tap buttons (no bookings are created)."""
import sys, re, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1].rstrip('/')
res = []
def vis(loc, t=10000):
    try:
        loc.first.wait_for(timeout=t)
        return True
    except Exception:
        return False

def ck(n, ok, d=''):
    res.append(ok); print('PASS' if ok else 'FAIL', n, d, flush=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (375, 1440):
        ctx = b.new_context(viewport={'width': w, 'height': 900}); pg = ctx.new_page()
        pg.on('pageerror', lambda e, w=w: errors.append(f'{w}:{e}'))
        pg.on('console', lambda m, w=w: errors.append(f'{w}:{m.text}') if m.type == 'error' else None)
        r = pg.goto(BASE + '/', wait_until='networkidle')
        ck(f'{w}px home 200', r.status == 200)
        ck(f'{w}px home has h1', pg.locator('h1').count() == 1)
        ck(f'{w}px home no horizontal scroll', pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1"))
        pg.goto(BASE + '/departures', wait_until='networkidle')
        ck(f'{w}px departures lists open dates', vis(pg.get_by_text(' left').locator('visible=true')) or vis(pg.get_by_text('seats left')))
        ck(f'{w}px departures no horizontal scroll', pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1"))
        pg.goto(BASE + '/login', wait_until='networkidle')
        pg.get_by_role('button', name='Client', exact=True).click()
        pg.wait_for_url(re.compile(r'/trips$'), timeout=15000)
        ck(f'{w}px demo client sees TB-DEMO01', vis(pg.get_by_text('TB-DEMO01')))
        pg.goto(BASE + '/trips/TB-DEMO01', wait_until='networkidle')
        ck(f'{w}px trip page permit checklist', vis(pg.get_by_text('Permit checklist')))
        pg.get_by_role('button', name='Sign out').click(); pg.wait_for_timeout(600)
        pg.goto(BASE + '/login', wait_until='networkidle')
        pg.get_by_role('button', name='Staff', exact=True).click()
        pg.wait_for_url(re.compile(r'/staff$'), timeout=15000)
        ck(f'{w}px staff operations table', vis(pg.get_by_role('table')))
        pg.get_by_role('button', name='Sign out').click(); pg.wait_for_timeout(600)
        pg.goto(BASE + '/login', wait_until='networkidle')
        pg.get_by_role('button', name='Admin', exact=True).click()
        pg.wait_for_url(re.compile(r'/admin$'), timeout=15000)
        ck(f'{w}px admin overview and log', vis(pg.get_by_text('Activity log')))
        ctx.close()
    b.close()
ck('no console or page errors', not errors, '; '.join(errors[:4]))
print(f'SMOKE {sum(res)} of {len(res)} pass')
sys.exit(0 if all(res) and not errors else 1)
