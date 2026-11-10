export { formatNpr } from '../../shared/rules.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ISO date (YYYY-MM-DD) to "Sat 14 Nov 2026". Calendar arithmetic in UTC avoids time-zone drift. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function shortDay(iso: string): { day: string; month: string; year: string } {
  const [y, m, d] = iso.split('-').map(Number);
  return { day: String(d), month: MONTHS[m - 1], year: String(y) };
}

/** Today in Nepal, as YYYY-MM-DD. */
export function nepalToday(now = new Date()): string {
  return new Date(now.getTime() + 5.75 * 3600_000).toISOString().slice(0, 10);
}

export const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  draft: 'Draft',
  open: 'Open for booking',
  closed: 'Closed',
};

export const PERMIT_LABEL: Record<string, string> = {
  not_started: 'Not started',
  checking: 'Being checked',
  staff_checked: 'Staff checked',
  not_applicable: 'Not applicable',
};
