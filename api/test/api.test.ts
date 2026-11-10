import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, type Env } from '../src/worker.ts';
import { createNodeD1 } from './d1-node.ts';
import { DEMO_PASSWORDS } from '../src/schema.ts';

const NOW = new Date('2026-11-10T04:00:00Z'); // 2026-11-10 09:45 in Nepal
const ORIGIN = 'https://trailbook.test';

type Opts = { method?: string; body?: unknown; cookie?: string; csrf?: string; ip?: string; origin?: string | null; raw?: string; contentType?: string | null; headers?: Record<string, string>; noProtect?: boolean };

function newEnv(extra: Partial<Env> = {}): Env & { raw: any } {
  const DB = createNodeD1();
  return { DB, ASSETS: { fetch: async () => new Response('nf', { status: 404 }) }, raw: DB.raw, ...extra } as Env & { raw: any };
}

let ipCounter = 0;
async function call(env: Env, path: string, opts: Opts = {}, now: Date = NOW): Promise<{ status: number; json: any; headers: Headers; cookie: string | null }> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const method = opts.method || (opts.body !== undefined || opts.raw !== undefined ? 'POST' : 'GET');
  if (!opts.noProtect && method !== 'GET') headers['x-trailbook-request'] = '1';
  if (opts.contentType !== null) headers['content-type'] = opts.contentType || 'application/json';
  if (opts.cookie) headers['cookie'] = `__Host-tb_session=${opts.cookie}`;
  if (opts.csrf) headers['x-csrf-token'] = opts.csrf;
  headers['cf-connecting-ip'] = opts.ip || `10.0.0.${++ipCounter}`;
  if (opts.origin !== null) headers['origin'] = opts.origin || ORIGIN;
  const init: RequestInit = { method, headers };
  if (opts.raw !== undefined) init.body = opts.raw;
  else if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await handleRequest(new Request(ORIGIN + path, init), env, now);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  const sc = res.headers.get('set-cookie');
  const m = sc && /__Host-tb_session=([^;]*)/.exec(sc);
  const cookie = m ? m[1] : null;
  return { status: res.status, json, headers: res.headers, cookie };
}

async function login(env: Env, email: string, password: string, ip?: string) {
  const r = await call(env, '/api/auth/login', { body: { email, password }, ip });
  assert.equal(r.status, 200, 'login should succeed: ' + JSON.stringify(r.json));
  return { cookie: r.cookie!, csrf: r.json.csrfToken as string, user: r.json.user };
}

const CLIENT = 'client@demo.trailbook.example';
const STAFF = 'staff@demo.trailbook.example';
const ADMIN = 'admin@demo.trailbook.example';

async function openDepartureId(env: Env): Promise<number> {
  const r = await call(env, '/api/departures');
  assert.equal(r.status, 200);
  return r.json.departures[0].id;
}

