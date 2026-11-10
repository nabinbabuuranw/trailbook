import sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1].rstrip('/'); AXE = '/tmp/axe/node_modules/axe-core/axe.min.js'
pages = [('home','/'),('departures','/departures'),('departure-detail','/departures/2'),('login','/login'),('register','/register'),('terms','/terms')]
out = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (375, 1440):
        ctx = b.new_context(viewport={'width': w, 'height': 900}, bypass_csp=True); pg = ctx.new_page()
        for name, path in pages:
            pg.goto(BASE + path, wait_until='networkidle'); pg.wait_for_selector('h1')
            pg.add_script_tag(path=AXE)
            r = pg.evaluate("async () => { const res = await axe.run(document, {resultTypes:['violations']}); return res.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, help:v.help})); }")
            out[f'{w}:{name}'] = r
        ctx.close()
    # Logged-in pages (demo client and staff) via one-tap sign-in.
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, bypass_csp=True); pg = ctx.new_page()
    pg.goto(BASE + '/login', wait_until='networkidle'); pg.get_by_role('button', name='Client', exact=True).click(); pg.wait_for_url('**/trips')
    pg.wait_for_selector('text=TB-DEMO01'); pg.goto(BASE + '/trips/TB-DEMO01', wait_until='networkidle'); pg.wait_for_selector('text=Permit checklist')
    pg.add_script_tag(path=AXE)
    out['1440:trip-detail'] = pg.evaluate("async () => { const res = await axe.run(document, {resultTypes:['violations']}); return res.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, help:v.help})); }")
    ctx.close()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, bypass_csp=True); pg = ctx.new_page()
    pg.goto(BASE + '/login', wait_until='networkidle'); pg.get_by_role('button', name='Staff', exact=True).click(); pg.wait_for_url('**/staff')
    pg.wait_for_selector('table'); pg.goto(BASE + '/staff/departures/1', wait_until='networkidle'); pg.wait_for_selector('text=Permit checklist')
    pg.add_script_tag(path=AXE)
    out['1440:staff-departure'] = pg.evaluate("async () => { const res = await axe.run(document, {resultTypes:['violations']}); return res.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, help:v.help})); }")
    b.close()
json.dump(out, open(sys.argv[2], 'w'), indent=1)
total = 0
for k, v in out.items():
    total += len(v)
    print(k, 'violations:', len(v), [f"{x['id']}({x['impact']},{x['n']})" for x in v])
print('TOTAL_RULE_VIOLATIONS', total)
