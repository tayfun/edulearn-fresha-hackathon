// Decorative SVG artwork. Everything here is aria-hidden: it carries no information.

/** A glowing wireframe horizon with a signal travelling along it, closing the page. */
export function FooterArt() {
  const ridge = "M0 96 C120 60 200 78 300 70 C420 60 470 20 560 34 C650 48 700 84 800 72 C900 60 960 26 1050 38 C1120 48 1160 66 1200 60";
  return (
    <svg aria-hidden viewBox="0 0 1200 150" preserveAspectRatio="xMidYMax slice" className="block h-32 w-full sm:h-40">
      <defs>
        <linearGradient id="fglow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.22" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fgrid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* perspective floor */}
      <g stroke="url(#fgrid)" strokeWidth="1">
        {[-900, -600, -380, -220, -100, 0, 100, 220, 380, 600, 900].map((dx) => (
          <line key={dx} x1={600 + dx * 0.25} y1="92" x2={600 + dx * 1.6} y2="150" />
        ))}
        {[100, 110, 122, 136].map((y) => (
          <line key={y} x1="0" y1={y} x2="1200" y2={y} />
        ))}
      </g>
      <path d={`${ridge} V150 H0 Z`} fill="url(#fglow)" />
      <path d={ridge} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" className="glow-line" />
      {[
        [300, 70],
        [560, 34],
        [800, 72],
        [1050, 38],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#a5f3fc" className="twinkle" style={{ "--i": i } as React.CSSProperties} />
      ))}
      <g className="fly" style={{ offsetPath: `path('${ridge}')` }}>
        <circle r="5" fill="#ecfeff" />
        <circle r="11" fill="#22d3ee" opacity="0.35" />
      </g>
    </svg>
  );
}

/** Small mark beside the wordmark. */
export function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 28 28" className="h-7 w-7">
      <rect x="0.75" y="0.75" width="26.5" height="26.5" rx="8" fill="#0b1524" stroke="#22d3ee" strokeWidth="1.5" />
      <path d="M6 19 L11 11 L15 16 L18 12 L22 19" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="8" r="1.8" fill="#a5f3fc" />
    </svg>
  );
}

const ICONS = {
  book: (
    <>
      <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" />
      <path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
    </>
  ),
  flame: <path d="M12 3c0 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  cards: (
    <>
      <rect x="4" y="7.5" width="12" height="12.5" rx="2" />
      <path d="M8 7.5V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5h11l-2.5 3.5L17 12H6z" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
} as const;

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}
