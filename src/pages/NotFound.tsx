import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap max-w-xl">
      <p className="eyebrow"><span className="blaze-mark" /> 404</p>
      <h1 className="mt-3 text-[2.3rem]">This trail ends here</h1>
      <p className="mt-3 text-stone">There is no page at this address.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn btn-primary no-underline">Home</Link>
        <Link to="/departures" className="btn btn-ghost no-underline">Departures</Link>
      </div>
    </div>
  );
}
