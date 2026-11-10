import type { D1Like } from './d1.ts';
import { hashPassword } from './crypto.ts';

// Forward-only schema. Applied with CREATE IF NOT EXISTS on first request, so a fresh D1 is usable.
// The same statements are the migration record in api/migrations/0001_init.sql.
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
     phone TEXT,
     role TEXT NOT NULL CHECK (role IN ('client','staff','admin')),
     password_hash TEXT NOT NULL,
     suspended INTEGER NOT NULL DEFAULT 0 CHECK (suspended IN (0,1)),
     is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     csrf_token TEXT NOT NULL,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
     bucket TEXT PRIMARY KEY,
     hits INTEGER NOT NULL,
     window_start INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS treks (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE,
     region TEXT NOT NULL,
     days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 60),
     max_altitude_m INTEGER CHECK (max_altitude_m IS NULL OR max_altitude_m BETWEEN 0 AND 9000),
     summary TEXT NOT NULL,
     itinerary TEXT NOT NULL,
     restricted_area INTEGER NOT NULL DEFAULT 0 CHECK (restricted_area IN (0,1)),
     is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS departures (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     trek_id INTEGER NOT NULL REFERENCES treks(id),
     start_date TEXT NOT NULL,
     seats_total INTEGER NOT NULL CHECK (seats_total BETWEEN 1 AND 60),
     seats_held INTEGER NOT NULL DEFAULT 0 CHECK (seats_held >= 0),
     price_npr INTEGER NOT NULL CHECK (price_npr >= 0),
     price_source TEXT,
     status TEXT NOT NULL CHECK (status IN ('draft','open','closed','cancelled')),
     is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     CHECK (seats_held <= seats_total)
   )`,
  `CREATE INDEX IF NOT EXISTS departures_start ON departures(start_date, status)`,
  `CREATE TABLE IF NOT EXISTS crew_members (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('guide','porter')),
     active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
     is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1))
   )`,
  `CREATE TABLE IF NOT EXISTS departure_crew (
     departure_id INTEGER NOT NULL REFERENCES departures(id) ON DELETE CASCADE,
     crew_id INTEGER NOT NULL REFERENCES crew_members(id),
     PRIMARY KEY (departure_id, crew_id)
   )`,
  `CREATE TABLE IF NOT EXISTS departure_permits (
     departure_id INTEGER NOT NULL REFERENCES departures(id) ON DELETE CASCADE,
     item_key TEXT NOT NULL,
     state TEXT NOT NULL CHECK (state IN ('not_started','checking','staff_checked','not_applicable')),
     updated_by INTEGER REFERENCES users(id),
     updated_at TEXT NOT NULL,
     PRIMARY KEY (departure_id, item_key)
   )`,
  `CREATE TABLE IF NOT EXISTS bookings (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     reference TEXT NOT NULL UNIQUE,
     departure_id INTEGER NOT NULL REFERENCES departures(id),
     user_id INTEGER NOT NULL REFERENCES users(id),
     travellers INTEGER NOT NULL CHECK (travellers BETWEEN 1 AND 10),
     status TEXT NOT NULL CHECK (status IN ('requested','confirmed','cancelled','completed')),
     total_npr INTEGER NOT NULL CHECK (total_npr >= 0),
     contact_name TEXT NOT NULL,
     contact_phone TEXT NOT NULL,
     notes TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id)`,
  `CREATE INDEX IF NOT EXISTS bookings_departure ON bookings(departure_id, status)`,
  `CREATE TABLE IF NOT EXISTS booking_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
     from_status TEXT,
     to_status TEXT NOT NULL,
     actor_user_id INTEGER REFERENCES users(id),
     note TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS booking_document_checks (
     booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
     item_key TEXT NOT NULL,
     checked INTEGER NOT NULL CHECK (checked IN (0,1)),
     updated_at TEXT NOT NULL,
     PRIMARY KEY (booking_id, item_key)
   )`,
  `CREATE TRIGGER IF NOT EXISTS bookings_before_insert_open BEFORE INSERT ON bookings
     WHEN (SELECT status FROM departures WHERE id = NEW.departure_id) IS NOT 'open'
   BEGIN SELECT RAISE(ABORT, 'departure_not_open'); END`,
  `CREATE TRIGGER IF NOT EXISTS bookings_after_insert_hold AFTER INSERT ON bookings
     WHEN NEW.status IN ('requested','confirmed')
   BEGIN UPDATE departures SET seats_held = seats_held + NEW.travellers, updated_at = NEW.updated_at WHERE id = NEW.departure_id; END`,
  `CREATE TRIGGER IF NOT EXISTS bookings_after_status_release AFTER UPDATE OF status ON bookings
     WHEN OLD.status IN ('requested','confirmed') AND NEW.status IN ('cancelled','completed')
   BEGIN UPDATE departures SET seats_held = seats_held - OLD.travellers, updated_at = NEW.updated_at WHERE id = NEW.departure_id; END`,
  `CREATE TABLE IF NOT EXISTS audit_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     actor_user_id INTEGER REFERENCES users(id),
     actor_role TEXT NOT NULL,
     action TEXT NOT NULL,
     entity TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     detail TEXT,
     created_at TEXT NOT NULL
   )`,
];

export function addDays(isoDate: string, days: number): string {
  const t = Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export const DEMO_PASSWORDS = {
  client: 'DemoClient2026',
  staff: 'DemoStaff2026',
  admin: 'DemoAdmin2026',
} as const;

const DEMO_TREKS = [
  {
    name: 'Annapurna Base Camp (DEMO route)', region: 'Annapurna', days: 12, max: 4130, restricted: 0,
    summary: 'A DEMO route for testing the booking flow. Itinerary is illustrative, not a published operator plan.',
    itinerary: ['Pokhara to trailhead', 'Trail through the foothills', 'Village stays on the trail', 'Base camp viewpoint', 'Return to Pokhara'],
  },
  {
    name: 'Langtang Valley (DEMO route)', region: 'Langtang', days: 8, max: 3870, restricted: 0,
    summary: 'A DEMO route with village stays. Itinerary is illustrative.',
    itinerary: ['Drive to Syabrubesi', 'Valley walk', 'Upper valley camp', 'Return'],
  },
  {
    name: 'Upper Mustang (DEMO route, restricted area)', region: 'Mustang', days: 10, max: 3800, restricted: 1,
    summary: 'A DEMO route in a restricted area. The restricted-area permit item must be checked against the current official source before any booking is confirmed.',
    itinerary: ['Drive to Jomsom', 'Desert valley walk', 'Walled town visit', 'Return'],
  },
];

/** Seeds labelled DEMO data: treks, staff, crew, departures and one demo booking. Idempotent per part. */
export async function seedDemo(db: D1Like, today: string, nowIso: string): Promise<void> {
  const hasTreks = await db.prepare('SELECT COUNT(*) AS n FROM treks WHERE is_demo = 1').first<{ n: number }>();
  if (!hasTreks || hasTreks.n === 0) {
    const stmts = DEMO_TREKS.map((t) =>
      db.prepare(
        `INSERT INTO treks (name, region, days, max_altitude_m, summary, itinerary, restricted_area, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      ).bind(t.name, t.region, t.days, t.max, t.summary, JSON.stringify(t.itinerary), t.restricted, nowIso),
    );
    const crew = [
      ['Demo guide 1', 'guide'], ['Demo guide 2', 'guide'], ['Demo porter 1', 'porter'], ['Demo porter 2', 'porter'], ['Demo porter 3', 'porter'],
    ];
    for (const [name, kind] of crew) {
      stmts.push(db.prepare('INSERT INTO crew_members (name, kind, active, is_demo) VALUES (?, ?, 1, 1)').bind(name, kind));
    }
    const hashes = {
      client: await hashPassword(DEMO_PASSWORDS.client),
      staff: await hashPassword(DEMO_PASSWORDS.staff),
      admin: await hashPassword(DEMO_PASSWORDS.admin),
    };
    const users: Array<[string, string, string, string]> = [
      ['client@demo.trailbook.example', 'Demo Client', 'client', hashes.client],
      ['staff@demo.trailbook.example', 'Demo Staff', 'staff', hashes.staff],
      ['admin@demo.trailbook.example', 'Demo Admin', 'admin', hashes.admin],
    ];
    for (const [email, name, role, hash] of users) {
      stmts.push(
        db.prepare(
          'INSERT OR IGNORE INTO users (email, name, role, password_hash, suspended, is_demo, created_at) VALUES (?, ?, ?, ?, 0, 1, ?)',
        ).bind(email, name, role, hash, nowIso),
      );
    }
    await db.batch(stmts);
  }
  const future = await db.prepare('SELECT COUNT(*) AS n FROM departures WHERE is_demo = 1 AND start_date >= ?').bind(today).first<{ n: number }>();
  if (!future || future.n === 0) {
    const trekRows = await db.prepare('SELECT id, name FROM treks WHERE is_demo = 1 ORDER BY id').all<{ id: number; name: string }>();
    const plan: Array<[number, number, number, number]> = [
      // trek index into trekRows, days from today, seats, price NPR per person (DEMO)
      [0, 35, 12, 98000], [0, 70, 12, 98000], [1, 42, 10, 82000], [2, 56, 8, 125000],
    ];
    const stmts = plan.map(([ti, offset, seats, price]) => {
      const trek = trekRows.results[ti];
      return db.prepare(
        `INSERT INTO departures (trek_id, start_date, seats_total, seats_held, price_npr, price_source, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, 'DEMO (illustrative price, not a quote)', 'open', 1, ?, ?)`,
      ).bind(trek.id, addDays(today, offset), seats, price, nowIso, nowIso);
    });
    await db.batch(stmts);
    // One demo booking for the demo client on the first departure, so the client portal has something to show.
    const client = await db.prepare("SELECT id FROM users WHERE email = 'client@demo.trailbook.example'").first<{ id: number }>();
    const dep = await db.prepare('SELECT id FROM departures WHERE is_demo = 1 ORDER BY start_date LIMIT 1').first<{ id: number }>();
    const existing = await db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE reference = 'TB-DEMO01'").first<{ n: number }>();
    if (client && dep && existing && existing.n === 0) {
      await db.batch([
        db.prepare(
          `INSERT INTO bookings (reference, departure_id, user_id, travellers, status, total_npr, contact_name, contact_phone, notes, created_at, updated_at)
           VALUES ('TB-DEMO01', ?, ?, 2, 'confirmed', 196000, 'Demo Client', '+977 9800000000', 'DEMO booking', ?, ?)`,
        ).bind(dep.id, client.id, nowIso, nowIso),
        db.prepare(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_user_id, note, created_at)
           SELECT id, NULL, 'confirmed', NULL, 'DEMO seed', ? FROM bookings WHERE reference = 'TB-DEMO01'`,
        ).bind(nowIso),
      ]);
    }
  }
}

export async function ensureSchema(db: D1Like): Promise<void> {
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
}
