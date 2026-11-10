import type { D1Like } from './d1.ts';
import { ApiError, errorResponse, json, readJson, str, int, bool, oneOf, withSecurityHeaders } from './http.ts';
import { hashPassword, verifyPassword, randomToken, sha256Hex, bookingReference } from './crypto.ts';
import { ensureSchema, seedDemo } from './schema.ts';
import * as R from '../../shared/rules.ts';

export interface Env {
  DB: D1Like;
  ASSETS: { fetch(req: Request): Promise<Response> };
  DEMO_MODE?: string; // 'off' disables the one-tap demo sign-in
}

const SESSION_COOKIE = '__Host-tb_session';
const SESSION_SECONDS = 12 * 3600;
const MAX_BODY = 8192;

interface User { id: number; email: string; name: string; role: R.Role; csrf: string | null }

interface Ctx {
  req: Request;
  url: URL;
  env: Env;
  db: D1Like;
  now: Date;
  nowIso: string;
  today: string;
  params: string[];
  user: User | null;
}

type Handler = (ctx: Ctx) => Promise<Response>;

const readyMap = new WeakMap<object, Promise<void>>();

/** Nepal is UTC+05:45 with no daylight saving. */
export function nepalDate(now: Date): string {
  return new Date(now.getTime() + 5.75 * 3600_000).toISOString().slice(0, 10);
}

function ready(env: Env, now: Date): Promise<void> {
  let p = readyMap.get(env.DB);
  if (!p) {
    p = (async () => {
      await ensureSchema(env.DB);
      await seedDemo(env.DB, nepalDate(now), now.toISOString());
    })();
    readyMap.set(env.DB, p);
    p.catch(() => readyMap.delete(env.DB));
  }
  return p;
}

function log(event: string, fields: Record<string, unknown>): void {
  // Structured JSON logs. Never emails, passwords, tokens or phone numbers.
  console.log(JSON.stringify({ t: new Date().toISOString(), svc: 'trailbook', event, ...fields }));
}

async function rateLimit(db: D1Like, bucket: string, limit: number, windowSeconds: number, now: Date): Promise<void> {
  const nowS = Math.floor(now.getTime() / 1000);
  const windowStart = nowS - (nowS % windowSeconds);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         hits = CASE WHEN rate_limits.window_start < ? THEN 1 ELSE rate_limits.hits + 1 END,
         window_start = CASE WHEN rate_limits.window_start < ? THEN ? ELSE rate_limits.window_start END
       RETURNING hits`,
    )
    .bind(bucket, windowStart, windowStart, windowStart, windowStart)
    .first<{ hits: number }>();
  if (row && row.hits > limit) {
    throw new ApiError(429, 'rate_limited', 'Too many attempts. Wait a few minutes and try again.', { retry_after_seconds: windowSeconds });
  }
}

function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function currentUser(ctx: Omit<Ctx, 'user'>): Promise<User | null> {
  const token = readCookie(ctx.req, SESSION_COOKIE);
  if (!token) return null;
  const row = await ctx.db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, s.csrf_token
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.suspended = 0`,
    )
    .bind(await sha256Hex(token), ctx.nowIso)
    .first<{ id: number; email: string; name: string; role: R.Role; csrf_token: string }>();
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, csrf: row.csrf_token };
}

function need(ctx: Ctx, roles?: R.Role[]): User {
  if (!ctx.user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  if (roles && !roles.includes(ctx.user.role)) throw new ApiError(403, 'forbidden', 'Your account cannot do this.');
  return ctx.user;
}

const isStaff = (u: User) => u.role === 'staff' || u.role === 'admin';

function publicUser(u: { id: number; email: string; name: string; role: R.Role }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

function auditStmt(db: D1Like, ctx: Ctx, action: string, entity: string, entityId: string | number, detail: unknown) {
  return db
    .prepare('INSERT INTO audit_log (actor_user_id, actor_role, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(ctx.user?.id ?? null, ctx.user?.role ?? 'anonymous', action, entity, String(entityId), JSON.stringify(detail ?? {}), ctx.nowIso);
}

function mapWriteError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('departure_not_open')) throw new ApiError(409, 'departure_not_open', 'This departure is not open for booking.');
  if (msg.includes('seats_held <= seats_total')) throw new ApiError(409, 'not_enough_seats', 'Not enough seats left for that many travellers.');
  if (msg.includes('seats_held >= 0')) throw new ApiError(409, 'conflict', 'The seat count changed. Refresh and try again.');
  throw err;
}

// ---------- auth ----------

async function startSession(ctx: Ctx, userId: number): Promise<{ token: string; csrf: string }> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expires = new Date(ctx.now.getTime() + SESSION_SECONDS * 1000).toISOString();
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(ctx.nowIso),
    ctx.db
      .prepare('INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256Hex(token), userId, csrf, ctx.nowIso, expires),
  ]);
  return { token, csrf };
}

async function userRowById(db: D1Like, id: number) {
  return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(id).first<{ id: number; email: string; name: string; role: R.Role }>();
}

