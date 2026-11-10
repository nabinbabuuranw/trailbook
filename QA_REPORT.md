# QA_REPORT.md: Trailbook, Day 8

Date: 2026-11-10 (Nepal). Machine: the Tab box (Linux, Node 22.23.3, Chromium from Playwright for Python). Every block below is the real output of the command shown, saved under `qa/`.

Summary

| Check | Command | Result |
|---|---|---|
| Type check (client and Worker) | `npm run typecheck` | exit 0 |
| Unit and API tests | `npm test` | 66 of 66 pass (46 API, 20 rules) |
| Production build | `npm run build` | builds; Worker 44,397 bytes |
| Browser flows and layout, local | `python3 qa/browser_qa.py http://localhost:8795 screenshots/` | 83 of 83 checks pass |
| Accessibility, axe-core 4.10.2, 14 page states | `python3 qa/axe_run.py http://localhost:8795 qa/axe-results.json` | 0 violations |
| Live URL, read-only smoke | `python3 qa/live_smoke.py https://trailbook.sites.tab.bot` | 19 of 19 pass |
| Live HTTP status | `curl` per path (below) | 200 for pages and API; 404 for unknown pages and missing files |

## 1. Type check and tests

Command: `npm run typecheck && npm test` (output in `qa/npm-test-output.txt`).

