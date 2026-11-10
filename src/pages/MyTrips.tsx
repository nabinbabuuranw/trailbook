import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Pill, Skeleton, useLoad } from '../components/ui';
import { api } from '../lib/api';
import { formatNpr, longDate, STATUS_LABEL } from '../lib/format';

interface Trip { reference: string; status: string; travellers: number; total_npr: number; start_date: string; trek_name: string; region: string }

const TONE: Record<string, 'spruce' | 'blaze' | 'slate' | 'stone' | 'danger' | 'ink'> = {
  requested: 'blaze', confirmed: 'spruce', cancelled: 'danger', completed: 'slate',
};

export default function MyTrips() {
  const { data, error, loading, retry } = useLoad(() => api<{ bookings: Trip[] }>('/api/bookings'), []);
  return (
    <div className="wrap">
      <p className="eyebrow"><span className="blaze-mark" /> Your bookings</p>
      <h1 className="mt-3">My trips</h1>
      <div className="mt-7">
        {loading && <Skeleton rows={3} label="Loading your trips" />}
        {error && <ErrorBox error={error} retry={retry} />}
        {!loading && !error && data?.bookings.length === 0 && (
          <Empty title="No trips yet">
            <Link to="/departures" className="font-semibold">Find an open departure</Link>, then request seats.
          </Empty>
        )}
        {data && data.bookings.length > 0 && (
          <ul className="ruled m-0 list-none p-0">
            {data.bookings.map((b) => (
              <li key={b.reference} className="py-4">
                <Link to={`/trips/${b.reference}`} className="grid gap-2 no-underline text-ink sm:grid-cols-[1fr_auto] sm:items-center">
                  <span>
                    <span className="block font-display text-[1.25rem] font-bold uppercase">{b.trek_name}</span>
                    <span className="block text-stone">{longDate(b.start_date)} · {b.travellers} {b.travellers === 1 ? 'traveller' : 'travellers'} · <span className="num">{b.reference}</span></span>
                  </span>
                  <span className="flex items-center gap-3 sm:justify-end">
                    <Pill tone={TONE[b.status] ?? 'ink'}>{STATUS_LABEL[b.status] ?? b.status}</Pill>
                    <span className="font-semibold num">{formatNpr(b.total_npr)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
