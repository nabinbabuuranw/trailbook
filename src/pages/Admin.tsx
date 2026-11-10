import { useState, type FormEvent } from 'react';
import { Alert, Empty, ErrorBox, Skeleton, useLoad } from '../components/ui';
import { api } from '../lib/api';
import { useAuth, type Role } from '../lib/auth';
import { longDate } from '../lib/format';

interface Overview {
  departures: { open: number; draft: number; closed_or_cancelled: number; upcoming_open: number };
  bookings: { requested: number; confirmed: number; cancelled: number; completed: number };
  users: { client: number; staff: number; admin: number };
  demo_rows: number;
  payments_taken_npr: number;
}
interface User { id: number; email: string; name: string; role: Role; suspended: number; is_demo: number; created_at: string }
interface Audit { id: number; actor_role: string; action: string; entity: string; entity_id: string; detail: string; created_at: string }
interface Trek { id: number; name: string }

export default function Admin() {
  const { user } = useAuth();
  const overview = useLoad(() => api<Overview>('/api/admin/overview'), []);
  const users = useLoad(() => api<{ users: User[] }>('/api/admin/users'), []);
  const audit = useLoad(() => api<{ entries: Audit[] }>('/api/admin/audit'), []);
  const treks = useLoad(() => api<{ treks: Trek[] }>('/api/treks'), []);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ kind: 'ok', text: ok }); users.retry(); audit.retry(); overview.retry(); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'That did not save.' }); }
  };

  return (
    <div className="wrap space-y-12">
      <header>
        <p className="eyebrow"><span className="blaze-mark" /> Admin</p>
        <h1 className="mt-3">Admin</h1>
        <p className="mt-2 text-stone">Counts come from the database. Demo rows are labelled. Payments taken: NPR {overview.data ? overview.data.payments_taken_npr.toLocaleString('en-US') : '0'} (no payment provider is connected).</p>
      </header>

      {msg && <Alert kind={msg.kind === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

      <section aria-labelledby="ov-h">
        <h2 id="ov-h" className="text-[1.5rem]">Overview</h2>
        {overview.loading && <Skeleton rows={2} label="Loading overview" />}
        {overview.error && <ErrorBox error={overview.error} retry={overview.retry} />}
        {overview.data && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink/80 pt-5 sm:grid-cols-4">
            {[
              ['Open departures', overview.data.departures.open],
              ['Draft departures', overview.data.departures.draft],
              ['Requests to confirm', overview.data.bookings.requested],
              ['Confirmed bookings', overview.data.bookings.confirmed],
              ['Cancelled bookings', overview.data.bookings.cancelled],
              ['Completed bookings', overview.data.bookings.completed],
              ['Client accounts', overview.data.users.client],
              ['Staff and admin', overview.data.users.staff + overview.data.users.admin],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="hint">{label}</dt>
                <dd className="font-display text-[2rem] font-bold num leading-none mt-1">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="new-h" className="panel">
        <h2 id="new-h" className="text-[1.5rem]">Add a departure</h2>
        <p className="hint mt-1">A departure opens for booking only with a price source (a rate sheet, a quote, or DEMO).</p>
        {treks.data && <NewDeparture treks={treks.data.treks} onDone={(t) => void act(async () => undefined, t)} />}
      </section>

      <section aria-labelledby="users-h">
        <h2 id="users-h" className="text-[1.5rem]">People and roles</h2>
        <p className="hint mt-1">Roles are set here, on the server. You cannot change your own role or suspend yourself.</p>
        {users.loading && <Skeleton rows={3} label="Loading people" />}
        {users.error && <ErrorBox error={users.error} retry={users.retry} />}
        {users.data && users.data.users.length === 0 && <Empty title="No accounts">Nothing to show.</Empty>}
        {users.data && users.data.users.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full min-w-[620px] border-collapse text-left text-[0.97rem]">
              <caption className="sr-only">Accounts and roles</caption>
              <thead><tr className="border-b-2 border-ink text-stone"><th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="py-2 pr-3">Email</th><th scope="col" className="py-2 pr-3">Role</th><th scope="col" className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {users.data.users.map((u) => {
                  const self = u.id === user?.id;
                  return (
                    <tr key={u.id} className="border-b border-rule align-middle">
                      <td className="py-3 pr-3">{u.name}{u.is_demo ? <span className="tag-demo ml-2">Demo</span> : null}</td>
                      <td className="py-3 pr-3 break-all">{u.email}</td>
                      <td className="py-3 pr-3">
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                        <select id={`role-${u.id}`} className="input min-h-[40px] py-1" value={u.role} disabled={self}
                          onChange={(e) => void act(() => api(`/api/admin/users/${u.id}/role`, { method: 'PUT', body: { role: e.target.value } }), `Role updated for ${u.name}.`)}>
                          <option value="client">client</option><option value="staff">staff</option><option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 pr-3">
                        <button className="btn btn-ghost btn-small" disabled={self}
                          onClick={() => void act(() => api(`/api/admin/users/${u.id}/suspended`, { method: 'PUT', body: { suspended: !u.suspended } }), u.suspended ? `${u.name} is active again.` : `${u.name} is suspended.`)}>
                          {u.suspended ? 'Reinstate' : 'Suspend'}
                        </button>
                        {self && <span className="hint ml-2">(you)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="audit-h">
        <h2 id="audit-h" className="text-[1.5rem]">Activity log</h2>
        <p className="hint mt-1">Every staff and admin write, newest first.</p>
        {audit.loading && <Skeleton rows={3} label="Loading log" />}
        {audit.error && <ErrorBox error={audit.error} retry={audit.retry} />}
        {audit.data && audit.data.entries.length === 0 && <Empty title="Nothing logged yet">Changes you make will appear here.</Empty>}
        {audit.data && audit.data.entries.length > 0 && (
          <ol className="ruled mt-4 list-none p-0 text-[0.95rem]">
            {audit.data.entries.map((e) => (
              <li key={e.id} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
                <span className="num text-stone">{e.created_at.slice(0, 16).replace('T', ' ')} UTC</span>
                <span><span className="font-semibold">{e.action}</span> on {e.entity} {e.entity_id} <span className="text-stone">by {e.actor_role}</span> <span className="text-stone break-all">{e.detail}</span></span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function NewDeparture({ treks, onDone }: { treks: Trek[]; onDone: (text: string) => void }) {
  const [trekId, setTrekId] = useState(treks[0]?.id ?? 0);
  const [startDate, setStartDate] = useState('');
  const [seats, setSeats] = useState(10);
  const [price, setPrice] = useState(0);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<'draft' | 'open'>('draft');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api('/api/admin/departures', { body: { trek_id: trekId, start_date: startDate, seats_total: seats, price_npr: price, price_source: source || undefined, status } });
      onDone(`Departure added on ${longDate(startDate)} as ${status}.`);
      setStartDate('');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'The departure was not added.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="field-label" htmlFor="nd-trek">Trek</label>
        <select id="nd-trek" className="input" value={trekId} onChange={(e) => setTrekId(Number(e.target.value))}>
          {treks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="nd-date">Start date</label>
        <input id="nd-date" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </div>
      <div>
        <label className="field-label" htmlFor="nd-seats">Seats</label>
        <input id="nd-seats" type="number" min={1} max={60} className="input num" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
      </div>
      <div>
        <label className="field-label" htmlFor="nd-price">Price per person (NPR)</label>
        <input id="nd-price" type="number" min={0} className="input num" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      </div>
      <div>
        <label className="field-label" htmlFor="nd-source">Price source</label>
        <input id="nd-source" className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Rate sheet, quote, or DEMO" />
      </div>
      <div>
        <label className="field-label" htmlFor="nd-status">Start as</label>
        <select id="nd-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'open')}>
          <option value="draft">Draft (hidden)</option>
          <option value="open">Open for booking</option>
        </select>
      </div>
      {err && <div className="sm:col-span-2 lg:col-span-3"><Alert kind="error">{err}</Alert></div>}
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" className="btn btn-primary" disabled={busy || !startDate}>{busy ? 'Adding…' : 'Add departure'}</button>
      </div>
    </form>
  );
}
