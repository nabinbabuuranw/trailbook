import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../lib/auth';
import { ApiFailure } from '../lib/api';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 no-underline text-ink">
      <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
        <rect x="4" y="2" width="7" height="26" fill="#2D5A4C" />
        <rect x="15" y="2" width="7" height="14" fill="#B5531F" />
        <rect x="15" y="20" width="7" height="8" fill="#2D5A4C" opacity="0.35" />
      </svg>
      <span className="font-display text-[1.45rem] font-bold uppercase tracking-[0.04em] leading-none">Trailbook</span>
      <span className="tag-demo ml-1 hidden sm:inline-flex">Demo</span>
    </Link>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`alert alert-${kind}`}>{children}</div>;
}

export function Skeleton({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-stone/50 px-5 py-8 text-center">
      <h3 className="text-[1.2rem]">{title}</h3>
      {children && <div className="mt-2 text-stone">{children}</div>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'spruce' | 'blaze' | 'slate' | 'stone' | 'danger' | 'ink'; children: ReactNode }) {
  const tones: Record<string, string> = {
    spruce: 'border-spruce text-spruce-deep bg-spruce-soft/60',
    blaze: 'border-blaze text-blaze-ink bg-[#F5E6DC]',
    slate: 'border-slate text-slate bg-[#E3EAF0]',
    stone: 'border-stone/60 text-stone bg-paper',
    danger: 'border-danger text-danger bg-[#F6E4E1]',
    ink: 'border-ink text-ink bg-paper',
  };
  return <span className={`pill ${tones[tone]}`}>{children}</span>;
}

/** Loads data with explicit loading, error (with retry) and data states. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: ApiFailure | Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, retry: () => setTick((t) => t + 1), setData: (data: T) => setState({ data, error: null, loading: false }) };
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof ApiFailure || error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="space-y-3">
      <Alert kind="error">{message}</Alert>
      {retry && <button className="btn btn-ghost btn-small" onClick={retry}>Try again</button>}
    </div>
  );
}

export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="wrap py-10"><Skeleton label="Checking your sign-in" /></div>;
  if (!user) {
    return (
      <div className="wrap py-12 max-w-xl">
        <h1 className="text-[2.2rem]">Sign in to continue</h1>
        <p className="mt-3 text-stone">This page is for signed-in people. Your details are only shown after you sign in.</p>
        <Link className="btn btn-primary mt-6" to="/login" state={{ from: location.pathname }}>Sign in</Link>
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="wrap py-12 max-w-xl">
        <h1 className="text-[2.2rem]">Not for this account</h1>
        <p className="mt-3 text-stone">This page needs a different role. If you think that is wrong, ask the agency admin to change your role.</p>
        <Link className="btn btn-ghost mt-6" to="/">Back to departures</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function navClass({ isActive }: { isActive: boolean }) {
  return `no-underline px-1 py-2 font-semibold ${isActive ? 'text-ink border-b-2 border-blaze' : 'text-stone hover:text-ink border-b-2 border-transparent'}`;
}

export function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const isStaff = user?.role === 'staff' || user?.role === 'admin';
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">Skip to content</a>
      <header className="border-b border-ink/15 bg-bone">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <Logo />
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 text-[0.98rem]">
            <NavLink to="/departures" className={navClass}>Departures</NavLink>
            {user && <NavLink to="/trips" className={navClass}>My trips</NavLink>}
            {isStaff && <NavLink to="/staff" className={navClass}>Operations</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-3 text-[0.98rem]">
            {user ? (
              <>
                <span className="hidden text-stone sm:inline">{user.name}</span>
                <button className="btn btn-ghost btn-small" onClick={() => void signOut()}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="font-semibold text-ink no-underline">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-small no-underline">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1 pb-16 pt-8 sm:pt-10">
        <Outlet />
      </main>
      <footer className="border-t border-ink/15 bg-paper">
        <div className="wrap grid gap-6 py-8 text-[0.95rem] text-stone sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p className="font-semibold text-ink">Demo build. All departures, people, prices and bookings shown here are DEMO data.</p>
            <p>Trailbook is not an official permit system and does not issue permits. Permit rules change: check the current official source before you travel.</p>
            <p>No payments are taken in this build. The operator's contact details are not published yet.</p>
          </div>
          <div className="flex gap-5 sm:flex-col sm:items-end">
            <Link to="/terms" className="text-ink">Terms (draft)</Link>
            <Link to="/privacy" className="text-ink">Privacy (draft)</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
