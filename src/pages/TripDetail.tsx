import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, ErrorBox, Pill, Skeleton, useLoad } from '../components/ui';
import { api, ApiFailure } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatNpr, longDate, nepalToday, PERMIT_LABEL, STATUS_LABEL } from '../lib/format';
import { clientMayCancel, type BookingStatus } from '../../shared/rules.ts';

interface TripData {
  booking: { reference: string; status: BookingStatus; travellers: number; total_npr: number; contact_name: string; contact_phone: string; notes: string | null; start_date: string; trek_name: string; region: string; departure_status: string; price_npr: number };
  permits: Array<{ key: string; label: string; state: string; note: string }>;
  documents: Array<{ key: string; label: string; checked: boolean }>;
  permitDisclaimer: string;
}

export default function TripDetail() {
  const { ref } = useParams();
  const { user } = useAuth();
  const { data, error, loading, retry, setData } = useLoad(() => api<TripData>(`/api/bookings/${ref}`), [ref]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (loading) return <div className="wrap"><Skeleton rows={5} label="Loading your trip" /></div>;
  if (error) {
    const nf = error instanceof ApiFailure && error.status === 404;
    return (
      <div className="wrap max-w-2xl">
        {nf ? <><h1 className="text-[2rem]">Trip not found</h1><p className="mt-3 text-stone"><Link to="/trips" className="font-semibold">Back to my trips</Link></p></> : <ErrorBox error={error} retry={retry} />}
      </div>
    );
  }
  if (!data) return null;
  const b = data.booking;
  const rule = clientMayCancel(b.status, b.start_date, nepalToday());
  // The server returns 404 to anyone who is not the owner or staff; the cancel button is shown to the owner client only.
  const canCancel = user?.role === 'client' && rule.ok;

  const setDocChecked = (key: string, checked: boolean) =>
    setData({ ...data, documents: data.documents.map((d) => (d.key === key ? { ...d, checked } : d)) });

  // Optimistic tick: shown at once, put back if the server refuses it.
  const toggle = async (key: string, checked: boolean) => {
    setMsg(null);
    setDocChecked(key, checked);
    try {
      await api(`/api/bookings/${ref}/documents`, { method: 'PUT', body: { key, checked } });
    } catch (e) {
      setDocChecked(key, !checked);
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save that tick.' });
    }
  };

  const cancel = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/bookings/${ref}/cancel`, { body: {} });
      setData({ ...data, booking: { ...b, status: 'cancelled' } });
      setMsg({ kind: 'ok', text: 'Cancelled. Your seats have been released.' });
      setConfirmCancel(false);
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'The booking could not be cancelled.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-10">
        <header>
          <p className="eyebrow"><span className="blaze-mark" /> Reference <span className="num">{b.reference}</span></p>
          <h1 className="mt-3 text-[2.2rem] sm:text-[2.7rem]">{b.trek_name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-stone">
            <Pill tone={b.status === 'confirmed' ? 'spruce' : b.status === 'cancelled' ? 'danger' : 'blaze'}>{STATUS_LABEL[b.status]}</Pill>
            <span>{longDate(b.start_date)} · {b.travellers} {b.travellers === 1 ? 'traveller' : 'travellers'}</span>
          </p>
          <p className="mt-3 text-[1.05rem]"><span className="font-semibold num">{formatNpr(b.total_npr)}</span> <span className="text-stone">total, DEMO price. No payment taken.</span></p>
        </header>

        {msg && <Alert kind={msg.kind === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

        <section aria-labelledby="docs-h">
          <h2 id="docs-h" className="text-[1.6rem]">Documents to bring</h2>
          <p className="hint mt-1">Tick what you have. Only you and your operator see these ticks.</p>
          {b.status === 'cancelled' || b.status === 'completed' ? (
            <p className="mt-4 text-stone">This booking is closed.</p>
          ) : (
            <ul className="ruled mt-4 list-none p-0">
              {data.documents.map((d) => (
                <li key={d.key}>
                  <label className="flex min-h-[52px] cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" className="h-5 w-5 accent-spruce-deep" checked={d.checked} onChange={(e) => void toggle(d.key, e.target.checked)} />
                    <span>{d.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="permits-h">
          <h2 id="permits-h" className="text-[1.6rem]">Permit checklist</h2>
          <p className="mt-2 border-t-4 border-slate bg-paper px-4 py-3 text-[0.98rem] text-stone">{data.permitDisclaimer}</p>
          <ul className="ruled mt-4 list-none p-0">
            {data.permits.map((p) => (
              <li key={p.key} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-4">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-[0.95rem] text-stone">{p.note}</p>
                </div>
                <div className="sm:justify-self-end"><Pill tone={p.state === 'staff_checked' ? 'spruce' : p.state === 'checking' ? 'blaze' : 'stone'}>{PERMIT_LABEL[p.state] ?? p.state}</Pill></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <section className="border-t-4 border-spruce bg-paper p-5">
          <h2 className="text-[1.3rem]">Your details on this trip</h2>
          <dl className="mt-3 space-y-2 text-[0.98rem]">
            <div><dt className="hint">Lead traveller</dt><dd className="font-semibold">{b.contact_name}</dd></div>
            <div><dt className="hint">Mobile</dt><dd className="num">{b.contact_phone}</dd></div>
            {b.notes && <div><dt className="hint">Notes</dt><dd>{b.notes}</dd></div>}
          </dl>
        </section>
        {canCancel && (
          <section className="space-y-3">
            {!confirmCancel ? (
              <button className="btn btn-ghost w-full" onClick={() => setConfirmCancel(true)}>Cancel this booking</button>
            ) : (
              <div className="border border-danger p-4 space-y-3">
                <p>Cancel {b.reference}? Your seats go back on sale straight away.</p>
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-small" disabled={busy} onClick={() => void cancel()}>{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
                  <button className="btn btn-ghost btn-small" onClick={() => setConfirmCancel(false)}>Keep booking</button>
                </div>
              </div>
            )}
          </section>
        )}
        {!rule.ok && (b.status === 'requested' || b.status === 'confirmed') && (
          <p className="hint">{rule.reason}</p>
        )}
      </aside>
    </div>
  );
}
