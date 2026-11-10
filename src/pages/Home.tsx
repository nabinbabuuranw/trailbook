import { Link } from 'react-router-dom';
import RouteProfile from '../components/RouteProfile';
import { Empty, ErrorBox, Skeleton, useLoad } from '../components/ui';
import { api } from '../lib/api';
import { formatNpr } from '../lib/format';
import { DepartureRows, type DepartureRow } from './Departures';

export default function Home() {
  const next = useLoad(() => api<{ departures: DepartureRow[] }>('/api/departures'), []);
  const upcoming = next.data?.departures.slice(0, 4) ?? [];
  return (
    <>
      <section className="wrap grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          <p className="eyebrow"><span className="blaze-mark" /> Trek operations, Nepal</p>
          <h1 className="mt-4">Departures, seats and trip paperwork in one register.</h1>
          <p className="mt-5 max-w-[34rem] text-[1.12rem] text-stone">
            Trailbook keeps group departures, seat holds, guide and porter assignments and each trip's permit checklist together.
            Everything on this demo is DEMO data.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/departures" className="btn btn-primary no-underline">See departures</Link>
            <Link to="/register" className="btn btn-ghost no-underline">Create an account</Link>
          </div>
        </div>
        <RouteProfile />
      </section>

      <section className="wrap mt-14 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2>Next departures</h2>
          <p className="mt-2 text-stone">Open dates only. Seats update as bookings are requested.</p>
        </div>
        <div>
          {next.loading && <Skeleton rows={3} label="Loading departures" />}
          {next.error && <ErrorBox error={next.error} retry={next.retry} />}
          {!next.loading && !next.error && upcoming.length === 0 && (
            <Empty title="No open departures yet">The operator has not opened any dates. Check back later.</Empty>
          )}
          {upcoming.length > 0 && <DepartureRows rows={upcoming} />}
          {upcoming.length > 0 && (
            <p className="mt-4"><Link to="/departures" className="font-semibold">All departures</Link></p>
          )}
        </div>
      </section>

      <section className="wrap mt-14">
        <div className="panel grid gap-8 md:grid-cols-3">
          {[
            ['1', 'Choose a date', 'Pick an open departure. The price is per person, in NPR, and is worked out on the server.'],
            ['2', 'Request seats', 'A request holds your seats right away. Your operator confirms it; nothing is charged in this build.'],
            ['3', 'Check the paperwork', 'Tick off your documents and see each permit item’s state. Permit rules come from the current official source.'],
          ].map(([n, title, body]) => (
            <div key={n}>
              <p className="font-display text-[2.2rem] font-bold leading-none text-blaze">{n}</p>
              <h3 className="mt-3">{title}</h3>
              <p className="mt-2 text-stone">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap mt-14">
        <div className="border-t-4 border-blaze bg-paper px-5 py-5 max-w-[46rem]">
          <h2 className="text-[1.5rem]">What Trailbook is not</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-stone">
            <li>It is not an official permit system. It does not issue or approve TIMS cards, trekking permits or park permits.</li>
            <li>It takes no payments in this build. Prices shown are DEMO prices, not quotes. The sample price here is {formatNpr(98000)} per person.</li>
            <li>No reviews, customer numbers or revenue figures are shown, because none are real yet.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