async function register(ctx: Ctx): Promise<Response> {
  const ip = clientIp(ctx.req);
  await rateLimit(ctx.db, `register:${ip}`, 5, 3600, ctx.now);
  const body = await readJson(ctx.req, MAX_BODY);
  const name = str(body, 'name', { min: 2, max: 80 })!;
  const email = str(body, 'email', { max: 254 })!.toLowerCase();
  const password = str(body, 'password', { max: 200 })!;
  const phone = str(body, 'phone', { max: 20, optional: true });
  if (!R.isValidEmail(email)) throw new ApiError(400, 'invalid_input', 'Enter a valid email address.', { field: 'email' });
  const pw = R.passwordProblem(password);
  if (pw) throw new ApiError(400, 'invalid_input', pw, { field: 'password' });
  if (phone && !R.isValidNepalPhone(phone)) throw new ApiError(400, 'invalid_input', 'Enter a Nepal mobile number, for example +977 98XXXXXXXX.', { field: 'phone' });
  const exists = await ctx.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new ApiError(409, 'email_taken', 'That email already has an account. Sign in instead.');
  // Role is always 'client' here. Staff and admin roles are set only by an admin, on the server.
  const created = await ctx.db
    .prepare('INSERT INTO users (email, name, phone, role, password_hash, suspended, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?) RETURNING id')
    .bind(email, name, phone, 'client', await hashPassword(password), ctx.nowIso)
    .first<{ id: number }>();
  const s = await startSession(ctx, created!.id);
  log('auth.register', { user: created!.id });
  const user = (await userRowById(ctx.db, created!.id))!;
  return json({ user: publicUser(user!), csrfToken: s.csrf }, 201, { 'Set-Cookie': sessionCookie(s.token, SESSION_SECONDS) });
}

async function login(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req, MAX_BODY);
  const email = str(body, 'email', { max: 254 })!.toLowerCase();
  const password = str(body, 'password', { max: 200 })!;
  await rateLimit(ctx.db, `login:ip:${clientIp(ctx.req)}`, 20, 900, ctx.now);
  await rateLimit(ctx.db, `login:acct:${await sha256Hex(email)}`, 8, 900, ctx.now);
  const row = await ctx.db
    .prepare('SELECT id, email, name, role, password_hash, suspended FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; email: string; name: string; role: R.Role; password_hash: string; suspended: number }>();
  // Same answer for unknown email, wrong password and suspended account.
  const ok = row ? await verifyPassword(password, row.password_hash) : false;
  if (!row || !ok || row.suspended) {
    log('auth.login_failed', {});
    throw new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.');
  }
  const s = await startSession(ctx, row.id);
  log('auth.login', { user: row.id });
  return json({ user: publicUser(row), csrfToken: s.csrf }, 200, { 'Set-Cookie': sessionCookie(s.token, SESSION_SECONDS) });
}

