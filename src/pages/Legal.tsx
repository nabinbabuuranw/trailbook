import { Link } from 'react-router-dom';

const TERMS = [
  ['Status of this page', 'This is a draft written for the Trailbook demo. It has not been reviewed by a lawyer and is not the terms of any operator.'],
  ['What the service does', 'Trailbook shows open departures, holds seats when a traveller requests them, keeps a document checklist and a permit checklist for each trip. It is not an official permit system and does not issue permits.'],
  ['Demo data', 'All treks, departures, crew, prices, bookings and people shown in this build are DEMO data unless the page says otherwise.'],
  ['Prices', 'Prices shown are the operator’s prices as entered. In this build no payment is taken. A booking is a request until the operator confirms it.'],
  ['Cancelling', 'A draft policy allows a traveller to cancel up to 14 days before departure. The operator sets the real policy.'],
  ['Permits and entry', 'You are responsible for checking the current official source for any permit, card or fee that applies to your trip before you travel.'],
  ['Your account', 'Keep your password private. Tell us if you think someone else has used your account.'],
];

const PRIVACY = [
  ['Status of this page', 'This is a draft written for the Trailbook demo. It has not been reviewed by a lawyer. Nepal data protection rules have not been checked for this page.'],
  ['What we store', 'Your name, email address, optional mobile number, and for each booking the travellers, lead traveller name, mobile, notes and status. Passwords are stored only as salted PBKDF2 hashes.'],
  ['Who sees it', 'You see your own trips. Operator staff see the bookings for the departures they run. Admins see accounts and the activity log.'],
  ['Cookies', 'One session cookie keeps you signed in. It is HttpOnly, Secure and SameSite=Lax, and lasts 12 hours. There are no advertising or analytics cookies in this build.'],
  ['Rate limits', 'Login and booking attempts are counted per network address and per account so that guessing and spamming are slowed down. Counts reset with time.'],
  ['Demo accounts', 'Demo accounts exist for trying the app. Do not enter real personal details into a demo.'],
  ['Asking for your data', 'Contact details for requests are not published in this build.'],
];

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const rows = kind === 'terms' ? TERMS : PRIVACY;
  return (
    <div className="wrap max-w-3xl">
      <p className="tag-demo">Draft</p>
      <h1 className="mt-3 text-[2.3rem]">{kind === 'terms' ? 'Terms of use' : 'Privacy notice'}</h1>
      <p className="mt-3 text-stone">Last drafted for the Day 8 build. Not legal advice. Operator details are not published yet.</p>
      <div className="mt-8 space-y-6">
        {rows.map(([h, b]) => (
          <section key={h}>
            <h2 className="text-[1.3rem]">{h}</h2>
            <p className="mt-2 text-[1.02rem]">{b}</p>
          </section>
        ))}
      </div>
      <p className="mt-10"><Link to={kind === 'terms' ? '/privacy' : '/terms'} className="font-semibold">{kind === 'terms' ? 'Privacy notice' : 'Terms of use'}</Link></p>
    </div>
  );
}
