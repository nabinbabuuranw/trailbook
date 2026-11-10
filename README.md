# Trailbook (Day 8 of 100 Platforms)

Trek operations for a Nepal trekking agency: open departures, seat holds, requests and confirmations, guide and porter assignment, a document checklist for each traveller, and a permit checklist for each trip. Built for trekking operators in Nepal, with every person's data kept on the server.

**All data in this build is DEMO data.** Treks, departures, prices, crew, people and bookings are invented for testing. Nothing here is a real operator's product or price.

- Live: https://trailbook.sites.tab.bot/ (HTTP 200, checked 2026-11-10)
- Repository: https://github.com/nabinbabuuranw/trailbook (MIT). Three commits on `main`: the first holds only the README, the second the full source, the third this history note. GitHub refuses Git data writes into an empty repository, and a force-push was not allowed, so the history could not be one commit.
- Demo sign-in: the Login page has one-tap **Demo** buttons for Client, Staff and Admin. Email and password for each:
  - Client: `client@demo.trailbook.example` / `DemoClient2026`
  - Staff: `staff@demo.trailbook.example` / `DemoStaff2026`
  - Admin: `admin@demo.trailbook.example` / `DemoAdmin2026`

## What it is not

- It is **not an official permit system**. It does not issue or approve TIMS cards, trekking permits or park permits. Every permit item says to check the current official source. Where a route's requirement is not confirmed, it says UNVERIFIED.
- It takes **no payments**. A booking is a request until the operator confirms it. Revenue shown: NPR 0. Expenses: $0.
- No reviews, customer counts, partner logos or government endorsements appear anywhere.

## Who uses it

| Role | Can do | Cannot do |
|---|---|---|
| Client (sign-up or demo) | Browse open departures, request seats, see own trips, tick own documents, see the permit states for own trip, cancel own booking up to 14 days before departure (draft rule) | See anyone else's booking, see staff pages |
| Staff (guide or agency staff) | See all departures, passenger contact details for their departures, confirm/decline/complete bookings, assign crew, set permit item states, open/close/cancel departures | Change roles, see the activity log, add departures |
| Admin | Everything staff can do, plus add departures, change seats and prices, set roles, suspend accounts, see the activity log and counts | Change own role, suspend self |

The role is read from the database on every request. A role in a request body or a cookie is ignored.

## Stack

- Frontend: React 18, Vite 5, TypeScript 5.6, Tailwind CSS 3.4, react-router 6. Self-hosted Barlow and Barlow Condensed fonts (Fontsource).
- API: one Cloudflare Worker over D1 (SQLite). Written as plain TypeScript with no framework. Bundled with esbuild.
- Auth: PBKDF2-SHA256 password hashes (100,000 iterations, WebCrypto). Server-side sessions stored as SHA-256 hashes of the token, 12 hours. Cookie `__Host-tb_session`: HttpOnly, Secure, SameSite=Lax.
- Shared rules module (`shared/rules.ts`) used by the Worker, the browser and the tests: booking status machine, cancellation window, departure opening rule, validation, permit template.
- No paid services, no third-party keys, no analytics, no ads.

## Security in this build

- RBAC on every route in the Worker (`api/src/worker.ts`, `need(ctx, roles)`). Booking owners only: anyone else asking for someone's booking gets a 404, so existence is not leaked.
- CSRF: every write needs the header `X-Trailbook-Request: 1`, a matching Origin when one is sent, and (when signed in) the session's CSRF token.
- Rate limits, stored in D1: login 20 per 15 min per address and 8 per 15 min per account; registration 5 per hour per address; bookings 15 per hour per user; demo sign-in 30 per 15 min per address.
- Input validation for every field (`api/src/http.ts`): types, lengths, Nepal mobile numbers, calendar dates, enumerations. Bodies are capped at 8 KB and must be JSON.
- Security headers on every response: a strict Content-Security-Policy (`script-src 'self'`, no inline scripts), `frame-ancestors 'none'`, nosniff, HSTS, Referrer-Policy, Permissions-Policy, no-store on the API.
- Seats and stock are protected in the database: a trigger holds seats when a booking is requested, releases them on cancel or completion, and a `CHECK (seats_held <= seats_total)` constraint refuses overbooking. The price is always computed on the server.
- Audit log: every staff and admin write writes a row in the same transaction.
- Logs: structured JSON, no emails, passwords, tokens or phone numbers.

## API

