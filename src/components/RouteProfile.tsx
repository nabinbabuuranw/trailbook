// Illustrative elevation sketch. It is a drawing, not survey data, and it is labelled that way on the page.
export default function RouteProfile() {
  const pts = [[0, 210], [60, 190], [110, 200], [170, 150], [220, 160], [280, 110], [330, 120], [390, 70], [440, 84], [500, 40], [560, 58], [600, 30]];
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const area = `${line} L600 240 L0 240 Z`;
  return (
    <figure className="m-0">
      <svg viewBox="0 0 600 260" className="w-full h-auto" role="img" aria-labelledby="profile-title">
        <title id="profile-title">Illustrative trail profile: a climb from the valley floor to a high camp</title>
        <rect x="0" y="0" width="600" height="260" fill="#F8F5EE" />
        {[60, 110, 160, 210].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#CFC6B2" strokeWidth="1" />
        ))}
        <path d={area} fill="#D8E2CB" opacity="0.7" />
        <path d={line} fill="none" stroke="#2D5A4C" strokeWidth="3" strokeLinejoin="round" />
        {pts.filter((_, i) => i % 3 === 0).map(([x, y]) => (
          <g key={x}>
            <rect x={x - 3} y={y - 26} width="5" height="22" fill="#B5531F" />
          </g>
        ))}
        <text x="16" y="250" fontSize="13" fill="#5E594E" fontFamily="Barlow, sans-serif">Valley</text>
        <text x="520" y="250" fontSize="13" fill="#5E594E" fontFamily="Barlow, sans-serif" textAnchor="end">High camp</text>
      </svg>
      <figcaption className="mt-2 text-[0.9rem] text-stone">Illustrative sketch of a climb with painted trail markers. Not survey data.</figcaption>
    </figure>
  );
}
