// Shared domain rules: used by the Worker, the tests and the browser. Pure functions, no I/O.
// All money is whole Nepali rupees (NPR). Dates are Gregorian YYYY-MM-DD.

export const ROLES = ['client', 'staff', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_STATUSES = ['requested', 'confirmed', 'cancelled', 'completed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const DEPARTURE_STATUSES = ['draft', 'open', 'closed', 'cancelled'] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const PERMIT_STATES = ['not_started', 'checking', 'staff_checked', 'not_applicable'] as const;
export type PermitState = (typeof PERMIT_STATES)[number];

export const CREW_KINDS = ['guide', 'porter'] as const;
export type CrewKind = (typeof CREW_KINDS)[number];

export const MAX_TRAVELLERS = 10;
export const MIN_PASSWORD_LENGTH = 10;
export const CLIENT_CANCEL_WINDOW_DAYS = 14; // DRAFT policy, not agreed with any operator

// Booking status machine. Keys are "from>to" pairs that a staff member may set.
const TRANSITIONS: Record<string, true> = {
  'requested>confirmed': true,
  'requested>cancelled': true,
  'confirmed>cancelled': true,
  'confirmed>completed': true,
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[`${from}>${to}`] === true;
}

/** Cancellation rule, written once. A client may cancel their own booking only while it is
 * requested or confirmed and the departure is at least CLIENT_CANCEL_WINDOW_DAYS away.
 * Staff may cancel any non-completed booking through canTransition. */
export function clientMayCancel(status: BookingStatus, startDate: string, today: string): { ok: boolean; reason?: string } {
  if (status !== 'requested' && status !== 'confirmed') return { ok: false, reason: 'This booking can no longer be cancelled.' };
  const days = daysBetween(today, startDate);
  if (days === null) return { ok: false, reason: 'The departure date is not valid.' };
  if (days < CLIENT_CANCEL_WINDOW_DAYS) {
    return { ok: false, reason: `Cancellations close ${CLIENT_CANCEL_WINDOW_DAYS} days before departure. Contact the operator.` };
  }
  return { ok: true };
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

export function parseIsoDate(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

/** Server-side total. The client never sends a price. */
export function bookingTotal(pricePerPersonNpr: number, travellers: number): number {
  return pricePerPersonNpr * travellers;
}

export function formatNpr(amount: number): string {
  return 'NPR ' + Math.round(amount).toLocaleString('en-US');
}

export function seatsOpen(seatsTotal: number, seatsHeld: number): number {
  return Math.max(0, seatsTotal - seatsHeld);
}

/** A departure may be opened for booking only with a named price source and at least one seat. */
export function canOpenDeparture(d: { price_npr: number; price_source: string | null; seats_total: number; start_date: string }, today: string): { ok: boolean; reason?: string } {
  if (!d.price_source || !d.price_source.trim()) return { ok: false, reason: 'Add the price source before opening: a rate sheet, a quote, or DEMO.' };
  if (!(d.price_npr > 0)) return { ok: false, reason: 'The price must be above zero NPR.' };
  if (!(d.seats_total > 0)) return { ok: false, reason: 'A departure needs at least one seat.' };
  const days = daysBetween(today, d.start_date);
  if (days === null) return { ok: false, reason: 'The start date is not valid.' };
  if (days < 0) return { ok: false, reason: 'The start date is in the past.' };
  return { ok: true };
}

/** Permit checklist template. Every government-facing item is marked for checking against the
 * current official source; nothing here is a verified requirement or a permit approval. */
export const PERMIT_TEMPLATE: ReadonlyArray<{ key: string; label: string; note: string }> = [
  { key: 'tims', label: 'TIMS card (trekkers\u2019 information management)', note: 'Check the current official source before travel. Fee and eligibility: UNVERIFIED here.' },
  { key: 'restricted', label: 'Restricted-area trekking permit', note: 'Only for routes that need it. Check the current official source. Whether this route needs it: UNVERIFIED here.' },
  { key: 'park', label: 'National park or conservation area entry', note: 'Check with the park or conservation area office. Fee and rules: UNVERIFIED here.' },
  { key: 'local', label: 'Local rural or municipal entry, where required', note: 'Check with the local municipal office on the route. UNVERIFIED here.' },
  { key: 'insurance', label: 'Travel insurance covering the highest altitude on the route', note: 'Operator requirement (DRAFT). Not a government requirement.' },
  { key: 'guide_record', label: 'Guide licence record for the assigned guide', note: 'Internal check by the operator. Not a government approval.' },
];

/** Traveller document checklist (client side). Information only. */
export const TRAVELLER_DOCS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'passport', label: 'Passport valid for the whole trip' },
  { key: 'photos', label: 'Passport-size photos' },
  { key: 'insurance', label: 'Travel insurance policy' },
  { key: 'medical', label: 'Medical conditions and medication listed to the operator' },
  { key: 'emergency', label: 'Emergency contact given to the operator' },
];

export function isValidEmail(s: string): boolean {
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function isValidNepalPhone(s: string): boolean {
  // Accepts +977 98XXXXXXXX, 98XXXXXXXX, 97XXXXXXXX, 01-XXXXXXX style landlines with digits and spaces/dashes.
  const t = s.replace(/[\s-]/g, '');
  return /^(\+977)?(9[78]\d{8}|0?1\d{7})$/.test(t);
}

export function passwordProblem(p: string): string | null {
  if (p.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (p.length > 200) return 'Use at most 200 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use both letters and numbers.';
  return null;
}
