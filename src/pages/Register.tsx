import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/ui';
import { useAuth } from '../lib/auth';
import { isValidEmail, isValidNepalPhone, passwordProblem } from '../../shared/rules.ts';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (user || done) {
    return (
      <div className="wrap max-w-xl">
        <Alert kind="ok">Your account is ready, {(user?.name ?? name).split(' ')[0]}. You are signed in.</Alert>
        <div className="mt-5 flex gap-3">
          <button className="btn btn-primary" onClick={() => navigate('/departures')}>See departures</button>
          <button className="btn btn-ghost" onClick={() => navigate('/trips')}>My trips</button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) return setErr('Enter your full name.');
    if (!isValidEmail(email.trim())) return setErr('Enter a valid email address.');
    const pw = passwordProblem(password);
    if (pw) return setErr(pw);
    if (phone.trim() && !isValidNepalPhone(phone.trim())) return setErr('Enter a Nepal mobile number, for example +977 98XXXXXXXX.');
    setBusy(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined });
      setDone(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'The account was not created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap max-w-xl">
      <h1 className="text-[2.3rem]">Create an account</h1>
      <p className="mt-3 text-stone">Accounts are for travellers booking a trip. Staff and admin roles are given by the operator, not chosen here.</p>
      <form onSubmit={submit} noValidate className="mt-7 space-y-4">
        <div>
          <label className="field-label" htmlFor="rname">Full name</label>
          <input id="rname" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </div>
        <div>
          <label className="field-label" htmlFor="remail">Email</label>
          <input id="remail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="field-label" htmlFor="rphone">Mobile number <span className="font-normal text-stone">(optional)</span></label>
          <input id="rphone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+977 98XXXXXXXX" />
        </div>
        <div>
          <label className="field-label" htmlFor="rpass">Password</label>
          <input id="rpass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required aria-describedby="rpass-hint" />
          <p id="rpass-hint" className="hint mt-1">At least 10 characters, with letters and numbers.</p>
        </div>
        {err && <Alert kind="error">{err}</Alert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="text-stone">Already have one? <Link to="/login" className="font-semibold">Sign in</Link>.</p>
      </form>
    </div>
  );
}