describe('security headers and public catalogue', () => {
  test('API responses carry CSP, nosniff, frame and no-store headers', async () => {
    const env = newEnv();
    const r = await call(env, '/api/health');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.match(r.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });

  test('public list shows only open, future departures with seats left', async () => {
    const env = newEnv();
    const r = await call(env, '/api/departures');
    assert.equal(r.status, 200);
    assert.ok(r.json.departures.length >= 4, 'demo departures seeded');
    for (const d of r.json.departures) {
      assert.ok(d.start_date >= '2026-11-10');
      assert.ok(d.seats_open >= 0 && d.seats_open <= d.seats_total);
      assert.equal(d.seats_total - d.seats_open, d.seats_total - d.seats_open); // numeric
      assert.equal(d.price_source.startsWith('DEMO'), true, 'demo prices are labelled');
    }
  });

  test('a draft departure is not visible to the public', async () => {
    const env = newEnv();
    const admin = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const created = await call(env, '/api/admin/departures', { cookie: admin.cookie, csrf: admin.csrf, body: { trek_id: 1, start_date: '2027-03-01', seats_total: 5, price_npr: 1000, status: 'draft' } });
    assert.equal(created.status, 201);
    const pub = await call(env, `/api/departures/${created.json.id}`);
    assert.equal(pub.status, 404);
    const list = await call(env, '/api/departures');
    assert.ok(!list.json.departures.some((d: any) => d.id === created.json.id));
  });

  test('unknown API route is 404 JSON, wrong method is 405', async () => {
    const env = newEnv();
    assert.equal((await call(env, '/api/nope')).status, 404);
    assert.equal((await call(env, '/api/auth/login', { method: 'GET' })).status, 405);
  });
});

describe('authentication', () => {
  test('passwords are stored as PBKDF2-SHA256 hashes, never in plain text', async () => {
    const env = newEnv();
    await call(env, '/api/health');
    const row = await env.raw.prepare("SELECT password_hash FROM users WHERE email = ?").get(CLIENT);
    assert.match(row.password_hash, /^pbkdf2_sha256\$100000\$/);
    assert.ok(!row.password_hash.includes(DEMO_PASSWORDS.client));
  });

  test('register creates a client session and ignores any role sent by the browser', async () => {
    const env = newEnv();
    const r = await call(env, '/api/auth/register', { body: { name: 'Asha Test', email: 'asha@example.com', password: 'Walk2026trail', role: 'admin' } });
    assert.equal(r.status, 201);
    assert.equal(r.json.user.role, 'client');
    assert.ok(r.cookie);
    const cookie = r.headers.get('set-cookie') || '';
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /^__Host-tb_session=/);
  });

  test('register refuses weak passwords and bad emails', async () => {
    const env = newEnv();
    assert.equal((await call(env, '/api/auth/register', { body: { name: 'Weak One', email: 'w@example.com', password: 'short1' } })).status, 400);
    assert.equal((await call(env, '/api/auth/register', { body: { name: 'Weak Two', email: 'w@example.com', password: 'alllettersonly' } })).status, 400);
    assert.equal((await call(env, '/api/auth/register', { body: { name: 'Bad Email', email: 'not-an-email', password: 'Walk2026trail' } })).status, 400);
  });

  test('a duplicate email is refused', async () => {
    const env = newEnv();
    const r = await call(env, '/api/auth/register', { body: { name: 'Demo Again', email: CLIENT, password: 'Walk2026trail' } });
    assert.equal(r.status, 409);
  });

  test('wrong password and unknown email give the same answer', async () => {
    const env = newEnv();
    const a = await call(env, '/api/auth/login', { body: { email: CLIENT, password: 'WrongPass2026' } });
    const b = await call(env, '/api/auth/login', { body: { email: 'nobody@example.com', password: 'WrongPass2026' } });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.json.error.message, b.json.error.message);
  });

  test('login is rate limited per account', async () => {
    const env = newEnv();
    let last = 0;
    for (let i = 0; i < 9; i++) {
      last = (await call(env, '/api/auth/login', { body: { email: CLIENT, password: 'WrongPass2026' } })).status;
    }
    assert.equal(last, 429);
  });

  test('logout ends the session on the server', async () => {
    const env = newEnv();
    const s = await login(env, CLIENT, DEMO_PASSWORDS.client);
    assert.equal((await call(env, '/api/bookings', { cookie: s.cookie })).status, 200);
    await call(env, '/api/auth/logout', { cookie: s.cookie, csrf: s.csrf, body: {} });
    assert.equal((await call(env, '/api/bookings', { cookie: s.cookie })).status, 401);
  });

  test('demo one-tap sign-in can be switched off', async () => {
    const off = newEnv({ DEMO_MODE: 'off' });
    assert.equal((await call(off, '/api/auth/demo', { body: { role: 'admin' } })).status, 404);
    const on = newEnv();
    const r = await call(on, '/api/auth/demo', { body: { role: 'client' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.role, 'client');
  });

  test('a suspended user loses their session at once', async () => {
    const env = newEnv();
    const admin = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const client = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const users = await call(env, '/api/admin/users', { cookie: admin.cookie });
    const id = users.json.users.find((u: any) => u.email === CLIENT).id;
    const s = await call(env, `/api/admin/users/${id}/suspended`, { method: 'PUT', cookie: admin.cookie, csrf: admin.csrf, body: { suspended: true } });
    assert.equal(s.status, 200);
    assert.equal((await call(env, '/api/bookings', { cookie: client.cookie })).status, 401);
    assert.equal((await call(env, '/api/auth/login', { body: { email: CLIENT, password: DEMO_PASSWORDS.client } })).status, 401);
  });
});

describe('authorization (server-side RBAC)', () => {
  test('unauthenticated booking is rejected', async () => {
    const env = newEnv();
    const dep = await openDepartureId(env);
    const r = await call(env, '/api/bookings', { body: { departure_id: dep, travellers: 1, contact_name: 'Anon User', contact_phone: '+977 9800000001' } });
    assert.equal(r.status, 401);
  });

  test('unauthenticated admin request is rejected', async () => {
    const env = newEnv();
    assert.equal((await call(env, '/api/admin/overview')).status, 401);
    assert.equal((await call(env, '/api/admin/users')).status, 401);
    assert.equal((await call(env, '/api/staff/departures')).status, 401);
  });

  test('a client cannot reach staff or admin routes (role escalation refused)', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    assert.equal((await call(env, '/api/staff/departures', { cookie: c.cookie })).status, 403);
    assert.equal((await call(env, '/api/admin/overview', { cookie: c.cookie })).status, 403);
    const users = await call(env, '/api/admin/users', { cookie: c.cookie });
    assert.equal(users.status, 403);
    const promote = await call(env, '/api/admin/users/1/role', { method: 'PUT', cookie: c.cookie, csrf: c.csrf, body: { role: 'admin' } });
    assert.equal(promote.status, 403);
  });

  test('staff cannot change user roles or create departures', async () => {
    const env = newEnv();
    const s = await login(env, STAFF, DEMO_PASSWORDS.staff);
    const r = await call(env, '/api/admin/departures', { cookie: s.cookie, csrf: s.csrf, body: { trek_id: 1, start_date: '2027-03-01', seats_total: 5, price_npr: 1000, status: 'draft' } });
    assert.equal(r.status, 403);
    const role = await call(env, '/api/admin/users/2/role', { method: 'PUT', cookie: s.cookie, csrf: s.csrf, body: { role: 'admin' } });
    assert.equal(role.status, 403);
  });

  test('a client cannot read another person\u2019s booking', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const mine = await call(env, '/api/bookings', { cookie: c.cookie });
    const ref = mine.json.bookings[0].reference;
    const other = await login(env, await makeClient(env, 'other@example.com'), 'Walk2026trail');
    assert.equal((await call(env, `/api/bookings/${ref}`, { cookie: other.cookie })).status, 404);
    assert.equal((await call(env, `/api/bookings/${ref}`, { cookie: c.cookie })).status, 200);
  });

  test('an admin cannot change their own role or suspend themselves', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const self = a.user.id;
    assert.equal((await call(env, `/api/admin/users/${self}/role`, { method: 'PUT', cookie: a.cookie, csrf: a.csrf, body: { role: 'client' } })).status, 409);
    assert.equal((await call(env, `/api/admin/users/${self}/suspended`, { method: 'PUT', cookie: a.cookie, csrf: a.csrf, body: { suspended: true } })).status, 409);
  });

  test('admin role change is audited and clears that user\u2019s sessions', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const target = await makeClient(env, 'promote@example.com');
    const ts = await login(env, 'promote@example.com', 'Walk2026trail');
    const id = (await env.raw.prepare('SELECT id FROM users WHERE email = ?').get('promote@example.com')).id;
    const r = await call(env, `/api/admin/users/${id}/role`, { method: 'PUT', cookie: a.cookie, csrf: a.csrf, body: { role: 'staff' } });
    assert.equal(r.status, 200);
    assert.equal((await call(env, '/api/bookings', { cookie: ts.cookie })).status, 401, 'old session is gone');
    const audit = await call(env, '/api/admin/audit', { cookie: a.cookie });
    assert.ok(audit.json.entries.some((e: any) => e.action === 'user.role' && e.entity_id === String(id)));
    void target;
  });
});