```

> trailbook@1.0.0 typecheck
> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.api.json --noEmit

TYPECHECK_EXIT=0

> trailbook@1.0.0 test
> node --test --experimental-strip-types api/test/*.test.ts shared/test/*.test.ts

TAP version 13
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:1923406) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# {"t":"2026-11-10T05:05:42.249Z","svc":"trailbook","event":"request","method":"GET","path":"/api/health","status":200,"ms":42}
# Subtest: security headers and public catalogue
    # Subtest: API responses carry CSP, nosniff, frame and no-store headers
    ok 1 - API responses carry CSP, nosniff, frame and no-store headers
      ---
      duration_ms: 58.758812
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.291Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":40}
    # Subtest: public list shows only open, future departures with seats left
    ok 2 - public list shows only open, future departures with seats left
      ---
      duration_ms: 40.484288
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.345Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:42.346Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":54}
# {"t":"2026-11-10T05:05:42.347Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":201,"ms":1}
# {"t":"2026-11-10T05:05:42.348Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures/5","status":404,"ms":0}
# {"t":"2026-11-10T05:05:42.349Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
    # Subtest: a draft departure is not visible to the public
    ok 3 - a draft departure is not visible to the public
      ---
      duration_ms: 57.607798
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.389Z","svc":"trailbook","event":"request","method":"GET","path":"/api/nope","status":404,"ms":39}
# {"t":"2026-11-10T05:05:42.389Z","svc":"trailbook","event":"request","method":"GET","path":"/api/auth/login","status":405,"ms":0}
    # Subtest: unknown API route is 404 JSON, wrong method is 405
    ok 4 - unknown API route is 404 JSON, wrong method is 405
      ---
      duration_ms: 40.210363
      type: 'test'
      ...
    1..4
ok 1 - security headers and public catalogue
  ---
  duration_ms: 197.85941
  type: 'suite'
  ...
# {"t":"2026-11-10T05:05:42.429Z","svc":"trailbook","event":"request","method":"GET","path":"/api/health","status":200,"ms":39}
# Subtest: authentication
    # Subtest: passwords are stored as PBKDF2-SHA256 hashes, never in plain text
    ok 1 - passwords are stored as PBKDF2-SHA256 hashes, never in plain text
      ---
      duration_ms: 39.670419
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.482Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:42.482Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":52}
    # Subtest: register creates a client session and ignores any role sent by the browser
    ok 2 - register creates a client session and ignores any role sent by the browser
      ---
      duration_ms: 52.672859
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.521Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":400,"ms":38}
# {"t":"2026-11-10T05:05:42.522Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":400,"ms":0}
# {"t":"2026-11-10T05:05:42.522Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":400,"ms":0}
    # Subtest: register refuses weak passwords and bad emails
    ok 3 - register refuses weak passwords and bad emails
      ---
      duration_ms: 40.272363
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.562Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":409,"ms":39}
    # Subtest: a duplicate email is refused
    ok 4 - a duplicate email is refused
      ---
      duration_ms: 39.401906
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.614Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.614Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":51}
# {"t":"2026-11-10T05:05:42.616Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.617Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":2}
    # Subtest: wrong password and unknown email give the same answer
    ok 5 - wrong password and unknown email give the same answer
      ---
      duration_ms: 54.574862
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.669Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.669Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":52}
# {"t":"2026-11-10T05:05:42.682Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.682Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
# {"t":"2026-11-10T05:05:42.695Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.695Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
# {"t":"2026-11-10T05:05:42.709Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.709Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":14}
# {"t":"2026-11-10T05:05:42.722Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.722Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
# {"t":"2026-11-10T05:05:42.735Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.735Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
# {"t":"2026-11-10T05:05:42.748Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.748Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
# {"t":"2026-11-10T05:05:42.761Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.761Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
# {"t":"2026-11-10T05:05:42.762Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":429,"ms":1}
    # Subtest: login is rate limited per account
    ok 6 - login is rate limited per account
      ---
      duration_ms: 145.127181
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.814Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:42.814Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:42.814Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":200,"ms":0}
# {"t":"2026-11-10T05:05:42.815Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/logout","status":200,"ms":0}
# {"t":"2026-11-10T05:05:42.815Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":401,"ms":0}
    # Subtest: logout ends the session on the server
    ok 7 - logout ends the session on the server
      ---
      duration_ms: 53.602491
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.854Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/demo","status":404,"ms":38}
# {"t":"2026-11-10T05:05:42.893Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/demo","status":200,"ms":38}
    # Subtest: demo one-tap sign-in can be switched off
    ok 8 - demo one-tap sign-in can be switched off
      ---
      duration_ms: 77.947675
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:42.945Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:42.945Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:42.959Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:42.959Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:42.960Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/users","status":200,"ms":1}
# {"t":"2026-11-10T05:05:42.961Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/admin/users/1/suspended","status":200,"ms":1}
# {"t":"2026-11-10T05:05:42.961Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":401,"ms":0}
# {"t":"2026-11-10T05:05:42.974Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:42.974Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":13}
    # Subtest: a suspended user loses their session at once
    ok 9 - a suspended user loses their session at once
      ---
      duration_ms: 80.943086
      type: 'test'
      ...
    1..9
ok 2 - authentication
  ---
  duration_ms: 584.805941
  type: 'suite'
  ...
# {"t":"2026-11-10T05:05:43.014Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":39}
# {"t":"2026-11-10T05:05:43.014Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":401,"ms":0}
# Subtest: authorization (server-side RBAC)
    # Subtest: unauthenticated booking is rejected
    ok 1 - unauthenticated booking is rejected
      ---
      duration_ms: 39.7944
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.054Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/overview","status":401,"ms":39}
# {"t":"2026-11-10T05:05:43.054Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/users","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.054Z","svc":"trailbook","event":"request","method":"GET","path":"/api/staff/departures","status":401,"ms":0}
    # Subtest: unauthenticated admin request is rejected
    ok 2 - unauthenticated admin request is rejected
      ---
      duration_ms: 39.765845
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.106Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.106Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:43.107Z","svc":"trailbook","event":"request","method":"GET","path":"/api/staff/departures","status":403,"ms":1}
# {"t":"2026-11-10T05:05:43.107Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/overview","status":403,"ms":0}
# {"t":"2026-11-10T05:05:43.107Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/users","status":403,"ms":0}
# {"t":"2026-11-10T05:05:43.108Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/admin/users/1/role","status":403,"ms":0}
    # Subtest: a client cannot reach staff or admin routes (role escalation refused)
    ok 3 - a client cannot reach staff or admin routes (role escalation refused)
      ---
      duration_ms: 53.736953
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.160Z","svc":"trailbook","event":"auth.login","user":2}
# {"t":"2026-11-10T05:05:43.160Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:43.160Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":403,"ms":0}
# {"t":"2026-11-10T05:05:43.161Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/admin/users/2/role","status":403,"ms":0}
    # Subtest: staff cannot change user roles or create departures
    ok 4 - staff cannot change user roles or create departures
      ---
      duration_ms: 52.859549
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.213Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.213Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:43.213Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":200,"ms":0}
# {"t":"2026-11-10T05:05:43.227Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:43.227Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:43.240Z","svc":"trailbook","event":"auth.login","user":4}
# {"t":"2026-11-10T05:05:43.240Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:43.241Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings/TB-…","status":404,"ms":1}
# {"t":"2026-11-10T05:05:43.241Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings/TB-…","status":200,"ms":0}
    # Subtest: a client cannot read another person’s booking
    ok 5 - a client cannot read another person’s booking
      ---
      duration_ms: 80.255253
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.293Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:43.293Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:43.294Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/admin/users/3/role","status":409,"ms":0}
# {"t":"2026-11-10T05:05:43.294Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/admin/users/3/suspended","status":409,"ms":0}
    # Subtest: an admin cannot change their own role or suspend themselves
    ok 6 - an admin cannot change their own role or suspend themselves
      ---
      duration_ms: 53.022589
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.347Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:43.347Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:43.360Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:43.361Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:43.374Z","svc":"trailbook","event":"auth.login","user":4}
# {"t":"2026-11-10T05:05:43.374Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:43.375Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/admin/users/4/role","status":200,"ms":1}
# {"t":"2026-11-10T05:05:43.375Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.375Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/audit","status":200,"ms":0}
    # Subtest: admin role change is audited and clears that user’s sessions
    ok 7 - admin role change is audited and clears that user’s sessions
      ---
      duration_ms: 81.239501
      type: 'test'
      ...
    1..7
ok 3 - authorization (server-side RBAC)
  ---
  duration_ms: 401.020561
  type: 'suite'
  ...
# {"t":"2026-11-10T05:05:43.415Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":403,"ms":39}
# Subtest: CSRF and request safety
    # Subtest: a mutating request without the protection header is refused
    ok 1 - a mutating request without the protection header is refused
      ---
      duration_ms: 39.088744
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.454Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":403,"ms":39}
    # Subtest: a request from another origin is refused
    ok 2 - a request from another origin is refused
      ---
      duration_ms: 38.91172
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.508Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.508Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":54}
# {"t":"2026-11-10T05:05:43.508Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:43.508Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":403,"ms":0}
    # Subtest: a signed-in write needs the session CSRF token
    ok 3 - a signed-in write needs the session CSRF token
      ---
      duration_ms: 54.740831
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.560Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.560Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:43.561Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":1}
# {"t":"2026-11-10T05:05:43.561Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":400,"ms":0}
# {"t":"2026-11-10T05:05:43.562Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":400,"ms":1}
# {"t":"2026-11-10T05:05:43.562Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":400,"ms":0}
# {"t":"2026-11-10T05:05:43.563Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":400,"ms":1}
# {"t":"2026-11-10T05:05:43.564Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":400,"ms":1}
# {"t":"2026-11-10T05:05:43.564Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":400,"ms":0}
    # Subtest: bad input is refused with field names, not a crash
    ok 4 - bad input is refused with field names, not a crash
      ---
      duration_ms: 55.536106
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.603Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":400,"ms":39}
# {"t":"2026-11-10T05:05:43.603Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":415,"ms":0}
# {"t":"2026-11-10T05:05:43.604Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":413,"ms":0}
    # Subtest: malformed JSON, wrong content type and oversize bodies are refused
    ok 5 - malformed JSON, wrong content type and oversize bodies are refused
      ---
      duration_ms: 39.619205
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.643Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.643Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":39}
# {"t":"2026-11-10T05:05:43.643Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.643Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.644Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.644Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.644Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.644Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.645Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.645Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.645Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.645Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.646Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.646Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":1}
# {"t":"2026-11-10T05:05:43.646Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.646Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.647Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.647Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":1}
# {"t":"2026-11-10T05:05:43.647Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.647Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.648Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.648Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.648Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.648Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.649Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.649Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.649Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.649Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.650Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.650Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":1}
# {"t":"2026-11-10T05:05:43.650Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.650Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.651Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.651Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.651Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.651Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.652Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.652Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":0}
# {"t":"2026-11-10T05:05:43.652Z","svc":"trailbook","event":"auth.login_failed"}
# {"t":"2026-11-10T05:05:43.653Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":401,"ms":1}
# {"t":"2026-11-10T05:05:43.653Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":429,"ms":0}
    # Subtest: a rate-limited IP is held even with correct credentials
    ok 6 - a rate-limited IP is held even with correct credentials
      ---
      duration_ms: 49.048818
      type: 'test'
      ...
    1..6
ok 4 - CSRF and request safety
  ---
  duration_ms: 277.267886
  type: 'suite'
  ...
# {"t":"2026-11-10T05:05:43.707Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.707Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":54}
# {"t":"2026-11-10T05:05:43.707Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:43.708Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures/1","status":200,"ms":1}
# {"t":"2026-11-10T05:05:43.708Z","svc":"trailbook","event":"booking.create","departure":1,"travellers":2}
# {"t":"2026-11-10T05:05:43.708Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":0}
# Subtest: bookings, seats and stock
    # Subtest: a booking is requested at the server price, and any client-sent price is ignored
    ok 1 - a booking is requested at the server price, and any client-sent price is ignored
      ---
      duration_ms: 55.513982
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.761Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.761Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:43.761Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:43.762Z","svc":"trailbook","event":"booking.create","departure":4,"travellers":3}
# {"t":"2026-11-10T05:05:43.762Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":1}
# {"t":"2026-11-10T05:05:43.762Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures/4","status":200,"ms":0}
# {"t":"2026-11-10T05:05:43.763Z","svc":"trailbook","event":"booking.cancel","booking":2}
# {"t":"2026-11-10T05:05:43.763Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings/TB-…/cancel","status":200,"ms":0}
# {"t":"2026-11-10T05:05:43.764Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures/4","status":200,"ms":1}
    # Subtest: a booking holds seats and cancelling releases them (database triggers)
    ok 2 - a booking holds seats and cancelling releases them (database triggers)
      ---
      duration_ms: 54.924372
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.815Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:43.815Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:43.816Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":201,"ms":0}
# {"t":"2026-11-10T05:05:43.829Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:43.829Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:43.830Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":1}
    # Subtest: negative stock is refused: no overbooking and no seat change on refusal
    ok 3 - negative stock is refused: no overbooking and no seat change on refusal
      ---
      duration_ms: 66.556289
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.882Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:43.882Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:43.883Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":201,"ms":1}
# {"t":"2026-11-10T05:05:43.896Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:43.896Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:43.909Z","svc":"trailbook","event":"auth.register","user":5}
# {"t":"2026-11-10T05:05:43.909Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:43.910Z","svc":"trailbook","event":"booking.create","departure":5,"travellers":1}
# {"t":"2026-11-10T05:05:43.910Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":0}
# {"t":"2026-11-10T05:05:43.911Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":1}
    # Subtest: stock race: two buyers for the last seat, exactly one succeeds
    ok 4 - stock race: two buyers for the last seat, exactly one succeeds
      ---
      duration_ms: 81.144951
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:43.963Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:43.963Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:43.964Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":201,"ms":1}
# {"t":"2026-11-10T05:05:43.977Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:43.977Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:43.990Z","svc":"trailbook","event":"auth.register","user":5}
# {"t":"2026-11-10T05:05:43.990Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.003Z","svc":"trailbook","event":"auth.register","user":6}
# {"t":"2026-11-10T05:05:44.004Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.017Z","svc":"trailbook","event":"auth.register","user":7}
# {"t":"2026-11-10T05:05:44.017Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.030Z","svc":"trailbook","event":"auth.register","user":8}
# {"t":"2026-11-10T05:05:44.030Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.043Z","svc":"trailbook","event":"auth.register","user":9}
# {"t":"2026-11-10T05:05:44.043Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.056Z","svc":"trailbook","event":"auth.register","user":10}
# {"t":"2026-11-10T05:05:44.056Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.069Z","svc":"trailbook","event":"auth.register","user":11}
# {"t":"2026-11-10T05:05:44.070Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":14}
# {"t":"2026-11-10T05:05:44.085Z","svc":"trailbook","event":"auth.register","user":12}
# {"t":"2026-11-10T05:05:44.085Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":15}
# {"t":"2026-11-10T05:05:44.099Z","svc":"trailbook","event":"auth.register","user":13}
# {"t":"2026-11-10T05:05:44.099Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":14}
# {"t":"2026-11-10T05:05:44.100Z","svc":"trailbook","event":"booking.create","departure":5,"travellers":1}
# {"t":"2026-11-10T05:05:44.100Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":1}
# {"t":"2026-11-10T05:05:44.101Z","svc":"trailbook","event":"booking.create","departure":5,"travellers":1}
# {"t":"2026-11-10T05:05:44.101Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":2}
# {"t":"2026-11-10T05:05:44.101Z","svc":"trailbook","event":"booking.create","departure":5,"travellers":1}
# {"t":"2026-11-10T05:05:44.101Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":2}
# {"t":"2026-11-10T05:05:44.102Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":3}
# {"t":"2026-11-10T05:05:44.103Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":4}
# {"t":"2026-11-10T05:05:44.103Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":4}
# {"t":"2026-11-10T05:05:44.104Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":5}
# {"t":"2026-11-10T05:05:44.104Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":5}
# {"t":"2026-11-10T05:05:44.105Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":6}
# {"t":"2026-11-10T05:05:44.105Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":409,"ms":6}
    # Subtest: ten buyers for three seats: exactly three bookings, seats end at three
    ok 5 - ten buyers for three seats: exactly three bookings, seats end at three
      ---
      duration_ms: 193.93947
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.157Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.157Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:44.158Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.159Z","svc":"trailbook","event":"booking.create","departure":1,"travellers":1}
# {"t":"2026-11-10T05:05:44.159Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":1}
    # Subtest: a booking writes a history row (requested)
    ok 6 - a booking writes a history row (requested)
      ---
      duration_ms: 53.390816
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.212Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.212Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":53}
# {"t":"2026-11-10T05:05:44.213Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.214Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings/TB-…","status":200,"ms":1}
# {"t":"2026-11-10T05:05:44.227Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.227Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:44.227Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings/TB-…/cancel","status":409,"ms":0}
    # Subtest: client cancellation is refused inside the cancellation window
    ok 7 - client cancellation is refused inside the cancellation window
      ---
      duration_ms: 68.572884
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.280Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.280Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:44.280Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.281Z","svc":"trailbook","event":"booking.create","departure":1,"travellers":1}
# {"t":"2026-11-10T05:05:44.281Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":0}
# {"t":"2026-11-10T05:05:44.294Z","svc":"trailbook","event":"auth.login","user":2}
# {"t":"2026-11-10T05:05:44.295Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":14}
# {"t":"2026-11-10T05:05:44.295Z","svc":"trailbook","event":"request","method":"POST","path":"/api/staff/bookings/TB-…/status","status":409,"ms":0}
# {"t":"2026-11-10T05:05:44.296Z","svc":"trailbook","event":"request","method":"POST","path":"/api/staff/bookings/TB-…/status","status":200,"ms":0}
    # Subtest: staff cannot skip a status: requested to completed is refused
    ok 8 - staff cannot skip a status: requested to completed is refused
      ---
      duration_ms: 68.626726
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.348Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.349Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":53}
# {"t":"2026-11-10T05:05:44.349Z","svc":"trailbook","event":"request","method":"POST","path":"/api/staff/bookings/TB-…/status","status":403,"ms":0}
    # Subtest: a client cannot confirm their own booking
    ok 9 - a client cannot confirm their own booking
      ---
      duration_ms: 53.138603
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.402Z","svc":"trailbook","event":"auth.login","user":2}
# {"t":"2026-11-10T05:05:44.402Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:44.402Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.415Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.416Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":14}
# {"t":"2026-11-10T05:05:44.416Z","svc":"trailbook","event":"booking.create","departure":1,"travellers":1}
# {"t":"2026-11-10T05:05:44.416Z","svc":"trailbook","event":"request","method":"POST","path":"/api/bookings","status":201,"ms":0}
# {"t":"2026-11-10T05:05:44.417Z","svc":"trailbook","event":"request","method":"POST","path":"/api/staff/departures/1/status","status":409,"ms":0}
# {"t":"2026-11-10T05:05:44.418Z","svc":"trailbook","event":"request","method":"POST","path":"/api/staff/bookings/TB-…/status","status":200,"ms":1}
    # Subtest: staff cancellation releases seats; the departure cannot be cancelled while bookings are active
    ok 10 - staff cancellation releases seats; the departure cannot be cancelled while bookings are active
      ---
      duration_ms: 68.435765
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.470Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.470Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:44.471Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/bookings/TB-…/documents","status":200,"ms":1}
# {"t":"2026-11-10T05:05:44.471Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings/TB-…","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.484Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:44.484Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":13}
# {"t":"2026-11-10T05:05:44.497Z","svc":"trailbook","event":"auth.login","user":4}
# {"t":"2026-11-10T05:05:44.498Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:44.498Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/bookings/TB-…/documents","status":404,"ms":0}
    # Subtest: a document checklist tick is saved for the owner only
    ok 11 - a document checklist tick is saved for the owner only
      ---
      duration_ms: 80.344574
      type: 'test'
      ...
    1..11
ok 5 - bookings, seats and stock
  ---
  duration_ms: 845.22044
  type: 'suite'
  ...
# {"t":"2026-11-10T05:05:44.550Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:44.551Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:44.551Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":201,"ms":0}
# {"t":"2026-11-10T05:05:44.564Z","svc":"trailbook","event":"auth.login","user":2}
# {"t":"2026-11-10T05:05:44.564Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:44.565Z","svc":"trailbook","event":"request","method":"POST","path":"/api/staff/departures/5/status","status":409,"ms":0}
# Subtest: departures, crew and permits
    # Subtest: a departure with no price source cannot be opened (unverified price refused)
    ok 1 - a departure with no price source cannot be opened (unverified price refused)
      ---
      duration_ms: 66.952565
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.617Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:44.617Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:44.618Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":409,"ms":1}
    # Subtest: a departure in the past cannot be created as open
    ok 2 - a departure in the past cannot be created as open
      ---
      duration_ms: 52.608717
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.670Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:44.670Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:44.670Z","svc":"trailbook","event":"request","method":"POST","path":"/api/admin/departures","status":400,"ms":0}
    # Subtest: an impossible calendar date is refused
    ok 3 - an impossible calendar date is refused
      ---
      duration_ms: 52.569295
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.722Z","svc":"trailbook","event":"auth.login","user":2}
# {"t":"2026-11-10T05:05:44.723Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":52}
# {"t":"2026-11-10T05:05:44.723Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.724Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/staff/departures/1/permits/restricted","status":200,"ms":1}
# {"t":"2026-11-10T05:05:44.724Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/staff/departures/1/permits/made_up","status":404,"ms":0}
# {"t":"2026-11-10T05:05:44.725Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/staff/departures/1/permits/restricted","status":400,"ms":1}
# {"t":"2026-11-10T05:05:44.725Z","svc":"trailbook","event":"request","method":"GET","path":"/api/staff/departures/1","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.739Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:44.739Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":13}
# {"t":"2026-11-10T05:05:44.739Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/audit","status":200,"ms":0}
    # Subtest: permit items: valid state saved and audited; unknown item and unknown state refused
    ok 4 - permit items: valid state saved and audited; unknown item and unknown state refused
      ---
      duration_ms: 68.738039
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.791Z","svc":"trailbook","event":"auth.login","user":1}
# {"t":"2026-11-10T05:05:44.791Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:44.794Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings/TB-…","status":200,"ms":2}
    # Subtest: the client sees permit states without staff-only fields
    ok 5 - the client sees permit states without staff-only fields
      ---
      duration_ms: 54.947327
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.846Z","svc":"trailbook","event":"auth.login","user":2}
# {"t":"2026-11-10T05:05:44.846Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:44.847Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures","status":200,"ms":1}
# {"t":"2026-11-10T05:05:44.847Z","svc":"trailbook","event":"request","method":"GET","path":"/api/staff/crew","status":200,"ms":0}
# {"t":"2026-11-10T05:05:44.848Z","svc":"trailbook","event":"staff.crew","departure":1,"by":2}
# {"t":"2026-11-10T05:05:44.848Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/staff/departures/1/crew","status":200,"ms":1}
# {"t":"2026-11-10T05:05:44.849Z","svc":"trailbook","event":"request","method":"PUT","path":"/api/staff/departures/1/crew","status":400,"ms":1}
    # Subtest: crew assignment accepts active crew only
    ok 6 - crew assignment accepts active crew only
      ---
      duration_ms: 54.213063
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.900Z","svc":"trailbook","event":"auth.login","user":3}
# {"t":"2026-11-10T05:05:44.900Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/login","status":200,"ms":51}
# {"t":"2026-11-10T05:05:44.901Z","svc":"trailbook","event":"request","method":"GET","path":"/api/admin/overview","status":200,"ms":0}
    # Subtest: admin overview counts come from the database and show no payments taken
    ok 7 - admin overview counts come from the database and show no payments taken
      ---
      duration_ms: 52.491759
      type: 'test'
      ...
    1..7
ok 6 - departures, crew and permits
  ---
  duration_ms: 402.916064
  type: 'suite'
  ...
# {"t":"2026-11-10T05:05:44.940Z","svc":"trailbook","event":"request","method":"GET","path":"/api/departures/999999","status":404,"ms":39}
# Subtest: error and empty states the API reports
    # Subtest: unknown departure is a clean 404
    ok 1 - unknown departure is a clean 404
      ---
      duration_ms: 38.871555
      type: 'test'
      ...
# {"t":"2026-11-10T05:05:44.992Z","svc":"trailbook","event":"auth.register","user":4}
# {"t":"2026-11-10T05:05:44.992Z","svc":"trailbook","event":"request","method":"POST","path":"/api/auth/register","status":201,"ms":52}
# {"t":"2026-11-10T05:05:44.993Z","svc":"trailbook","event":"request","method":"GET","path":"/api/bookings","status":200,"ms":1}
    # Subtest: an empty booking list is an empty array, not an error
    ok 2 - an empty booking list is an empty array, not an error
      ---
      duration_ms: 52.667282
      type: 'test'
      ...
    1..2
ok 7 - error and empty states the API reports
  ---
  duration_ms: 91.669749
  type: 'suite'
  ...
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: booking status machine
    # Subtest: allowed moves
    ok 1 - allowed moves
      ---
      duration_ms: 0.505783
      type: 'test'
      ...
    # Subtest: refused moves, including skips and reversals
    ok 2 - refused moves, including skips and reversals
      ---
      duration_ms: 0.102643
      type: 'test'
      ...
    1..2
ok 8 - booking status machine
  ---
  duration_ms: 1.202235
  type: 'suite'
  ...
# Subtest: client cancellation window
    # Subtest: allowed at exactly 14 days and more
    ok 1 - allowed at exactly 14 days and more
      ---
      duration_ms: 0.280496
      type: 'test'
      ...
    # Subtest: refused at 13 days and inside it
    ok 2 - refused at 13 days and inside it
      ---
      duration_ms: 0.089563
      type: 'test'
      ...
    # Subtest: refused once completed or cancelled
    ok 3 - refused once completed or cancelled
      ---
      duration_ms: 0.073025
      type: 'test'
      ...
    # Subtest: an invalid date is refused, not treated as open
    ok 4 - an invalid date is refused, not treated as open
      ---
      duration_ms: 0.063036
      type: 'test'
      ...
    1..4
ok 9 - client cancellation window
  ---
  duration_ms: 0.765306
  type: 'suite'
  ...
# Subtest: dates and money
    # Subtest: impossible calendar dates are rejected
    ok 1 - impossible calendar dates are rejected
      ---
      duration_ms: 0.190013
      type: 'test'
      ...
    # Subtest: days between is exact across a month boundary
    ok 2 - days between is exact across a month boundary
      ---
      duration_ms: 0.106767
      type: 'test'
      ...
    # Subtest: total is price times travellers, whole rupees
    ok 3 - total is price times travellers, whole rupees
      ---
      duration_ms: 0.878098
      type: 'test'
      ...
    # Subtest: NPR formatting
    ok 4 - NPR formatting
      ---
      duration_ms: 9.328587
      type: 'test'
      ...
    # Subtest: seats open never goes negative
    ok 5 - seats open never goes negative
      ---
      duration_ms: 0.116956
      type: 'test'
      ...
    1..5
ok 10 - dates and money
  ---
  duration_ms: 10.876217
  type: 'suite'
  ...
# Subtest: opening a departure
    # Subtest: needs a price source
    ok 1 - needs a price source
      ---
      duration_ms: 0.127155
      type: 'test'
      ...
    # Subtest: needs a price above zero and a seat
    ok 2 - needs a price above zero and a seat
      ---
      duration_ms: 0.053545
      type: 'test'
      ...
    # Subtest: refuses a past start date
    ok 3 - refuses a past start date
      ---
      duration_ms: 0.057016
      type: 'test'
      ...
    # Subtest: accepts a complete, future departure
    ok 4 - accepts a complete, future departure
      ---
      duration_ms: 0.049275
      type: 'test'
      ...
    1..4
ok 11 - opening a departure
  ---
  duration_ms: 0.360135
  type: 'suite'
  ...
# Subtest: inputs
    # Subtest: emails
    ok 1 - emails
      ---
      duration_ms: 0.156682
      type: 'test'
      ...
    # Subtest: Nepal phone numbers
    ok 2 - Nepal phone numbers
      ---
      duration_ms: 0.202081
      type: 'test'
      ...
    # Subtest: password rules
    ok 3 - password rules
      ---
      duration_ms: 0.118487
      type: 'test'
      ...
    1..3
ok 12 - inputs
  ---
  duration_ms: 0.596667
  type: 'suite'
  ...
# Subtest: permit checklist wording
    # Subtest: every government-facing item says to check the official source or is marked unverified
    ok 1 - every government-facing item says to check the official source or is marked unverified
      ---
      duration_ms: 0.205947
      type: 'test'
      ...
    # Subtest: the checklist covers TIMS, restricted area and park entry
    ok 2 - the checklist covers TIMS, restricted area and park entry
      ---
      duration_ms: 0.06883
      type: 'test'
      ...
    1..2
ok 13 - permit checklist wording
  ---
  duration_ms: 0.319822
  type: 'suite'
  ...
1..13
# tests 66
# suites 13
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2896.758952
TEST_EXIT=0
```