async function logout(ctx: Ctx): Promise<Response> {
  const token = readCookie(ctx.req, SESSION_COOKIE);
  if (token) await ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

async function demoLogin(ctx: Ctx): Promise<Response> {
  if (ctx.env.DEMO_MODE === 'off') throw new ApiError(404, 'not_found', 'Not found.');
  await rateLimit(ctx.db, `demo:ip:${clientIp(ctx.req)}`, 30, 900, ctx.now);
  const body = await readJson(ctx.req, MAX_BODY);
  const role = oneOf(body, 'role', R.ROLES);
  // Only seeded DEMO accounts can be reached this way; a real account is never signed in by role name.
  const row = await ctx.db
    .prepare('SELECT id, email, name, role FROM users WHERE is_demo = 1 AND role = ? AND suspended = 0 ORDER BY id LIMIT 1')
    .bind(role)
    .first<{ id: number; email: string; name: string; role: R.Role }>();
  if (!row) throw new ApiError(404, 'not_found', 'That demo account is not available.');
  const s = await startSession(ctx, row.id);
  return json({ user: publicUser(row), csrfToken: s.csrf }, 200, { 'Set-Cookie': sessionCookie(s.token, SESSION_SECONDS) });
}

async function me(ctx: Ctx): Promise<Response> {
  return json({
    user: ctx.user ? publicUser(ctx.user) : null,
    csrfToken: ctx.user?.csrf ?? null,
    demoMode: ctx.env.DEMO_MODE !== 'off',
  });
}

// ---------- catalogue (public) ----------

async function listTreks(ctx: Ctx): Promise<Response> {
  const rows = await ctx.db
    .prepare('SELECT id, name, region, days, max_altitude_m, summary, restricted_area, is_demo FROM treks ORDER BY name')
    .all();
  return json({ treks: rows.results });
}

async function listDepartures(ctx: Ctx): Promise<Response> {
  const region = ctx.url.searchParams.get('region');
  const rows = await ctx.db
    .prepare(
      `SELECT d.id, d.start_date, d.seats_total, d.seats_held, d.price_npr, d.price_source, d.is_demo,
              t.id AS trek_id, t.name AS trek_name, t.region, t.days, t.restricted_area
         FROM departures d JOIN treks t ON t.id = d.trek_id
        WHERE d.status = 'open' AND d.start_date >= ? AND (? IS NULL OR t.region = ?)
        ORDER BY d.start_date, d.id`,
    )
    .bind(ctx.today, region, region)
    .all<Record<string, unknown> & { seats_total: number; seats_held: number }>();
  const departures = rows.results.map(({ seats_held, seats_total, ...rest }) => ({
    ...rest,
    seats_total,
    seats_open: R.seatsOpen(seats_total, seats_held),
  }));
  return json({ departures });
}

async function getDeparture(ctx: Ctx): Promise<Response> {
  const id = Number(ctx.params[0]);
  const row = await ctx.db
    .prepare(
      `SELECT d.id, d.start_date, d.seats_total, d.seats_held, d.price_npr, d.price_source, d.status, d.is_demo,
              t.id AS trek_id, t.name AS trek_name, t.region, t.days, t.max_altitude_m, t.summary, t.itinerary, t.restricted_area
         FROM departures d JOIN treks t ON t.id = d.trek_id WHERE d.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown> & { seats_total: number; seats_held: number; status: string; itinerary: string }>();
  // Drafts and cancelled departures are staff-only.
  if (!row || row.status === 'draft' || (row.status === 'cancelled' && !(ctx.user && isStaff(ctx.user)))) {
    throw new ApiError(404, 'not_found', 'Departure not found.');
  }
  const { seats_held, seats_total, itinerary, ...rest } = row;
  return json({
    departure: { ...rest, seats_total, seats_open: R.seatsOpen(seats_total, seats_held), itinerary: JSON.parse(itinerary) },
    bookable: row.status === 'open' && String(row.start_date) >= ctx.today,
  });
}

// ---------- bookings (client and any signed-in user for their own) ----------

async function createBooking(ctx: Ctx): Promise<Response> {
  const user = need(ctx);
  await rateLimit(ctx.db, `booking:user:${user.id}`, 15, 3600, ctx.now);
  const body = await readJson(ctx.req, MAX_BODY);
  const departureId = int(body, 'departure_id', 1, 2_000_000_000);
  const travellers = int(body, 'travellers', 1, R.MAX_TRAVELLERS);
  const contactName = str(body, 'contact_name', { min: 2, max: 80 })!;
  const contactPhone = str(body, 'contact_phone', { max: 20 })!;
  const notes = str(body, 'notes', { max: 500, optional: true });
  if (!R.isValidNepalPhone(contactPhone)) throw new ApiError(400, 'invalid_input', 'Enter a Nepal mobile number, for example +977 98XXXXXXXX.', { field: 'contact_phone' });
  const dep = await ctx.db
    .prepare("SELECT id, price_npr, start_date, status FROM departures WHERE id = ? AND status = 'open' AND start_date >= ?")
    .bind(departureId, ctx.today)
    .first<{ id: number; price_npr: number; start_date: string; status: string }>();
  if (!dep) throw new ApiError(409, 'departure_not_open', 'This departure is not open for booking.');
  const total = R.bookingTotal(dep.price_npr, travellers); // server-side price only
  let reference = bookingReference();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // One batch: the booking row's triggers hold the seats and refuse a closed departure or overflow.
      await ctx.db.batch([
        ctx.db
          .prepare(
            `INSERT INTO bookings (reference, departure_id, user_id, travellers, status, total_npr, contact_name, contact_phone, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)`,
          )
          .bind(reference, dep.id, user.id, travellers, total, contactName, contactPhone, notes, ctx.nowIso, ctx.nowIso),
        ctx.db
          .prepare(
            `INSERT INTO booking_events (booking_id, from_status, to_status, actor_user_id, note, created_at)
             SELECT id, NULL, 'requested', ?, 'Booking requested', ? FROM bookings WHERE reference = ?`,
          )
          .bind(user.id, ctx.nowIso, reference),
      ]);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('bookings.reference') && attempt < 2) {
        reference = bookingReference();
        continue;
      }
      mapWriteError(err);
    }
  }
  log('booking.create', { departure: dep.id, travellers });
  const created = await ctx.db.prepare('SELECT reference, status, travellers, total_npr FROM bookings WHERE reference = ?').bind(reference).first();
  return json({ booking: created }, 201);
}

async function myBookings(ctx: Ctx): Promise<Response> {
  const user = need(ctx);
  const rows = await ctx.db
    .prepare(
      `SELECT b.reference, b.status, b.travellers, b.total_npr, b.created_at, d.start_date, t.name AS trek_name, t.region
         FROM bookings b JOIN departures d ON d.id = b.departure_id JOIN treks t ON t.id = d.trek_id
        WHERE b.user_id = ? ORDER BY d.start_date, b.id`,
    )
    .bind(user.id)
    .all();
  return json({ bookings: rows.results });
}

async function loadBooking(db: D1Like, reference: string) {
  return db
    .prepare(
      `SELECT b.id, b.reference, b.user_id, b.departure_id, b.travellers, b.status, b.total_npr, b.contact_name, b.contact_phone, b.notes,
              b.created_at, b.updated_at, d.start_date, d.status AS departure_status, d.price_npr, t.name AS trek_name, t.region, t.restricted_area
         FROM bookings b JOIN departures d ON d.id = b.departure_id JOIN treks t ON t.id = d.trek_id
        WHERE b.reference = ?`,
    )
    .bind(reference)
    .first<Record<string, unknown> & { id: number; user_id: number; departure_id: number; status: R.BookingStatus; start_date: string; travellers: number }>();
}

async function getBooking(ctx: Ctx): Promise<Response> {
  const user = need(ctx);
  const b = await loadBooking(ctx.db, ctx.params[0]);
  if (!b || (b.user_id !== user.id && !isStaff(user))) throw new ApiError(404, 'not_found', 'Booking not found.');
  const permits = await ctx.db
    .prepare('SELECT item_key, state FROM departure_permits WHERE departure_id = ?')
    .bind(b.departure_id)
    .all<{ item_key: string; state: R.PermitState }>();
  const permitState = new Map(permits.results.map((p) => [p.item_key, p.state]));
  const docs = await ctx.db
    .prepare('SELECT item_key, checked FROM booking_document_checks WHERE booking_id = ?')
    .bind(b.id)
    .all<{ item_key: string; checked: number }>();
  const docState = new Map(docs.results.map((d) => [d.item_key, d.checked === 1]));
  const { id, user_id, departure_id, ...visible } = b;
  void id; void user_id; void departure_id;
  return json({
    booking: visible,
    permits: R.PERMIT_TEMPLATE.map((p) => ({
      key: p.key,
      label: p.label,
      state: permitState.get(p.key) ?? 'not_started',
      note: p.note,
    })),
    documents: R.TRAVELLER_DOCS.map((d) => ({ key: d.key, label: d.label, checked: docState.get(d.key) === true })),
    permitDisclaimer: 'Permit states are the operator\u2019s own checks. They are not government approvals. Check the current official source.',
  });
}

async function cancelBooking(ctx: Ctx): Promise<Response> {
  const user = need(ctx);
  const b = await loadBooking(ctx.db, ctx.params[0]);
  if (!b || b.user_id !== user.id) throw new ApiError(404, 'not_found', 'Booking not found.');
  const rule = R.clientMayCancel(b.status, b.start_date, ctx.today);
  if (!rule.ok) throw new ApiError(409, 'not_cancellable', rule.reason!);
  try {
    await ctx.db.batch([
      ctx.db
        .prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = ?")
        .bind(ctx.nowIso, b.id, b.status),
      ctx.db
        .prepare(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_user_id, note, created_at)
           SELECT id, ?, 'cancelled', ?, 'Cancelled by client', ? FROM bookings WHERE id = ? AND changes() > 0`,
        )
        .bind(b.status, user.id, ctx.nowIso, b.id),
    ]);
  } catch (err) {
    mapWriteError(err);
  }
  log('booking.cancel', { booking: b.id });
  return json({ ok: true, status: 'cancelled' });
}

