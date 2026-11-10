import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../components/ui';
import { useAuth, type Role } from '../lib/auth';

export default function Login() {
  const { signIn, demoSignIn, demoMode, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/trips';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user) {
    return (
      <div className="wrap max-w-xl">
        <h1 className="text-[2rem]">You are signed in as {user.name}</h1>
        <p className="mt-3 text-stone">Role: {user.role}.</p>
        <button className="btn btn-primary mt-5" onClick={() => navigate(from)}>Continue</button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) return setErr('Enter your email and password.');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Sign-in did not work.');
    } finally {
      setBusy(false);
    }
  };

  const demo = async (role: Role) => {
    setErr(null);
    setBusy(true);
    try {
      await demoSignIn(role);
      navigate(role === 'client' ? '/trips' : role === 'staff' ? '/staff' : '/admin', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Demo sign-in is not available.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap grid gap-12 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={submit} noValidate className="max-w-md space-y-4">
        <h1 className="text-[2.3rem]">Sign in</h1>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {err && <Alert kind="error">{err}</Alert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-stone">New here? <Link to="/register" className="font-semibold">Create an account</Link>.</p>
      </form>
      {demoMode && (
        <section aria-labelledby="demo-h" className="border-t-4 border-blaze bg-paper p-5 max-w-md">
          <p className="tag-demo">Demo accounts</p>
          <h2 id="demo-h" className="mt-3 text-[1.4rem]">Try each role</h2>
          <p className="mt-2 text-stone">These accounts hold DEMO data only. Each button signs you in as that role, and the server decides what it can see.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => void demo('client')}>Client</button>
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => void demo('staff')}>Staff</button>
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => void demo('admin')}>Admin</button>
          </div>
        </section>
      )}
    </div>
  );
}
