import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Pill, Skeleton, useLoad } from '../components/ui';
import { api } from '../lib/api';
import { formatNpr, longDate, shortDay } from '../lib/format';

export interface DepartureRow {
  id: number;
  start_date: string;
  seats_total: number;
  seats_open: number;
  price_npr: number;
  price_source: string;
  is_demo: number;
  trek_name: string;
  region: string;
  days: number;
  restricted_area: number;
}

export function DepartureRows({ rows }: { rows: DepartureRow[] }) {
  return (
    <ul className="ruled m-0 list-none p-0">
      {rows.map((d) => {
        const d8 = shortDay(d.start_date);
        const full = d.seats_open === 0;
        return (
          <li key={d.id} className="group py-4">
            <Link to={`/departures/${d.id}`} className="grid grid-cols-[64px_1fr] gap-4 no-underline text-ink sm:grid-cols-[72px_1fr_auto] sm:items-center">
              <span className="border-t-4 border-spruce bg-paper text-center">
                <span className="block font-display text-[2rem] font-bold leading-none pt-2 num">{d8.day}</span>
                <span className="block font-display text-[0.95rem] uppercase tracking-[0.08em] text-stone pb-2">{d8.month} {d8.year}</span>
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[1.3rem] font-bold uppercase leading-tight group-hover:text-blaze">{d.trek_name}</span>
                </span>
                <span className="mt-1 block text-stone">{d.region} · {d.days} days · {longDate(d.start_date)}</span>
                <span className="mt-2 flex flex-wrap gap-2">
                  {d.is_demo ? <Pill tone="blaze">Demo</Pill> : null}
                  {d.restricted_area ? <Pill tone="slate">Restricted area: check the official source</Pill> : null}
                  {full ? <Pill tone="danger">Full</Pill> : <Pill tone="spruce">{d.seats_open} of {d.seats_total} left</Pill>}
                </span>
              </span>
              <span className="col-span-2 text-left sm:col-span-1 sm:text-right">
                <span className="block font-display text-[1.25rem] font-bold num">{formatNpr(d.price_npr)}</span>
                <span className="block text-[0.9rem] text-stone">per person, DEMO price</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Departures() {
  const [region, setRegion] = useState('');
  const { data, error, loading, retry } = useLoad(() => api<{ departures: DepartureRow[] }>('/api/departures'), []);
  const regions = useMemo(() => Array.from(new Set((data?.departures ?? []).map((d) => d.region))).sort(), [data]);
  const rows = (data?.departures ?? []).filter((d) => !region || d.region === region);
  return (
    <div className="wrap">
      <p className="eyebrow"><span className="blaze-mark" /> Open dates</p>
      <h1 className="mt-3">Departures</h1>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="region" className="field-label">Region</label>
          <select id="region" className="input min-w-[220px]" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <p className="hint pb-3" aria-live="polite">{data ? `${rows.length} open ${rows.length === 1 ? 'departure' : 'departures'}` : ''}</p>
      </div>
      <div className="mt-6">
        {loading && <Skeleton rows={4} label="Loading departures" />}
        {error && <ErrorBox error={error} retry={retry} />}
        {!loading && !error && rows.length === 0 && (
          <Empty title={region ? 'No open departures in this region' : 'No open departures yet'}>
            {region ? <button className="font-semibold underline" onClick={() => setRegion('')}>Show all regions</button> : 'Check back later.'}
          </Empty>
        )}
        {rows.length > 0 && <DepartureRows rows={rows} />}
      </div>
    </div>
  );
}