async function setDocument(ctx: Ctx): Promise<Response> {
  const user = need(ctx);
  const b = await loadBooking(ctx.db, ctx.params[0]);
  if (!b || b.user_id !== user.id) throw new ApiError(404, 'not_found', 'Booking not found.');
  if (b.status === 'cancelled' || b.status === 'completed') throw new ApiError(409, 'closed', 'This booking is closed.');
  const body = await readJson(ctx.req, MAX_BODY);
  const key = oneOf(body, 'key', R.TRAVELLER_DOCS.map((d) => d.key) as string[]);
  const checked = bool(body, 'checked');
  await ctx.db
    .prepare(
      `INSERT INTO booking_document_checks (booking_id, item_key, checked, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(booking_id, item_key) DO UPDATE SET checked = excluded.checked, updated_at = excluded.updated_at`,
    )
    .bind(b.id, key, checked ? 1 : 0, ctx.nowIso)
    .run();
  return json({ ok: true, key, checked });
}

// ---------- staff operations ----------

async function staffDepartures(ctx: Ctx): Promise<Response> {
  need(ctx, ['staff', 'admin']);
  const rows = await ctx.db
    .prepare(
      `SELECT d.id, d.start_date, d.seats_total, d.seats_held, d.price_npr, d.price_source, d.status, d.is_demo,
              t.name AS trek_name, t.region, t.restricted_area,
              (SELECT COUNT(*) FROM bookings b WHERE b.departure_id = d.id AND b.status = 'requested') AS requested_count,
              (SELECT COUNT(*) FROM bookings b WHERE b.departure_id = d.id AND b.status = 'confirmed') AS confirmed_count,
              (SELECT COUNT(*) FROM departure_crew c WHERE c.departure_id = d.id) AS crew_count
         FROM departures d JOIN treks t ON t.id = d.trek_id
        ORDER BY d.start_date, d.id`,
    )
    .all();
  return json({ departures: rows.results });
}