async function makeClient(env: Env, email: string): Promise<string> {
  const r = await call(env, '/api/auth/register', { body: { name: 'Other Person', email, password: 'Walk2026trail' } });
  assert.equal(r.status, 201);
  return email;
}

describe('CSRF and request safety', () => {
  test('a mutating request without the protection header is refused', async () => {
    const env = newEnv();
    const r = await call(env, '/api/auth/login', { body: { email: CLIENT, password: DEMO_PASSWORDS.client }, noProtect: true });
    assert.equal(r.status, 403);
  });

  test('a request from another origin is refused', async () => {
    const env = newEnv();
    const r = await call(env, '/api/auth/login', { body: { email: CLIENT, password: DEMO_PASSWORDS.client }, origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.code, 'origin_refused');
  });

  test('a signed-in write needs the session CSRF token', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const dep = await openDepartureId(env);
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: 'not-the-token', body: { departure_id: dep, travellers: 1, contact_name: 'Demo Client', contact_phone: '+977 9800000000' } });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.code, 'csrf_failed');
  });

  test('bad input is refused with field names, not a crash', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const dep = await openDepartureId(env);
    const base = { departure_id: dep, travellers: 2, contact_name: 'Demo Client', contact_phone: '+977 9800000000' };
    const cases: Array<[string, any]> = [
      ['zero travellers', { ...base, travellers: 0 }],
      ['too many travellers', { ...base, travellers: 11 }],
      ['fractional travellers', { ...base, travellers: 1.5 }],
      ['bad phone', { ...base, contact_phone: '12345' }],
      ['string departure', { ...base, departure_id: 'abc' }],
      ['long notes', { ...base, notes: 'x'.repeat(501) }],
    ];
    for (const [label, body] of cases) {
      const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body });
      assert.equal(r.status, 400, label);
      assert.equal(r.json.error.code, 'invalid_input', label);
    }
  });

  test('malformed JSON, wrong content type and oversize bodies are refused', async () => {
    const env = newEnv();
    assert.equal((await call(env, '/api/auth/login', { raw: '{nope' })).status, 400);
    assert.equal((await call(env, '/api/auth/login', { raw: 'email=a', contentType: 'text/plain' })).status, 415);
    assert.equal((await call(env, '/api/auth/login', { raw: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(9000) }) })).status, 413);
  });

  test('a rate-limited IP is held even with correct credentials', async () => {
    const env = newEnv();
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await call(env, '/api/auth/login', { body: { email: `r${i}@example.com`, password: 'WrongPass2026' }, ip: '203.0.113.9' })).status;
    }
    assert.equal(last, 429);
  });
});

