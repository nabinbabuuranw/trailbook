import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Alert, ErrorBox, Pill, Skeleton, useLoad } from '../components/ui';
import { api, ApiFailure } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatNpr, longDate } from '../lib/format';
import { MAX_TRAVELLERS, isValidNepalPhone } from '../../shared/rules.ts';

interface Detail {
  departure: {
    id: number; start_date: string; seats_total: number; seats_open: number; price_npr: number; price_source: string;
    status: string; is_demo: number; trek_name: string; region: string; days: number; max_altitude_m: number | null;
    summary: string; itinerary: string[]; restricted_area: number;
  };
  bookable: boolean;
}

export default function DepartureDetail() {
  const { id } = useParams();
  const { data, error, loading, retry } = useLoad(() => api<Detail>(`/api/departures/${id}`), [id]);
  if (loading) return <div className="wrap"><Skeleton rows={5} label="Loading departure" /></div>;
  if (error) {
    const notFound = error instanceof ApiFailure && error.status === 404;
    return (
      <div className="wrap max-w-2xl">
        {notFound ? (
          <>
            <h1 className="text-[2rem]">Departure not found</h1>
            <p className="mt-3 text-stone">It may have been closed or removed. <Link to="/departures" className="font-semibold">See open departures</Link>.</p>
          </>
        ) : <ErrorBox error={error} retry={retry} />}
      </div>
    );
  }
  if (!data) return null;
  const d = data.departure;
  return (
    <div className="wrap grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <article>
        <p className="eyebrow"><span className="blaze-mark" /> {d.region}</p>
        <h1 className="mt-3 text-[2.3rem] sm:text-[2.9rem]">{d.trek_name}</h1>
        <p className="mt-3 text-[1.12rem] text-stone">{d.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {d.is_demo ? <Pill tone="blaze">Demo</Pill> : null}
          {d.restricted_area ? <Pill tone="slate">Restricted area: check the current official source before booking</Pill> : null}
        </div>
        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-5 sm:grid-cols-3">
          <div><dt className="hint">Starts</dt><dd className="font-semibold">{longDate(d.start_date)}</dd></div>
          <div><dt className="hint">Length</dt><dd className="font-semibold">{d.days} days</dd></div>
          <div><dt className="hint">Highest point</dt><dd className="font-semibold num">{d.max_altitude_m ? `${d.max_altitude_m.toLocaleString('en-US')} m` : 'Not set'}</dd></div>
        </dl>
        <h2 className="mt-10 text-[1.6rem]">Day plan</h2>
        <p className="hint mt-1">Illustrative, not a published operator itinerary.</p>
        <ol className="ruled mt-4 list-none p-0">
          {d.itinerary.map((line, i) => (
            <li key={i} className="flex gap-4 py-3">
              <span className="font-display text-[1.1rem] font-bold text-blaze num w-8 shrink-0">{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <div className="mt-10 border-t-4 border-slate bg-paper px-4 py-3 text-[0.98rem] text-stone">
          Permits and entry fees for this route are not confirmed here. Check the current official source for each item before you travel. The operator's checklist for this trip is in your trip page once you book.
        </div>
      </article>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="border-t-4 border-spruce bg-paper p-5">
          <p className="font-display text-[1.9rem] font-bold num leading-none">{formatNpr(d.price_npr)}</p>
          <p className="mt-1 text-stone">per person. {d.price_source}.</p>
          <p className="mt-4 font-semibold num">{d.seats_open} of {d.seats_total} seats left</p>
          <div className="mt-5">
            {data.bookable && d.seats_open > 0 ? (
              <BookingForm departureId={d.id} seatsOpen={d.seats_open} />
            ) : (
              <Alert kind="info">{d.seats_open === 0 ? 'This departure is full.' : 'Bookings are closed for this date.'}</Alert>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function BookingForm({ departureId, seatsOpen }: { departureId: number; seatsOpen: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [travellers, setTravellers] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; total_npr: number } | null>(null);
  const max = Math.min(MAX_TRAVELLERS, seatsOpen);

  useEffect(() => { if (user && !name) setName(user.name); }, [user, name]);

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-stone">Sign in to request seats. Your details are only shared with the operator for this trip.</p>
        <Link className="btn btn-primary w-full no-underline" to="/login" state={{ from: location.pathname }}>Sign in to book</Link>
        <Link className="btn btn-ghost w-full no-underline" to="/register">Create an account</Link>
      </div>
    );
  }

  if (done) {
    return (
      <Alert kind="ok">
        <p className="font-semibold">Seats requested. Reference {done.reference}.</p>
        <p className="mt-1">Your operator will confirm. No payment has been taken.</p>
        <button className="btn btn-spruce btn-small mt-3" onClick={() => navigate(`/trips/${done.reference}`)}>Open my trip</button>
      </Alert>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) return setErr('Enter the name of the lead traveller.');
    if (!isValidNepalPhone(phone)) return setErr('Enter a Nepal mobile number, for example +977 98XXXXXXXX.');
    setBusy(true);
    try {
      const r = await api<{ booking: { reference: string; total_npr: number } }>('/api/bookings', {
        body: { departure_id: departureId, travellers, contact_name: name.trim(), contact_phone: phone.trim(), notes: notes.trim() || undefined },
      });
      setDone(r.booking);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'The booking did not go through.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label className="field-label" htmlFor="travellers">Travellers</label>
        <select id="travellers" className="input" value={travellers} onChange={(e) => setTravellers(Number(e.target.value))}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="cname">Lead traveller name</label>
        <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </div>
      <div>
        <label className="field-label" htmlFor="cphone">Mobile number</label>
        <input id="cphone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+977 98XXXXXXXX" required />
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Notes for the operator <span className="font-normal text-stone">(optional)</span></label>
        <textarea id="notes" className="input min-h-[84px]" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {err && <Alert kind="error">{err}</Alert>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? 'Requesting seats…' : 'Request seats'}</button>
      <p className="hint">Seats are held as requested. Nothing is charged here.</p>
    </form>
  );
}
