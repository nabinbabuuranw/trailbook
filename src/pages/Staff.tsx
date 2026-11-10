import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Pill, Skeleton, useLoad } from '../components/ui';
import { api } from '../lib/api';
import { longDate, STATUS_LABEL } from '../lib/format';

interface Dep {
  id: number; start_date: string; seats_total: number; seats_held: number; price_source: string; status: string; is_demo: number;
  trek_name: string; region: string; restricted_area: number; requested_count: number; confirmed_count: number; crew_count: number;
}

const TONE: Record<string, 'spruce' | 'blaze' | 'slate' | 'stone' | 'danger' | 'ink'> = { open: 'spruce', draft: 'stone', closed: 'slate', cancelled: 'danger' };

export default function Staff() {
  const { data, error, loading, retry } = useLoad(() => api<{ departures: Dep[] }>('/api/staff/departures'), []);
  const rows = data?.departures ?? [];
  const requested = rows.reduce((n, d) => n + d.requested_count, 0);
  return (
    <div className="wrap">
      <p className="eyebrow"><span className="blaze-mark" /> Operations</p>
      <h1 className="mt-3">Departures to run</h1>
      <p className="mt-3 text-stone">{data ? `${requested} seat ${requested === 1 ? 'request' : 'requests'} waiting for your decision across ${rows.length} departures.` : 'Every departure, including drafts.'}</p>
      <div className="mt-7">
        {loading && <Skeleton rows={4} label="Loading departures" />}
        {error && <ErrorBox error={error} retry={retry} />}
        {!loading && !error && rows.length === 0 && <Empty title="No departures yet">An admin can add departures from the admin page.</Empty>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[0.98rem]">
              <caption className="sr-only">Departures with seat and assignment counts</caption>
              <thead>
                <tr className="border-b-2 border-ink text-stone">
                  <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Trek</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                  <th scope="col" className="py-2 pr-3 font-semibold num">Seats held</th>
                  <th scope="col" className="py-2 pr-3 font-semibold num">Requests</th>
                  <th scope="col" className="py-2 pr-3 font-semibold num">Crew</th>
                  <th scope="col" className="py-2 font-semibold"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-rule">
                    <td className="py-3 pr-3 num whitespace-nowrap">{longDate(d.start_date)}</td>
                    <td className="py-3 pr-3">
                      <span className="font-semibold">{d.trek_name}</span>
                      <span className="block text-[0.9rem] text-stone">{d.region}{d.is_demo ? ' · Demo' : ''}{d.restricted_area ? ' · Restricted area' : ''}</span>
                    </td>
                    <td className="py-3 pr-3"><Pill tone={TONE[d.status] ?? 'ink'}>{STATUS_LABEL[d.status] ?? d.status}</Pill></td>
                    <td className="py-3 pr-3 num">{d.seats_held} / {d.seats_total}</td>
                    <td className="py-3 pr-3 num">{d.requested_count > 0 ? <span className="font-semibold text-blaze-ink">{d.requested_count} to confirm</span> : d.confirmed_count}</td>
                    <td className="py-3 pr-3 num">{d.crew_count}</td>
                    <td className="py-3 text-right"><Link className="font-semibold" to={`/staff/departures/${d.id}`}>Open<span className="sr-only"> {d.trek_name} {longDate(d.start_date)}</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