What the 66 tests cover: security headers and public catalogue; password hashing and registration; login errors that do not reveal which part was wrong; login rate limits; logout; demo sign-in switch; suspended-user session loss; unauthenticated and role-escalation refusals; CSRF header, Origin and token refusals; invalid input (zero, too many, fractional travellers, bad phone, long notes); malformed, wrong-type and oversize bodies; IP rate limit; server-side price; seat holds and release through database triggers; negative-stock refusal; a two-buyer race for the last seat (one 201, one 409); a ten-buyer race for three seats (three 201, seven 409, seats end at 3); booking history rows; cancellation window; status state machine; staff-only confirmation; departure cancel guard; document ticks owner-only; unpriced departure refused; past date refused; impossible date refused; permit validation and audit; crew validation; overview counts; empty and error states; rules for dates, money, phone, email and password, and the permit wording.

Limit: the race tests run on SQLite (node:sqlite), the engine under D1, with each batch serialised in one transaction. They show the constraints and the triggers hold. They do not show D1 under parallel writers.

## 2. Production build

Command: `npm run build` (`tsc --noEmit`, `vite build`, `node api/build.mjs`).

```
vite v5.4.11 building for production...
✓ 52 modules transformed.
dist/site/assets/index-U7ZWo2iM.css                                      25.73 kB │ gzip:  5.33 kB
dist/site/assets/index-DIgjFMC7.js                                      223.30 kB │ gzip: 68.73 kB
✓ built in 938ms
worker 44397 bytes; site total 676623 bytes
```