async function staffDeparture(ctx: Ctx): Promise<Response> {
  need(ctx, ['staff', 'admin']);
  const id = Number(ctx.params[0]);
  const dep = await ctx.db
    .prepare(
      `SELECT d.*, t.name AS trek_name, t.region, t.days, t.restricted_area, t.itinerary
         FROM departures d JOIN treks t ON t.id = d.trek_id WHERE d.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!dep) throw new ApiError(404, 'not_found', 'Departure not found.');
  const bookings = await ctx.db
    .prepare(
      `SELECT b.id, b.reference, b.status, b.travellers, b.total_npr, b.contact_name, b.contact_phone, b.notes, b.updated_at
         FROM bookings b WHERE b.departure_id = ? ORDER BY b.status, b.id`,
    )
    .bind(id)
    .all();
  const crew = await ctx.db.prepare('SELECT id, name, kind, active FROM crew_members WHERE active = 1 ORDER BY kind, name').all();
  const assigned = await ctx.db.prepare('SELECT crew_id FROM departure_crew WHERE departure_id = ?').bind(id).all<{ crew_id: number }>();
  const permits = await ctx.db.prepare('SELECT item_key, state, updated_at FROM departure_permits WHERE departure_id = ?').bind(id).all<{ item_key: string; state: string; updated_at: string }>();
  const pm = new Map(permits.results.map((p) => [p.item_key, p]));
  return json({
    departure: { ...dep, itinerary: JSON.parse(String(dep.itinerary)) },
    bookings: bookings.results,
    crew: crew.results,
    assignedCrewIds: assigned.results.map((a) => a.crew_id),
    permits: R.PERMIT_TEMPLATE.map((p) => ({
      key: p.key,
      label: p.label,
      note: p.note,
      state: (pm.get(p.key)?.state as R.PermitState) ?? 'not_started',
      updated_at: pm.get(p.key)?.updated_at ?? null,
    })),
    states: R.PERMIT_STATES,
  });
}

async function setCrew(ctx: Ctx): Promise<Response> {
  const user = need(ctx, ['staff', 'admin']);
  const id = Number(ctx.params[0]);
  const body = await readJson(ctx.req, MAX_BODY);
  if (!Array.isArray(body.crew_ids) || body.crew_ids.length > 30 || !body.crew_ids.every((x) => Number.isInteger(x) && x > 0)) {
    throw new ApiError(400, 'invalid_input', 'crew_ids must be a list of crew ids.', { field: 'crew_ids' });
  }
  const ids = [...new Set(body.crew_ids as number[])];
  const dep = await ctx.db.prepare('SELECT id FROM departures WHERE id = ?').bind(id).first();
  if (!dep) throw new ApiError(404, 'not_found', 'Departure not found.');
  for (const cid of ids) {
    const ok = await ctx.db.prepare('SELECT id FROM crew_members WHERE id = ? AND active = 1').bind(cid).first();
    if (!ok) throw new ApiError(400, 'invalid_input', 'One of those crew members is not active.', { field: 'crew_ids' });
  }
  const stmts = [ctx.db.prepare('DELETE FROM departure_crew WHERE departure_id = ?').bind(id)];
  for (const cid of ids) stmts.push(ctx.db.prepare('INSERT INTO departure_crew (departure_id, crew_id) VALUES (?, ?)').bind(id, cid));
  stmts.push(auditStmt(ctx.db, ctx, 'crew.assign', 'departure', id, { crew_ids: ids }));
  await ctx.db.batch(stmts);
  log('staff.crew', { departure: id, by: user.id });
  return json({ ok: true, assignedCrewIds: ids });
}

async function setPermit(ctx: Ctx): Promise<Response> {
  const user = need(ctx, ['staff', 'admin']);
  const id = Number(ctx.params[0]);
  const key = ctx.params[1];
  if (!R.PERMIT_TEMPLATE.some((p) => p.key === key)) throw new ApiError(404, 'not_found', 'Checklist item not found.');
  const body = await readJson(ctx.req, MAX_BODY);
  const state = oneOf(body, 'state', R.PERMIT_STATES);
  const dep = await ctx.db.prepare('SELECT id FROM departures WHERE id = ?').bind(id).first();
  if (!dep) throw new ApiError(404, 'not_found', 'Departure not found.');
  await ctx.db.batch([
    ctx.db
      .prepare(
        `INSERT INTO departure_permits (departure_id, item_key, state, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(departure_id, item_key) DO UPDATE SET state = excluded.state, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .bind(id, key, state, user.id, ctx.nowIso),
    auditStmt(ctx.db, ctx, 'permit.update', 'departure', id, { item: key, state }),
  ]);
  return json({ ok: true, key, state });
}

async function setDepartureStatus(ctx: Ctx): Promise<Response> {
  need(ctx, ['staff', 'admin']);
  const id = Number(ctx.params[0]);
  const body = await readJson(ctx.req, MAX_BODY);
  const to = oneOf(body, 'status', R.DEPARTURE_STATUSES);
  const dep = await ctx.db
    .prepare('SELECT id, status, start_date, seats_total, seats_held, price_npr, price_source FROM departures WHERE id = ?')
    .bind(id)
    .first<{ id: number; status: string; start_date: string; seats_total: number; seats_held: number; price_npr: number; price_source: string | null }>();
  if (!dep) throw new ApiError(404, 'not_found', 'Departure not found.');
  if (to === 'open') {
    const check = R.canOpenDeparture(dep, ctx.today);
    if (!check.ok) throw new ApiError(409, 'cannot_open', check.reason!);
  }
  if (to === 'cancelled') {
    const active = await ctx.db
      .prepare("SELECT COUNT(*) AS n FROM bookings WHERE departure_id = ? AND status IN ('requested','confirmed')")
      .bind(id)
      .first<{ n: number }>();
    if (active && active.n > 0) {
      throw new ApiError(409, 'active_bookings', `Resolve ${active.n} active booking(s) before cancelling the departure.`);
    }
  }
  await ctx.db.batch([
    ctx.db.prepare('UPDATE departures SET status = ?, updated_at = ? WHERE id = ?').bind(to, ctx.nowIso, id),
    auditStmt(ctx.db, ctx, 'departure.status', 'departure', id, { from: dep.status, to }),
  ]);
  return json({ ok: true, status: to });
}

