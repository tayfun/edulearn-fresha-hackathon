// Decorative SVG artwork. Everything here is aria-hidden: it carries no information.

export const PINE = "M0 -46 C3 -38 8 -32 12 -27 H7 C10 -20 15 -14 19 -9 H11 C14 -3 19 2 23 6 H3 V15 H-3 V6 H-23 C-19 2 -14 -3 -11 -9 H-19 C-15 -14 -10 -20 -7 -27 H-12 C-8 -32 -3 -38 0 -46 Z";

// Positions are percentages of the star field, which only covers the sky to the right of the text.
const STARS = [
  [8, 10, 1.6],
  [22, 30, 1.1],
  [34, 8, 2],
  [47, 22, 1.2],
  [60, 6, 1.5],
  [72, 16, 1.1],
  [86, 9, 1.9],
  [95, 28, 1.3],
  [15, 52, 1.2],
  [90, 55, 1.1],
  [5, 78, 1.4],
  [97, 80, 1.2],
  [40, 40, 0.9],
];

/**
 * Dusk sky and distant ridges behind the course header. The foreground hill is drawn by the
 * lesson trail itself, so this layer only needs to stay clear of the text.
 */
export function HeroArt() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#04241f_0%,#0a4f44_52%,#1a7a6b_100%)]">
      {/* stars and one cloud, right of the text column and only where there is room */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute right-0 top-0 hidden h-[58%] w-[36%] overflow-visible sm:block">
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r * 0.5} fill="#fff3cf" className="twinkle" style={{ "--i": i } as React.CSSProperties} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <svg viewBox="0 0 160 40" className="sway absolute right-[27%] top-[9%] hidden w-28 opacity-[0.13] lg:block" fill="#fff">
        <path d="M4 30 C4 20 16 15 26 18 C31 5 54 2 64 13 C74 3 97 6 100 19 C113 17 123 24 121 32 C121 37 116 39 111 39 H14 C7 39 4 36 4 30 Z" />
      </svg>

      {/* far ridges pinned to the bottom, hazier with distance */}
      <svg viewBox="0 0 1200 240" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-56 w-full sm:h-64">
        <defs>
          <linearGradient id="ridge1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a8c7a" />
            <stop offset="1" stopColor="#15695a" />
          </linearGradient>
          <linearGradient id="ridge2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#176f5f" />
            <stop offset="1" stopColor="#0b4a40" />
          </linearGradient>
        </defs>
        <path d="M0 78 C90 50 150 22 230 32 C310 42 350 0 440 8 C530 16 580 58 670 44 C760 30 800 4 880 12 C960 20 1010 50 1090 36 C1140 28 1170 12 1200 6 V240 H0 Z" fill="url(#ridge1)" />
        <path d="M0 110 C120 70 220 84 330 98 C450 114 540 60 660 76 C780 92 860 108 960 86 C1050 66 1130 80 1200 70 V240 H0 Z" fill="url(#ridge2)" />
      </svg>
      {/* keeps the text side legible on wide screens */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(4_36_31/0.75)_0%,rgb(4_36_31/0.3)_55%,transparent_85%)]" />
    </div>
  );
}

/** The same ridges and pines as the header, in daylight, with books and a paper plane. */
export function FooterArt() {
  const flight = "M-40 80 C140 24 300 92 480 50 C660 8 900 60 1240 20";
  return (
    <svg aria-hidden viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" className="block h-40 w-full sm:h-52">
      <defs>
        <linearGradient id="f1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d5eae4" />
          <stop offset="1" stopColor="#b9dbd1" />
        </linearGradient>
        <linearGradient id="f2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fc5b7" />
          <stop offset="1" stopColor="#5fa897" />
        </linearGradient>
      </defs>
      {/* low sun, half behind the far ridge */}
      <circle cx="790" cy="84" r="50" fill="#f6b84a" opacity="0.18" className="sun-glow" />
      <circle cx="790" cy="84" r="28" fill="#f6b84a" />

      <path d="M0 128 C90 100 150 78 230 88 C310 98 350 60 440 70 C530 80 580 118 670 106 C760 94 800 58 880 68 C960 78 1010 114 1090 102 C1140 94 1170 82 1200 78 V200 H0 Z" fill="url(#f1)" />

      <path d={flight} fill="none" stroke="#0f6b5c" strokeWidth="1.6" strokeDasharray="3 9" strokeLinecap="round" opacity="0.45" />
      <g className="fly" style={{ offsetPath: `path('${flight}')` }}>
        <path d="M-22 -11 L22 0 L-22 11 L-13 0 Z" fill="#157a69" />
        <path d="M-13 0 L22 0 L-22 11 Z" fill="#0a4f44" />
      </g>

      <path d="M0 158 C120 122 220 134 330 146 C450 160 540 112 660 128 C780 144 860 158 960 138 C1050 120 1130 132 1200 124 V200 H0 Z" fill="url(#f2)" />
      <g fill="#0f6b5c">
        {[
          [96, 150, 1],
          [140, 156, 0.72],
          [186, 150, 1.25],
          [236, 160, 0.8],
          [430, 152, 0.9],
          [468, 158, 0.65],
          [722, 150, 0.95],
          [760, 158, 0.7],
          [1010, 138, 1.15],
          [1056, 146, 0.8],
          [1102, 138, 1.3],
          [1150, 148, 0.9],
        ].map(([x, y, s], i) => (
          <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d={PINE} />
        ))}
      </g>

      {/* stack of books with a sprout, centre stage */}
      <g transform="translate(600 132) scale(1.3)">
        <g className="bob">
          <rect x="-36" y="18" width="72" height="14" rx="3" fill="#0a4f44" />
          <rect x="-29" y="21" width="42" height="2" rx="1" fill="#e3f1ed" opacity="0.7" />
          <rect x="24" y="18" width="5" height="14" fill="#f6b84a" />
          <rect x="-29" y="4" width="62" height="14" rx="3" fill="#f6b84a" />
          <rect x="-22" y="7" width="32" height="2" rx="1" fill="#fff7df" opacity="0.85" />
          <rect x="-34" y="-10" width="60" height="14" rx="3" fill="#c2611a" />
          <rect x="-27" y="-7" width="36" height="2" rx="1" fill="#fdf1dc" opacity="0.85" />
          <path d="M-4 -10 V-28" stroke="#0f6b5c" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M-4 -19 C-17 -21 -20 -32 -19 -36 C-11 -35 -4 -29 -4 -19 Z" fill="#157a69" />
          <path d="M-4 -24 C7 -25 12 -35 11 -40 C3 -39 -4 -33 -4 -24 Z" fill="#0f6b5c" />
        </g>
      </g>

      <path d="M0 186 C240 164 420 192 640 180 C860 168 1020 190 1200 172 V200 H0 Z" fill="#157a69" />
      <rect y="197" width="1200" height="3" fill="#0f6b5c" />
    </svg>
  );
}

/** Small mark beside the wordmark. */
export function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 28 28" className="h-7 w-7">
      <rect width="28" height="28" rx="8" fill="#0f6b5c" />
      <path d="M5 21 L11 12 L15 17 L18 13 L23 21 Z" fill="#e3f1ed" />
      <circle cx="19.5" cy="8.5" r="2.5" fill="#f6b84a" />
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