| Method and path | Who | Purpose |
|---|---|---|
| GET `/api/health` | anyone | liveness |
| GET `/api/auth/me` | anyone | current user and CSRF token |
| POST `/api/auth/register`, `/login`, `/logout`, `/demo` | anyone (logout: signed in) | sessions |
| GET `/api/treks` | anyone | trek list |
| GET `/api/departures?region=` | anyone | open, future departures with seats left |
| GET `/api/departures/:id` | anyone (drafts: staff only) | departure detail and itinerary |
| POST `/api/bookings` | signed in | request seats (server prices it) |
| GET `/api/bookings` | signed in | own bookings |
| GET `/api/bookings/:ref` | owner or staff | trip, permit states, documents |
| POST `/api/bookings/:ref/cancel` | owner | cancel inside the rule |
| PUT `/api/bookings/:ref/documents` | owner | tick a document |
| GET `/api/staff/departures`, `/api/staff/departures/:id`, `/api/staff/crew` | staff, admin | operations |
| PUT `/api/staff/departures/:id/crew`, `/permits/:key` | staff, admin | assignments and checklist |
| POST `/api/staff/departures/:id/status`, `/api/staff/bookings/:ref/status` | staff, admin | status moves (state machine enforced) |
| POST `/api/admin/treks`, `/api/admin/departures`, `/api/admin/crew` | admin | create |
| PATCH `/api/admin/departures/:id` | admin | seats, price, price source, date |
| GET `/api/admin/overview`, `/users`, `/audit` | admin | counts, people, log |
| PUT `/api/admin/users/:id/role`, `/suspended` | admin | roles and suspension |

## Repository layout

```
api/src/worker.ts     routes, auth, RBAC, validation, booking transactions
api/src/schema.ts     D1 schema, triggers, DEMO seed
api/src/crypto.ts     PBKDF2, tokens, references
api/src/http.ts       errors, headers, typed body readers
api/test/             API tests (node:test) and a node:sqlite adapter for D1 SQL
shared/rules.ts       business rules shared by Worker, browser and tests
shared/test/          rules tests
src/                  React app (pages, components, API client, auth context)
qa/                   browser QA (Playwright), axe accessibility check, live smoke
tools/local-server.ts runs the Worker locally on SQLite for browser checks
```

## Run it

```bash
npm install
npm test            # 66 tests: API (46) and rules (20)
npm run typecheck
npm run build       # writes dist/site (the Worker bundle, the app shell, tab-site.json)
npm run serve:local # local harness on http://localhost:8795
python3 qa/browser_qa.py http://localhost:8795 out/   # needs Playwright for Python and Chromium
```

Deploying: publish `dist/site` as a Worker site with a D1 binding named `DB` (declared in `tab-site.json`). The schema is created and the DEMO seed inserted on the first request.

## Known limits (honest)

- DEMO data only. Departure dates are set relative to the day the data is first seeded. When no future demo dates remain, the next request seeds new ones.
- No password reset and no email verification yet. Both are needed before real customers.
- No payments, no invoices, no courier or delivery features.
- Permit and entry rules are not verified for any route. The checklist points to the official source, and staff states are the operator's own checks, not approvals.
- Terms and Privacy are drafts, not reviewed by a lawyer, and not checked against Nepal's data protection rules.
- The cancellation window (14 days) is a draft rule that no operator has agreed to.
- Admin can add treks through the API (`POST /api/admin/treks`) but the admin page has no trek form yet.
- Motion is minimal: colour transitions and reduced-motion support. There is no animated hero or page transition.
- Concurrency was tested against SQLite (the engine under D1), with batches serialised. Real D1 under parallel writers was not run.
- The Worker's CPU cost for PBKDF2 at 100,000 iterations on the hosting platform was not measured.
- Lighthouse was not run. Accessibility was checked with axe-core on 14 page states: 0 violations.
- Coolors and 21st.dev were not used for this build (see DESIGN.md).

## Plan to make money (draft, nothing verified yet)

- Target customer: small and mid-size trekking agencies in Kathmandu and Pokhara that run group departures. (Market size not researched. UNVERIFIED.)
- Problem: seats, guides, porters and permit paperwork tracked in spreadsheets and chat.
- Idea: a monthly subscription per operator, with a free tier for one departure. Pricing not set. No competitor research done yet. UNVERIFIED.
- Costs now: NPR 0 and $0. Revenue: NPR 0. No guarantee of any revenue.

## Day 8 log

See `files/platforms/LOG.md`, entry Day 8, and `QA_REPORT.md` for the commands and output.