## 3. Browser checks (local harness, 375, 768, 1024, 1440 px)

Command: `python3 qa/browser_qa.py http://localhost:8795 screenshots/` (output `qa/browser-qa-output.txt`, JSON `qa/browser_checks.json`). Real Chromium, real page clicks.

- Public pages (home, departures, departure detail, login, terms, privacy, unknown page) at all four widths: each has an h1, no horizontal scroll.
- Flows at 375 and 1440: demo client sign-in; trip page with permit disclaimer; document tick survives reload; booking request with success state; bad mobile number refused on the page; client refused on /staff; anonymous /trips asks to sign in; sign-out; staff sign-in; staff confirms a request; permit selects present; admin sign-in; activity log visible; payments taken shows NPR 0.
- No console errors, page errors, or failed API or asset responses, except the deliberate unknown-page check.

Result line: `SUMMARY 83 of 83 checks pass`

Checks:
- PASS: 375px home renders an h1
- PASS: 375px home no horizontal scroll
- PASS: 375px departures renders an h1
- PASS: 375px departures no horizontal scroll
- PASS: 375px departure-detail renders an h1
- PASS: 375px departure-detail no horizontal scroll
- PASS: 375px login renders an h1
- PASS: 375px login no horizontal scroll
- PASS: 375px terms renders an h1
- PASS: 375px terms no horizontal scroll
- PASS: 375px privacy renders an h1
- PASS: 375px privacy no horizontal scroll
- PASS: 375px not-found renders an h1
- PASS: 375px not-found no horizontal scroll
- PASS: 768px home renders an h1
- PASS: 768px home no horizontal scroll
- PASS: 768px departures renders an h1
- PASS: 768px departures no horizontal scroll
- PASS: 768px departure-detail renders an h1
- PASS: 768px departure-detail no horizontal scroll
- PASS: 768px login renders an h1
- PASS: 768px login no horizontal scroll
- PASS: 768px terms renders an h1
- PASS: 768px terms no horizontal scroll
- PASS: 768px privacy renders an h1
- PASS: 768px privacy no horizontal scroll
- PASS: 768px not-found renders an h1
- PASS: 768px not-found no horizontal scroll
- PASS: 1024px home renders an h1
- PASS: 1024px home no horizontal scroll
- PASS: 1024px departures renders an h1
- PASS: 1024px departures no horizontal scroll
- PASS: 1024px departure-detail renders an h1
- PASS: 1024px departure-detail no horizontal scroll
- PASS: 1024px login renders an h1
- PASS: 1024px login no horizontal scroll
- PASS: 1024px terms renders an h1
- PASS: 1024px terms no horizontal scroll
- PASS: 1024px privacy renders an h1
- PASS: 1024px privacy no horizontal scroll
- PASS: 1024px not-found renders an h1
- PASS: 1024px not-found no horizontal scroll
- PASS: 1440px home renders an h1
- PASS: 1440px home no horizontal scroll
- PASS: 1440px departures renders an h1
- PASS: 1440px departures no horizontal scroll
- PASS: 1440px departure-detail renders an h1
- PASS: 1440px departure-detail no horizontal scroll
- PASS: 1440px login renders an h1
- PASS: 1440px login no horizontal scroll
- PASS: 1440px terms renders an h1
- PASS: 1440px terms no horizontal scroll
- PASS: 1440px privacy renders an h1
- PASS: 1440px privacy no horizontal scroll
- PASS: 1440px not-found renders an h1
- PASS: 1440px not-found no horizontal scroll
- PASS: 375px demo client lands on My trips
- PASS: 375px demo booking TB-DEMO01 is listed
- PASS: 375px trip shows permit disclaimer
- PASS: 375px document tick survives reload
- PASS: 375px booking success state shows reference
- PASS: 375px bad mobile shows an error
- PASS: 375px client sees role refusal on /staff
- PASS: 375px anonymous /trips asks to sign in
- PASS: 375px staff lands on operations
- PASS: 375px staff confirms a request
- PASS: 375px staff sees permit selects
- PASS: 375px admin sees the activity log
- PASS: 375px admin dashboard shows payments taken 0
- PASS: 1440px demo client lands on My trips
- PASS: 1440px demo booking TB-DEMO01 is listed
- PASS: 1440px trip shows permit disclaimer
- PASS: 1440px document tick survives reload
- PASS: 1440px booking success state shows reference
- PASS: 1440px bad mobile shows an error
- PASS: 1440px client sees role refusal on /staff
- PASS: 1440px anonymous /trips asks to sign in
- PASS: 1440px staff lands on operations
- PASS: 1440px staff confirms a request
- PASS: 1440px staff sees permit selects
- PASS: 1440px admin sees the activity log
- PASS: 1440px admin dashboard shows payments taken 0
- PASS: no console errors or page errors across all runs