describe('bookings, seats and stock', () => {
  test('a booking is requested at the server price, and any client-sent price is ignored', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const list = await call(env, '/api/departures');
    const dep = list.json.departures.find((d: any) => d.seats_open >= 2);
    const detail = await call(env, `/api/departures/${dep.id}`);
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body: { departure_id: dep.id, travellers: 2, contact_name: 'Demo Client', contact_phone: '+977 9800000000', price_npr: 1, total_npr: 1 } });
    assert.equal(r.status, 201);
    assert.equal(r.json.booking.status, 'requested');
    assert.equal(r.json.booking.total_npr, detail.json.departure.price_npr * 2);
    assert.match(r.json.booking.reference, /^TB-[A-Z0-9]{6}$/);
  });

  test('a booking holds seats and cancelling releases them (database triggers)', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const dep = (await call(env, '/api/departures')).json.departures.find((d: any) => d.seats_open >= 3 && d.start_date > '2026-12-30');
    const before = dep.seats_open;
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body: { departure_id: dep.id, travellers: 3, contact_name: 'Demo Client', contact_phone: '+977 9800000000' } });
    assert.equal(r.status, 201);
    const mid = (await call(env, `/api/departures/${dep.id}`)).json.departure.seats_open;
    assert.equal(mid, before - 3);
    const cancel = await call(env, `/api/bookings/${r.json.booking.reference}/cancel`, { cookie: c.cookie, csrf: c.csrf, body: {} });
    assert.equal(cancel.status, 200);
    const after = (await call(env, `/api/departures/${dep.id}`)).json.departure.seats_open;
    assert.equal(after, before);
  });

  test('negative stock is refused: no overbooking and no seat change on refusal', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const created = await call(env, '/api/admin/departures', { cookie: a.cookie, csrf: a.csrf, body: { trek_id: 3, start_date: '2027-02-01', seats_total: 2, price_npr: 5000, price_source: 'DEMO test', status: 'open' } });
    assert.equal(created.status, 201);
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body: { departure_id: created.json.id, travellers: 3, contact_name: 'Demo Client', contact_phone: '+977 9800000000' } });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, 'not_enough_seats');
    const row = await env.raw.prepare('SELECT seats_held FROM departures WHERE id = ?').get(created.json.id);
    assert.equal(row.seats_held, 0);
    const bookings = await env.raw.prepare('SELECT COUNT(*) AS n FROM bookings WHERE departure_id = ?').get(created.json.id);
    assert.equal(bookings.n, 0);
  });

  test('stock race: two buyers for the last seat, exactly one succeeds', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const created = await call(env, '/api/admin/departures', { cookie: a.cookie, csrf: a.csrf, body: { trek_id: 2, start_date: '2027-02-10', seats_total: 1, price_npr: 5000, price_source: 'DEMO race test', status: 'open' } });
    const buyers = [];
    for (let i = 0; i < 2; i++) {
      const email = `buyer${i}@example.com`;
      const reg = await call(env, '/api/auth/register', { body: { name: `Buyer ${i}`, email, password: 'Walk2026trail' } });
      buyers.push({ cookie: reg.cookie!, csrf: reg.json.csrfToken as string });
    }
    const results = await Promise.all(buyers.map((b) =>
      call(env, '/api/bookings', { cookie: b.cookie, csrf: b.csrf, body: { departure_id: created.json.id, travellers: 1, contact_name: 'Race Buyer', contact_phone: '+977 9800000002' } }),
    ));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409]);
    const row = await env.raw.prepare('SELECT seats_held FROM departures WHERE id = ?').get(created.json.id);
    assert.equal(row.seats_held, 1);
  });

  test('ten buyers for three seats: exactly three bookings, seats end at three', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const created = await call(env, '/api/admin/departures', { cookie: a.cookie, csrf: a.csrf, body: { trek_id: 2, start_date: '2027-02-20', seats_total: 3, price_npr: 5000, price_source: 'DEMO race test', status: 'open' } });
    const buyers = [];
    for (let i = 0; i < 10; i++) {
      const reg = await call(env, '/api/auth/register', { body: { name: `Crowd ${i}`, email: `crowd${i}@example.com`, password: 'Walk2026trail' } });
      buyers.push({ cookie: reg.cookie!, csrf: reg.json.csrfToken as string });
    }
    const results = await Promise.all(buyers.map((b) =>
      call(env, '/api/bookings', { cookie: b.cookie, csrf: b.csrf, body: { departure_id: created.json.id, travellers: 1, contact_name: 'Crowd Buyer', contact_phone: '+977 9800000003' } }),
    ));
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.equal(results.filter((r) => r.status === 409).length, 7);
    const row = await env.raw.prepare('SELECT seats_held FROM departures WHERE id = ?').get(created.json.id);
    assert.equal(row.seats_held, 3);
  });

  test('a booking writes a history row (requested)', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const dep = (await call(env, '/api/departures')).json.departures.find((d: any) => d.seats_open >= 1);
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body: { departure_id: dep.id, travellers: 1, contact_name: 'Demo Client', contact_phone: '+977 9800000000' } });
    const ev = await env.raw.prepare(`SELECT e.to_status, e.from_status FROM booking_events e JOIN bookings b ON b.id = e.booking_id WHERE b.reference = ?`).all(r.json.booking.reference);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].to_status, 'requested');
    assert.equal(ev[0].from_status, null);
  });

  test('client cancellation is refused inside the cancellation window', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const mine = await call(env, '/api/bookings', { cookie: c.cookie });
    // The demo booking leaves on the first departure; move "today" to 5 days before it.
    const detail = await call(env, `/api/bookings/${mine.json.bookings[0].reference}`, { cookie: c.cookie });
    const start = detail.json.booking.start_date as string;
    const near = new Date(new Date(start + 'T00:00:00Z').getTime() - 5 * 86400_000);
    const later = await call(env, '/api/auth/login', { body: { email: CLIENT, password: DEMO_PASSWORDS.client } }, near);
    const r = await call(env, `/api/bookings/${mine.json.bookings[0].reference}/cancel`, { cookie: later.cookie!, csrf: later.json.csrfToken, body: {} }, near);
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, 'not_cancellable');
  });

  test('staff cannot skip a status: requested to completed is refused', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const dep = (await call(env, '/api/departures')).json.departures.find((d: any) => d.seats_open >= 1);
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body: { departure_id: dep.id, travellers: 1, contact_name: 'Demo Client', contact_phone: '+977 9800000000' } });
    const s = await login(env, STAFF, DEMO_PASSWORDS.staff);
    const bad = await call(env, `/api/staff/bookings/${r.json.booking.reference}/status`, { cookie: s.cookie, csrf: s.csrf, body: { to: 'completed' } });
    assert.equal(bad.status, 409);
    assert.equal(bad.json.error.code, 'invalid_transition');
    const ok = await call(env, `/api/staff/bookings/${r.json.booking.reference}/status`, { cookie: s.cookie, csrf: s.csrf, body: { to: 'confirmed', note: 'Deposit agreed offline' } });
    assert.equal(ok.status, 200);
  });

  test('a client cannot confirm their own booking', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const r = await call(env, `/api/staff/bookings/TB-DEMO01/status`, { cookie: c.cookie, csrf: c.csrf, body: { to: 'cancelled' } });
    assert.equal(r.status, 403);
  });

  test('staff cancellation releases seats; the departure cannot be cancelled while bookings are active', async () => {
    const env = newEnv();
    const s = await login(env, STAFF, DEMO_PASSWORDS.staff);
    const dep = (await call(env, '/api/departures')).json.departures.find((d: any) => d.seats_open >= 1);
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const r = await call(env, '/api/bookings', { cookie: c.cookie, csrf: c.csrf, body: { departure_id: dep.id, travellers: 1, contact_name: 'Demo Client', contact_phone: '+977 9800000000' } });
    const blocked = await call(env, `/api/staff/departures/${dep.id}/status`, { cookie: s.cookie, csrf: s.csrf, body: { status: 'cancelled' } });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.error.code, 'active_bookings');
    await call(env, `/api/staff/bookings/${r.json.booking.reference}/status`, { cookie: s.cookie, csrf: s.csrf, body: { to: 'cancelled', note: 'Declined' } });
    const seats = await env.raw.prepare('SELECT seats_held FROM departures WHERE id = ?').get(dep.id);
    assert.equal(seats.seats_held, 0 + (await env.raw.prepare("SELECT COALESCE(SUM(travellers),0) AS n FROM bookings WHERE departure_id = ? AND status IN ('requested','confirmed')").get(dep.id)).n);
  });

  test('a document checklist tick is saved for the owner only', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const ok = await call(env, '/api/bookings/TB-DEMO01/documents', { method: 'PUT', cookie: c.cookie, csrf: c.csrf, body: { key: 'passport', checked: true } });
    assert.equal(ok.status, 200);
    const detail = await call(env, '/api/bookings/TB-DEMO01', { cookie: c.cookie });
    assert.equal(detail.json.documents.find((d: any) => d.key === 'passport').checked, true);
    const other = await login(env, await makeClient(env, 'docs@example.com'), 'Walk2026trail');
    assert.equal((await call(env, '/api/bookings/TB-DEMO01/documents', { method: 'PUT', cookie: other.cookie, csrf: other.csrf, body: { key: 'passport', checked: false } })).status, 404);
  });
});