async function setBookingStatus(ctx: Ctx): Promise<Response> {
  const user = need(ctx, ['staff', 'admin']);
  const b = await loadBooking(ctx.db, ctx.params[0]);
  if (!b) throw new ApiError(404, 'not_found', 'Booking not found.');
  const body = await readJson(ctx.req, MAX_BODY);
  const to = oneOf(body, 'to', R.BOOKING_STATUSES);
  const note = str(body, 'note', { max: 300, optional: true });
  if (!R.canTransition(b.status, to)) {
    throw new ApiError(409, 'invalid_transition', `A booking cannot move from ${b.status} to ${to}.`, { from: b.status, to });
  }
  if (to === 'confirmed' && b.departure_status === 'cancelled') {
    throw new ApiError(409, 'departure_cancelled', 'This departure is cancelled.');
  }
  try {
    await ctx.db.batch([
      // Optimistic guard: only the state we read can move. Seat release happens in the database trigger.
      ctx.db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND status = ?').bind(to, ctx.nowIso, b.id, b.status),
      ctx.db
        .prepare(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_user_id, note, created_at)
           SELECT id, ?, ?, ?, ?, ? FROM bookings WHERE id = ? AND changes() > 0`,
        )
        .bind(b.status, to, user.id, note ?? `Set by ${user.role}`, ctx.nowIso, b.id),
      auditStmt(ctx.db, ctx, 'booking.status', 'booking', String(b.reference), { from: b.status, to }),
    ]);
  } catch (err) {
    mapWriteError(err);
  }
  return json({ ok: true, status: to });
}

async function staffCrew(ctx: Ctx): Promise<Response> {
  need(ctx, ['staff', 'admin']);
  const rows = await ctx.db.prepare('SELECT id, name, kind, active FROM crew_members ORDER BY kind, name').all();
  return json({ crew: rows.results });
}

// ---------- admin ----------

async function adminCreateTrek(ctx: Ctx): Promise<Response> {
  const user = need(ctx, ['admin']);
  const body = await readJson(ctx.req, MAX_BODY);
  const name = str(body, 'name', { min: 3, max: 120 })!;
  const region = str(body, 'region', { min: 2, max: 60 })!;
  const days = int(body, 'days', 1, 60);
  const maxAlt = body.max_altitude_m === undefined || body.max_altitude_m === null ? null : int(body, 'max_altitude_m', 0, 9000);
  const summary = str(body, 'summary', { min: 10, max: 600 })!;
  const restricted = body.restricted_area === undefined ? false : bool(body, 'restricted_area');
  if (!Array.isArray(body.itinerary) || body.itinerary.length > 40 || !body.itinerary.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 200)) {
    throw new ApiError(400, 'invalid_input', 'itinerary must be a list of short day lines.', { field: 'itinerary' });
  }
  const created = await ctx.db
    .prepare('INSERT INTO treks (name, region, days, max_altitude_m, summary, itinerary, restricted_area, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?) RETURNING id')
    .bind(name, region, days, maxAlt, summary, JSON.stringify(body.itinerary), restricted ? 1 : 0, ctx.nowIso)
    .first<{ id: number }>();
  await auditStmt(ctx.db, ctx, 'trek.create', 'trek', created!.id, { name }).run();
  void user;
  return json({ id: created!.id }, 201);
}

async function adminCreateDeparture(ctx: Ctx): Promise<Response> {
  need(ctx, ['admin']);
  const body = await readJson(ctx.req, MAX_BODY);
  const trekId = int(body, 'trek_id', 1, 2_000_000_000);
  const startDate = str(body, 'start_date', { max: 10 })!;
  if (R.parseIsoDate(startDate) === null) throw new ApiError(400, 'invalid_input', 'start_date must be YYYY-MM-DD.', { field: 'start_date' });
  const seats = int(body, 'seats_total', 1, 60);
  const price = int(body, 'price_npr', 0, 100_000_000);
  const priceSource = str(body, 'price_source', { max: 200, optional: true });
  const status = oneOf(body, 'status', ['draft', 'open'] as const);
  const trek = await ctx.db.prepare('SELECT id FROM treks WHERE id = ?').bind(trekId).first();
  if (!trek) throw new ApiError(400, 'invalid_input', 'That trek does not exist.', { field: 'trek_id' });
  if (status === 'open') {
    const check = R.canOpenDeparture({ price_npr: price, price_source: priceSource, seats_total: seats, start_date: startDate }, ctx.today);
    if (!check.ok) throw new ApiError(409, 'cannot_open', check.reason!);
  }
  const created = await ctx.db
    .prepare(
      `INSERT INTO departures (trek_id, start_date, seats_total, seats_held, price_npr, price_source, status, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, 0, ?, ?) RETURNING id`,
    )
    .bind(trekId, startDate, seats, price, priceSource, status, ctx.nowIso, ctx.nowIso)
    .first<{ id: number }>();
  await auditStmt(ctx.db, ctx, 'departure.create', 'departure', created!.id, { trek_id: trekId, start_date: startDate, status }).run();
  return json({ id: created!.id }, 201);
}

async function adminUpdateDeparture(ctx: Ctx): Promise<Response> {
  need(ctx, ['admin']);
  const id = Number(ctx.params[0]);
  const dep = await ctx.db
    .prepare('SELECT id, seats_total, seats_held, price_npr, price_source, start_date, status FROM departures WHERE id = ?')
    .bind(id)
    .first<{ id: number; seats_total: number; seats_held: number; price_npr: number; price_source: string | null; start_date: string; status: string }>();
  if (!dep) throw new ApiError(404, 'not_found', 'Departure not found.');
  const body = await readJson(ctx.req, MAX_BODY);
  const next = {
    seats_total: body.seats_total === undefined ? dep.seats_total : int(body, 'seats_total', 1, 60),
    price_npr: body.price_npr === undefined ? dep.price_npr : int(body, 'price_npr', 0, 100_000_000),
    price_source: body.price_source === undefined ? dep.price_source : str(body, 'price_source', { max: 200, optional: true }),
    start_date: body.start_date === undefined ? dep.start_date : str(body, 'start_date', { max: 10 })!,
  };
  if (R.parseIsoDate(next.start_date) === null) throw new ApiError(400, 'invalid_input', 'start_date must be YYYY-MM-DD.', { field: 'start_date' });
  if (next.seats_total < dep.seats_held) {
    throw new ApiError(409, 'not_enough_seats', `${dep.seats_held} seats are already held. Set seats to at least that.`);
  }
  try {
    await ctx.db.batch([
      ctx.db
        .prepare('UPDATE departures SET seats_total = ?, price_npr = ?, price_source = ?, start_date = ?, updated_at = ? WHERE id = ?')
        .bind(next.seats_total, next.price_npr, next.price_source, next.start_date, ctx.nowIso, id),
      auditStmt(ctx.db, ctx, 'departure.update', 'departure', id, { seats_total: next.seats_total, price_npr: next.price_npr, start_date: next.start_date }),
    ]);
  } catch (err) {
    mapWriteError(err);
  }
  return json({ ok: true });
}

async function adminCreateCrew(ctx: Ctx): Promise<Response> {
  need(ctx, ['admin']);
  const body = await readJson(ctx.req, MAX_BODY);
  const name = str(body, 'name', { min: 2, max: 80 })!;
  const kind = oneOf(body, 'kind', R.CREW_KINDS);
  const created = await ctx.db
    .prepare('INSERT INTO crew_members (name, kind, active, is_demo) VALUES (?, ?, 1, 0) RETURNING id')
    .bind(name, kind)
    .first<{ id: number }>();
  await auditStmt(ctx.db, ctx, 'crew.create', 'crew', created!.id, { kind }).run();
  return json({ id: created!.id }, 201);
}

async function adminOverview(ctx: Ctx): Promise<Response> {
  need(ctx, ['admin']);
  const count = async (sql: string, ...binds: unknown[]) => {
    const r = await ctx.db.prepare(sql).bind(...binds).first<{ n: number }>();
    return r?.n ?? 0;
  };
  return json({
    departures: {
      open: await count("SELECT COUNT(*) AS n FROM departures WHERE status = 'open'"),
      draft: await count("SELECT COUNT(*) AS n FROM departures WHERE status = 'draft'"),
      closed_or_cancelled: await count("SELECT COUNT(*) AS n FROM departures WHERE status IN ('closed','cancelled')"),
      upcoming_open: await count("SELECT COUNT(*) AS n FROM departures WHERE status = 'open' AND start_date >= ?", ctx.today),
    },
    bookings: {
      requested: await count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'requested'"),
      confirmed: await count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed'"),
      cancelled: await count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'cancelled'"),
      completed: await count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'completed'"),
    },
    users: {
      client: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'client'"),
      staff: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'staff'"),
      admin: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
    },
    demo_rows: await count('SELECT (SELECT COUNT(*) FROM departures WHERE is_demo = 1) + (SELECT COUNT(*) FROM users WHERE is_demo = 1) AS n'),
    payments_taken_npr: 0, // no payment provider is connected in this build
  });
}

async function adminUsers(ctx: Ctx): Promise<Response> {
  need(ctx, ['admin']);
  const rows = await ctx.db
    .prepare('SELECT id, email, name, role, suspended, is_demo, created_at FROM users ORDER BY id LIMIT 500')
    .all();
  return json({ users: rows.results });
}

async function adminSetRole(ctx: Ctx): Promise<Response> {
  const admin = need(ctx, ['admin']);
  const id = Number(ctx.params[0]);
  if (id === admin.id) throw new ApiError(409, 'self_change', 'You cannot change your own role here.');
  const body = await readJson(ctx.req, MAX_BODY);
  const role = oneOf(body, 'role', R.ROLES);
  const target = await ctx.db.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first<{ id: number; role: string }>();
  if (!target) throw new ApiError(404, 'not_found', 'User not found.');
  await ctx.db.batch([
    ctx.db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id),
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    auditStmt(ctx.db, ctx, 'user.role', 'user', id, { from: target.role, to: role }),
  ]);
  return json({ ok: true, role });
}

async function adminSetSuspended(ctx: Ctx): Promise<Response> {
  const admin = need(ctx, ['admin']);
  const id = Number(ctx.params[0]);
  if (id === admin.id) throw new ApiError(409, 'self_change', 'You cannot suspend your own account.');
  const body = await readJson(ctx.req, MAX_BODY);
  const suspended = bool(body, 'suspended');
  const target = await ctx.db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) throw new ApiError(404, 'not_found', 'User not found.');
  await ctx.db.batch([
    ctx.db.prepare('UPDATE users SET suspended = ? WHERE id = ?').bind(suspended ? 1 : 0, id),
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    auditStmt(ctx.db, ctx, 'user.suspended', 'user', id, { suspended }),
  ]);
  return json({ ok: true, suspended });
}

async function adminAudit(ctx: Ctx): Promise<Response> {
  need(ctx, ['admin']);
  const rows = await ctx.db
    .prepare('SELECT id, actor_role, action, entity, entity_id, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 100')
    .all();
  return json({ entries: rows.results });
}

// ---------- routing ----------

const ROUTES: Array<{ method: string; re: RegExp; h: Handler; mutating?: boolean }> = [
  { method: 'GET', re: /^\/api\/health$/, h: async () => json({ ok: true, service: 'trailbook' }) },
  { method: 'GET', re: /^\/api\/auth\/me$/, h: me },
  { method: 'POST', re: /^\/api\/auth\/register$/, h: register, mutating: true },
  { method: 'POST', re: /^\/api\/auth\/login$/, h: login, mutating: true },
  { method: 'POST', re: /^\/api\/auth\/logout$/, h: logout, mutating: true },
  { method: 'POST', re: /^\/api\/auth\/demo$/, h: demoLogin, mutating: true },
  { method: 'GET', re: /^\/api\/treks$/, h: listTreks },
  { method: 'GET', re: /^\/api\/departures$/, h: listDepartures },
  { method: 'GET', re: /^\/api\/departures\/(\d+)$/, h: getDeparture },
  { method: 'POST', re: /^\/api\/bookings$/, h: createBooking, mutating: true },
  { method: 'GET', re: /^\/api\/bookings$/, h: myBookings },
  { method: 'GET', re: /^\/api\/bookings\/(TB-[A-Z0-9]{6,12})$/, h: getBooking },
  { method: 'POST', re: /^\/api\/bookings\/(TB-[A-Z0-9]{6,12})\/cancel$/, h: cancelBooking, mutating: true },
  { method: 'PUT', re: /^\/api\/bookings\/(TB-[A-Z0-9]{6,12})\/documents$/, h: setDocument, mutating: true },
  { method: 'GET', re: /^\/api\/staff\/departures$/, h: staffDepartures },
  { method: 'GET', re: /^\/api\/staff\/departures\/(\d+)$/, h: staffDeparture },
  { method: 'PUT', re: /^\/api\/staff\/departures\/(\d+)\/crew$/, h: setCrew, mutating: true },
  { method: 'PUT', re: /^\/api\/staff\/departures\/(\d+)\/permits\/([a-z_]+)$/, h: setPermit, mutating: true },
  { method: 'POST', re: /^\/api\/staff\/departures\/(\d+)\/status$/, h: setDepartureStatus, mutating: true },
  { method: 'POST', re: /^\/api\/staff\/bookings\/(TB-[A-Z0-9]{6,12})\/status$/, h: setBookingStatus, mutating: true },
  { method: 'GET', re: /^\/api\/staff\/crew$/, h: staffCrew },
  { method: 'POST', re: /^\/api\/admin\/treks$/, h: adminCreateTrek, mutating: true },
  { method: 'POST', re: /^\/api\/admin\/departures$/, h: adminCreateDeparture, mutating: true },
  { method: 'PATCH', re: /^\/api\/admin\/departures\/(\d+)$/, h: adminUpdateDeparture, mutating: true },
  { method: 'POST', re: /^\/api\/admin\/crew$/, h: adminCreateCrew, mutating: true },
  { method: 'GET', re: /^\/api\/admin\/overview$/, h: adminOverview },
  { method: 'GET', re: /^\/api\/admin\/users$/, h: adminUsers },
  { method: 'PUT', re: /^\/api\/admin\/users\/(\d+)\/role$/, h: adminSetRole, mutating: true },
  { method: 'PUT', re: /^\/api\/admin\/users\/(\d+)\/suspended$/, h: adminSetSuspended, mutating: true },
  { method: 'GET', re: /^\/api\/admin\/audit$/, h: adminAudit },
];

export async function handleApi(req: Request, env: Env, now: Date): Promise<Response> {
  const started = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let status = 500;
  try {
    await ready(env, now);
    const match = ROUTES.map((r) => ({ r, m: r.method === req.method ? r.re.exec(path) : null }))
      .find((x) => x.m);
    const anyPath = ROUTES.some((r) => r.re.test(path));
    if (!match) {
      status = anyPath ? 405 : 404;
      throw new ApiError(status, anyPath ? 'method_not_allowed' : 'not_found', anyPath ? 'Method not allowed.' : 'Not found.');
    }
    if (match.r.mutating) {
      // Cross-site forms cannot set custom headers, and a foreign Origin is refused outright.
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) throw new ApiError(403, 'origin_refused', 'This request came from another site.');
      if (req.headers.get('x-trailbook-request') !== '1') throw new ApiError(403, 'csrf_header_missing', 'This request is missing its protection header.');
    }
    const base = { req, url, env, db: env.DB, now, nowIso: now.toISOString(), today: nepalDate(now), params: match.m!.slice(1) };
    const user = await currentUser(base);
    if (match.r.mutating && user && req.headers.get('x-csrf-token') !== user.csrf) {
      throw new ApiError(403, 'csrf_failed', 'Your session needs a refresh. Reload the page and try again.');
    }
    const res = await match.r.h({ ...base, user });
    status = res.status;
    return res;
  } catch (err) {
    if (err instanceof ApiError) {
      status = err.status;
      return errorResponse(err);
    }
    status = 500;
    log('error', { path, message: err instanceof Error ? err.message.slice(0, 200) : 'unknown' });
    return json({ error: { code: 'internal', message: 'Something went wrong on our side. Try again.' } }, 500);
  } finally {
    log('request', { method: req.method, path: path.startsWith('/api/') ? path.replace(/TB-[A-Z0-9]+/, 'TB-…') : '/page', status, ms: Date.now() - started });
  }
}

const KNOWN_ROUTES: RegExp[] = [
  /^\/$/, /^\/departures(\/\d+)?$/, /^\/(login|register|trips|staff|admin|terms|privacy)$/,
  /^\/trips\/TB-[A-Z0-9]{6,12}$/, /^\/staff\/departures\/\d+$/,
];

async function serveStatic(req: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  if (res.status !== 404) return res;
  // Single-page app: the root and extensionless routes (/departures/2) get the app shell; a missing file
  // with an extension (/missing.js) stays 404.
  const path = new URL(req.url).pathname;
  const last = path.split('/').pop() || '';
  const routeLike = last === '' || !last.includes('.');
  if ((req.method === 'GET' || req.method === 'HEAD') && routeLike) {
    const known = KNOWN_ROUTES.some((re) => re.test(path));
    const shell = await env.ASSETS.fetch(new Request(new URL('/app-shell.html', req.url), { method: 'GET' }));
    if (shell.status === 200) {
      // Unknown page routes get the app's own "not found" screen with a real 404 status.
      return new Response(req.method === 'HEAD' ? null : shell.body, {
        status: known ? 200 : 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
    }
  }
  return res;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return handleRequest(req, env, new Date());
  },
};

export async function handleRequest(req: Request, env: Env, now: Date): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
    return withSecurityHeaders(await handleApi(req, env, now), true);
  }
  return withSecurityHeaders(await serveStatic(req, env), false);
}