Screenshots: `screenshots/` (32 PNG, full page; names are `<width>-<page>.png`).

## 4. Accessibility (axe-core)

Command: `python3 qa/axe_run.py http://localhost:8795 qa/axe-results.json`. Output:

```
375:home violations: 0 []
375:departures violations: 0 []
375:departure-detail violations: 0 []
375:login violations: 0 []
375:register violations: 0 []
375:terms violations: 0 []
1440:home violations: 0 []
1440:departures violations: 0 []
1440:departure-detail violations: 0 []
1440:login violations: 0 []
1440:register violations: 0 []
1440:terms violations: 0 []
1440:trip-detail violations: 0 []
1440:staff-departure violations: 0 []
TOTAL_RULE_VIOLATIONS 0
```

Pages: home, departures, departure detail, login, register, terms (375 and 1440), and trip detail and staff departure (1440).

## 5. Live URL (read-only)

Publish receipt (`qa/publish-final.json`, slug `trailbook`, version 4): status `published`, deploy `70850508-356e-4b6a-851a-4ee5bff0bb8e`, answered `200`, coalesce outcome `landed`.

Smoke (`qa/live-smoke-output.txt`). It signs in with the one-tap demo buttons and makes no bookings:

```
PASS 375px home 200 
PASS 375px home has h1 
PASS 375px home no horizontal scroll 
PASS 375px departures lists open dates 
PASS 375px departures no horizontal scroll 
PASS 375px demo client sees TB-DEMO01 
PASS 375px trip page permit checklist 
PASS 375px staff operations table 
PASS 375px admin overview and log 
PASS 1440px home 200 
PASS 1440px home has h1 
PASS 1440px home no horizontal scroll 
PASS 1440px departures lists open dates 
PASS 1440px departures no horizontal scroll 
PASS 1440px demo client sees TB-DEMO01 
PASS 1440px trip page permit checklist 
PASS 1440px staff operations table 
PASS 1440px admin overview and log 
PASS no console or page errors 
SMOKE 19 of 19 pass
```