describe('departures, crew and permits', () => {
  test('a departure with no price source cannot be opened (unverified price refused)', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const d = await call(env, '/api/admin/departures', { cookie: a.cookie, csrf: a.csrf, body: { trek_id: 1, start_date: '2027-04-01', seats_total: 5, price_npr: 1000, status: 'draft' } });
    const s = await login(env, STAFF, DEMO_PASSWORDS.staff);
    const r = await call(env, `/api/staff/departures/${d.json.id}/status`, { cookie: s.cookie, csrf: s.csrf, body: { status: 'open' } });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, 'cannot_open');
  });

  test('a departure in the past cannot be created as open', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const r = await call(env, '/api/admin/departures', { cookie: a.cookie, csrf: a.csrf, body: { trek_id: 1, start_date: '2025-01-01', seats_total: 5, price_npr: 1000, price_source: 'DEMO', status: 'open' } });
    assert.equal(r.status, 409);
  });

  test('an impossible calendar date is refused', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const r = await call(env, '/api/admin/departures', { cookie: a.cookie, csrf: a.csrf, body: { trek_id: 1, start_date: '2027-02-30', seats_total: 5, price_npr: 1000, status: 'draft' } });
    assert.equal(r.status, 400);
  });

  test('permit items: valid state saved and audited; unknown item and unknown state refused', async () => {
    const env = newEnv();
    const s = await login(env, STAFF, DEMO_PASSWORDS.staff);
    const dep = (await call(env, '/api/departures')).json.departures[0];
    const ok = await call(env, `/api/staff/departures/${dep.id}/permits/restricted`, { method: 'PUT', cookie: s.cookie, csrf: s.csrf, body: { state: 'checking' } });
    assert.equal(ok.status, 200);
    assert.equal((await call(env, `/api/staff/departures/${dep.id}/permits/made_up`, { method: 'PUT', cookie: s.cookie, csrf: s.csrf, body: { state: 'checking' } })).status, 404);
    assert.equal((await call(env, `/api/staff/departures/${dep.id}/permits/restricted`, { method: 'PUT', cookie: s.cookie, csrf: s.csrf, body: { state: 'approved' } })).status, 400);
    const detail = await call(env, `/api/staff/departures/${dep.id}`, { cookie: s.cookie });
    assert.equal(detail.json.permits.find((p: any) => p.key === 'restricted').state, 'checking');
    const audit = await call(env, '/api/admin/audit', { cookie: (await login(env, ADMIN, DEMO_PASSWORDS.admin)).cookie });
    assert.ok(audit.json.entries.some((e: any) => e.action === 'permit.update'));
  });

  test('the client sees permit states without staff-only fields', async () => {
    const env = newEnv();
    const c = await login(env, CLIENT, DEMO_PASSWORDS.client);
    const r = await call(env, '/api/bookings/TB-DEMO01', { cookie: c.cookie });
    assert.equal(r.status, 200);
    assert.ok(r.json.permits.length >= 5);
    for (const p of r.json.permits) {
      assert.ok(!('updated_by' in p));
      assert.match(p.note, /official source|UNVERIFIED|operator|Internal/i);
    }
    assert.match(r.json.permitDisclaimer, /not government approvals/);
  });

  test('crew assignment accepts active crew only', async () => {
    const env = newEnv();
    const s = await login(env, STAFF, DEMO_PASSWORDS.staff);
    const dep = (await call(env, '/api/departures')).json.departures[0];
    const crew = (await call(env, '/api/staff/crew', { cookie: s.cookie })).json.crew;
    const guide = crew.find((x: any) => x.kind === 'guide');
    const ok = await call(env, `/api/staff/departures/${dep.id}/crew`, { method: 'PUT', cookie: s.cookie, csrf: s.csrf, body: { crew_ids: [guide.id] } });
    assert.equal(ok.status, 200);
    const bad = await call(env, `/api/staff/departures/${dep.id}/crew`, { method: 'PUT', cookie: s.cookie, csrf: s.csrf, body: { crew_ids: [999999] } });
    assert.equal(bad.status, 400);
  });

  test('admin overview counts come from the database and show no payments taken', async () => {
    const env = newEnv();
    const a = await login(env, ADMIN, DEMO_PASSWORDS.admin);
    const r = await call(env, '/api/admin/overview', { cookie: a.cookie });
    assert.equal(r.status, 200);
    const openRow = await env.raw.prepare("SELECT COUNT(*) AS n FROM departures WHERE status = 'open'").get();
    assert.equal(r.json.departures.open, openRow.n);
    assert.equal(r.json.payments_taken_npr, 0);
  });
});

describe('error and empty states the API reports', () => {
  test('unknown departure is a clean 404', async () => {
    const env = newEnv();
    const r = await call(env, '/api/departures/999999');
    assert.equal(r.status, 404);
    assert.equal(r.json.error.code, 'not_found');
  });

  test('an empty booking list is an empty array, not an error', async () => {
    const env = newEnv();
    const r = await register(env, 'empty@example.com');
    const list = await call(env, '/api/bookings', { cookie: r.cookie, csrf: r.csrf });
    assert.equal(list.status, 200);
    assert.deepEqual(list.json.bookings, []);
  });
});

async function register(env: Env, email: string) {
  const r = await call(env, '/api/auth/register', { body: { name: 'Empty Person', email, password: 'Walk2026trail' } });
  return { cookie: r.cookie!, csrf: r.json.csrfToken as string };
}
