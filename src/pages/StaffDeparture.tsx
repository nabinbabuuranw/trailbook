import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, ErrorBox, Pill, Skeleton, useLoad } from '../components/ui';
import { api } from '../lib/api';
import { longDate, PERMIT_LABEL, STATUS_LABEL } from '../lib/format';

interface Booking { id: number; reference: string; status: string; travellers: number; total_npr: number; contact_name: string; contact_phone: string; notes: string | null; updated_at: string }
interface Permit { key: string; label: string; note: string; state: string; updated_at: string | null }
interface Crew { id: number; name: string; kind: string; active: number }
interface Detail {
  departure: { id: number; start_date: string; seats_total: number; seats_held: number; price_npr: number; price_source: string | null; status: string; trek_name: string; region: string; restricted_area: number };
  bookings: Booking[];
  crew: Crew[];
  assignedCrewIds: number[];
  permits: Permit[];
  states: string[];
}

const NEXT_BOOKING: Record<string, Array<[string, string]>> = {
  requested: [['confirmed', 'Confirm'], ['cancelled', 'Decline']],
  confirmed: [['completed', 'Mark completed'], ['cancelled', 'Cancel booking']],
  cancelled: [],
  completed: [],
};

export default function StaffDeparture() {
  const { id } = useParams();
  const { data, error, loading, retry, setData } = useLoad(() => api<Detail>(`/api/staff/departures/${id}`), [id]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [crewPick, setCrewPick] = useState<number[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <div className="wrap"><Skeleton rows={6} label="Loading departure" /></div>;
  if (error) return <div className="wrap"><ErrorBox error={error} retry={retry} /><p className="mt-4"><Link to="/staff" className="font-semibold">Back to departures</Link></p></div>;
  if (!data) return null;
  const d = data.departure;
  const picked = crewPick ?? data.assignedCrewIds;

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'ok', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'That did not save.' });
    } finally {
      setBusy(null);
    }
  };

  const reload = async () => setData(await api<Detail>(`/api/staff/departures/${id}`));

  const setBookingStatus = (ref: string, to: string) =>
    run(`b:${ref}`, async () => {
      await api(`/api/staff/bookings/${ref}/status`, { body: { to } });
      await reload();
    }, to === 'confirmed' ? 'Confirmed.' : 'Booking updated.');

  const setDepartureStatus = (status: string) =>
    run('status', async () => {
      await api(`/api/staff/departures/${id}/status`, { body: { status } });
      await reload();
    }, `Departure is now ${STATUS_LABEL[status] ?? status}.`);

  const saveCrew = () =>
    run('crew', async () => {
      await api(`/api/staff/departures/${id}/crew`, { method: 'PUT', body: { crew_ids: picked } });
      setCrewPick(null);
      await reload();
    }, 'Crew saved.');

  const setPermit = (key: string, state: string) =>
    run(`p:${key}`, async () => {
      await api(`/api/staff/departures/${id}/permits/${key}`, { method: 'PUT', body: { state } });
      await reload();
    }, 'Checklist item saved. This is the operator’s own check, not a government approval.');

  const seatsHeld = d.seats_held;
  const active = data.bookings.filter((b) => b.status === 'requested' || b.status === 'confirmed').length;

  return (
    <div className="wrap space-y-10">
      <header>
        <p className="eyebrow"><span className="blaze-mark" /> <Link to="/staff" className="text-stone">Operations</Link> / {d.region}</p>
        <h1 className="mt-3 text-[2.2rem] sm:text-[2.6rem]">{d.trek_name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-stone">
          <span>{longDate(d.start_date)}</span>
          <Pill tone={d.status === 'open' ? 'spruce' : d.status === 'cancelled' ? 'danger' : 'stone'}>{STATUS_LABEL[d.status] ?? d.status}</Pill>
          <span className="num">{seatsHeld} of {d.seats_total} seats held</span>
        </p>
      </header>

      {msg && <Alert kind={msg.kind === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

      <section aria-labelledby="status-h" className="panel">
        <h2 id="status-h" className="text-[1.5rem]">Departure status</h2>
        <p className="hint mt-1">Opening needs a named price source. Cancelling needs every booking resolved first.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['draft', 'open', 'closed', 'cancelled'].filter((s) => s !== d.status).map((s) => (
            <button key={s} className="btn btn-ghost btn-small" disabled={busy !== null} onClick={() => void setDepartureStatus(s)}>
              Set {STATUS_LABEL[s]?.toLowerCase()}
            </button>
          ))}
        </div>
        {!d.price_source && <p className="mt-3 text-[0.98rem] text-danger">No price source is recorded, so this departure cannot open.</p>}
      </section>

      <section aria-labelledby="bookings-h">
        <h2 id="bookings-h" className="text-[1.5rem]">Passengers and requests</h2>
        <p className="hint mt-1">Contact details are for this trip only. {active} active {active === 1 ? 'booking' : 'bookings'}.</p>
        {data.bookings.length === 0 ? (
          <p className="mt-4 text-stone">No bookings yet.</p>
        ) : (
          <ul className="ruled mt-4 list-none p-0">
            {data.bookings.map((b) => (
              <li key={b.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="font-semibold">{b.contact_name} <span className="font-normal text-stone">· {b.travellers} {b.travellers === 1 ? 'traveller' : 'travellers'}</span></p>
                  <p className="text-[0.95rem] text-stone"><span className="num">{b.reference}</span> · <span className="num">{b.contact_phone}</span> · <span className="num">NPR {b.total_npr.toLocaleString('en-US')}</span></p>
                  {b.notes && <p className="mt-1 text-[0.95rem]">Note: {b.notes}</p>}
                  <p className="mt-1"><Pill tone={b.status === 'confirmed' ? 'spruce' : b.status === 'requested' ? 'blaze' : 'stone'}>{STATUS_LABEL[b.status]}</Pill></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(NEXT_BOOKING[b.status] ?? []).map(([to, label]) => (
                    <button key={to} className={`btn btn-small ${to === 'confirmed' ? 'btn-spruce' : 'btn-ghost'}`} disabled={busy !== null} onClick={() => void setBookingStatus(b.reference, to)}>
                      {busy === `b:${b.reference}` ? 'Saving…' : label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="crew-h" className="panel">
        <h2 id="crew-h" className="text-[1.5rem]">Guide and porter assignment</h2>
        <p className="hint mt-1">Demo crew are placeholders. Assign active crew only.</p>
        <fieldset className="mt-4">
          <legend className="sr-only">Crew for this departure</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.crew.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-spruce-deep" checked={picked.includes(c.id)}
                    onChange={(e) => setCrewPick(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />
                  <span>{c.name} <span className="text-stone">({c.kind})</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <button className="btn btn-spruce btn-small mt-4" disabled={busy !== null || crewPick === null} onClick={() => void saveCrew()}>Save crew</button>
      </section>

      <section aria-labelledby="permits-h">
        <h2 id="permits-h" className="text-[1.5rem]">Permit checklist</h2>
        <p className="mt-2 border-t-4 border-slate bg-paper px-4 py-3 text-[0.98rem] text-stone">
          Setting an item to Staff checked means your team checked it against the current official source. It is not a permit approval.
        </p>
        <ul className="ruled mt-4 list-none p-0">
          {data.permits.map((p) => (
            <li key={p.key} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-semibold">{p.label}</p>
                <p className="text-[0.95rem] text-stone">{p.note}</p>
              </div>
              <label className="sr-only" htmlFor={`st-${p.key}`}>State for {p.label}</label>
              <select id={`st-${p.key}`} className="input md:w-[220px]" value={p.state} disabled={busy !== null}
                onChange={(e) => void setPermit(p.key, e.target.value)}>
                {data.states.map((s) => <option key={s} value={s}>{PERMIT_LABEL[s] ?? s}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