HTTP status (`qa/live-http-status.txt`, `Accept: text/html` for pages):

```
/ 200
/departures 200
/departures/1 200
/trips/TB-DEMO01 200
/login 200
/register 200
/terms 200
/privacy 200
/staff 200
/admin 200
/nope 404
api health 200
departures api 200
```

Security headers on the live API response (checked with curl): `Content-Security-Policy` with `script-src 'self'`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Cache-Control: no-store`.

## 6. Problems found during QA and fixed

1. Pill labels overflowed the page at 375 px ("Restricted area: check the official source"). Fixed: pills wrap.
2. Document ticks waited for the server before showing. Fixed: optimistic tick, put back if the server refuses.
3. Unknown pages returned 200. Fixed: unknown page routes return 404 with the app's own not-found screen.
4. The root URL returned 404 to requests without an Accept header, which would have kept the publish from settling. Fixed: the app shell serves root and route-like paths regardless of Accept.
5. axe flagged the logo link (accessible name did not contain its visible text at 1440). Fixed: visible text is the name.
6. Alert and callout stripes on the left (audit point 17). Changed to top rules.

## 7. Not run

- Lighthouse (no performance, best-practices or SEO score is claimed).
- Keyboard-only walk through every flow, and screen reader output.
- Budget Android device and slow network checks.
- Real D1 with parallel writers.
- Coolors and 21st.dev (not signed in / not used).
- Real Clerk or SMS: not part of this build.