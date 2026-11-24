// Decorative SVG artwork. Everything here is aria-hidden: it carries no information.

// A constellation in the shape of a rising path: [x, y, radius].
const NODES: [number, number, number][] = [
  [40, 196, 3],
  [112, 150, 4],
  [176, 168, 2.5],
  [236, 104, 4.5],
  [300, 124, 3],
  [356, 58, 5],
  [404, 86, 2.5],
  [446, 26, 4],
];
const LINKS = [
  [0, 1],
  [1, 2],
  [1, 3],
  [3, 4],
  [3, 5],
  [5, 6],
  [5, 7],
  [2, 4],
];
const DUST: [number, number][] = [
  [20, 60],
  [84, 30],
  [150, 80],
  [210, 30],
  [270, 40],
  [330, 180],
  [400, 170],
  [450, 130],
  [60, 120],
  [190, 220],
  [280, 200],
  [420, 220],
];

/** Top-of-page artwork: a constellation climbing over a faint perspective floor, behind the course title. */
export function HeaderArt() {
  return (
    <svg aria-hidden viewBox="0 0 480 240" className="pointer-events-none absolute -top-6 right-0 h-[115%] w-auto max-w-[60%] opacity-30 md:opacity-50 lg:max-w-[42%] lg:opacity-100">
      <defs>
        <linearGradient id="hfloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id="hhalo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.22" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hfade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="hmask">
          <rect width="480" height="240" fill="url(#hfade)" />
        </mask>
      </defs>
      <g mask="url(#hmask)">
        <ellipse cx="330" cy="110" rx="200" ry="120" fill="url(#hhalo)" />
        <g stroke="url(#hfloor)" strokeWidth="1">
          {[-420, -260, -150, -70, 0, 70, 150, 260, 420].map((dx) => (
            <line key={dx} x1={300 + dx * 0.3} y1="170" x2={300 + dx * 1.5} y2="240" />
          ))}
          {[178, 190, 206, 226].map((y) => (
            <line key={y} x1="0" y1={y} x2="480" y2={y} />
          ))}
        </g>
        {DUST.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.1" fill="#a5f3fc" className="twinkle" style={{ "--i": i } as React.CSSProperties} />
        ))}
        <g stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" className="glow-line">
          {LINKS.map(([a, b], i) => (
            <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} pathLength={1} strokeDasharray="1" style={{ animation: `draw 1.1s ease-out ${0.25 + i * 0.12}s both` }} />
          ))}
        </g>
        {NODES.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 2.6} fill="#22d3ee" opacity="0.14" />
            <circle cx={x} cy={y} r={r} fill="#cffafe" className="twinkle" style={{ "--i": i + 3 } as React.CSSProperties} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Bottom-of-page artwork: two glowing ridgelines over a perspective floor, with a comet running the near ridge. */
export function FooterArt() {
  const ridge = "M0 96 C120 60 200 78 300 70 C420 60 470 20 560 34 C650 48 700 84 800 72 C900 60 960 26 1050 38 C1120 48 1160 66 1200 60";
  const far = "M0 70 C100 50 180 20 280 30 C380 40 420 66 520 58 C620 50 680 10 780 18 C880 26 940 56 1040 50 C1110 46 1160 30 1200 26";
  return (
    <svg aria-hidden viewBox="0 0 1200 170" preserveAspectRatio="xMidYMax slice" className="block h-36 w-full sm:h-44">
      <defs>
        <linearGradient id="fglow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.2" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fgrid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.05" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="ftail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="1" stopColor="#ecfeff" />
        </linearGradient>
      </defs>
      <path d={far} fill="none" stroke="#0e7490" strokeWidth="1.5" opacity="0.7" />
      <path d={`${far} V170 H0 Z`} fill="#0e7490" opacity="0.07" />
      <path d={`${ridge} V170 H0 Z`} fill="#050b16" />
      <path d={`${ridge} V170 H0 Z`} fill="url(#fglow)" />
      {/* perspective floor */}
      <g stroke="url(#fgrid)" strokeWidth="1">
        {[-1100, -800, -560, -380, -240, -120, 0, 120, 240, 380, 560, 800, 1100].map((dx) => (
          <line key={dx} x1={600 + dx * 0.35} y1="100" x2={600 + dx * 1.5} y2="170" />
        ))}
      </g>
      <g stroke="#22d3ee">
        {[
          [104, 0.12],
          [112, 0.2],
          [124, 0.3],
          [140, 0.42],
          [160, 0.55],
        ].map(([y, o]) => (
          <line key={y} x1="0" y1={y} x2="1200" y2={y} strokeWidth="1" opacity={o} />
        ))}
      </g>
      <path d={ridge} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" className="glow-line" />
      <g className="fly" style={{ offsetPath: `path('${ridge}')` }}>
        <rect x="-90" y="-1.5" width="90" height="3" rx="1.5" fill="url(#ftail)" />
        <circle r="12" fill="#22d3ee" opacity="0.3" />
        <circle r="4.5" fill="#ecfeff" />
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
