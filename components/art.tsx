// Decorative SVG artwork. Everything here is aria-hidden: it carries no information.

// Stars stay in the right-hand sky, clear of the title and description.
const STARS = [
  [700, 50, 1.8],
  [760, 130, 1.2],
  [830, 70, 2.2],
  [905, 36, 1.3],
  [960, 120, 1.6],
  [1010, 60, 1.2],
  [1080, 30, 2],
  [1150, 96, 1.4],
  [1180, 190, 1.2],
  [860, 190, 1.1],
  [740, 220, 1.5],
  [1120, 150, 1],
  [650, 110, 1.2],
  [1035, 14, 1.1],
];

const PINE = "M0 -46 C3 -38 8 -32 12 -27 H7 C10 -20 15 -14 19 -9 H11 C14 -3 19 2 23 6 H3 V15 H-3 V6 H-23 C-19 2 -14 -3 -11 -9 H-19 C-15 -14 -10 -20 -7 -27 H-12 C-8 -32 -3 -38 0 -46 Z";

/** Dusk landscape behind the course header. The progress ring sits where the low sun would be, above the ridges. */
export function HeroArt() {
  return (
    <svg aria-hidden viewBox="0 0 1200 600" preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04241f" />
          <stop offset="0.45" stopColor="#0a4f44" />
          <stop offset="0.72" stopColor="#1a7a6b" />
          <stop offset="0.8" stopColor="#e9a94a" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.75" />
          <stop offset="0.35" stopColor="#ffb347" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ridge1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c8f7d" />
          <stop offset="1" stopColor="#136253" />
        </linearGradient>
        <linearGradient id="ridge2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15695a" />
          <stop offset="1" stopColor="#0a473d" />
        </linearGradient>
        <linearGradient id="ridge3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b4a40" />
          <stop offset="1" stopColor="#06342d" />
        </linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#04241f" stopOpacity="0.88" />
          <stop offset="0.5" stopColor="#04241f" stopOpacity="0.45" />
          <stop offset="0.8" stopColor="#04241f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="600" fill="url(#sky)" />

      <g className="hidden sm:block">
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff3cf" className="twinkle" style={{ "--i": i } as React.CSSProperties} />
        ))}
        {/* a soft cloud bank, right of the text */}
        <g className="sway" fill="#ffffff" opacity="0.1">
          <path d="M700 300 C700 288 716 282 728 286 C734 270 762 266 774 280 C786 268 814 272 818 288 C834 286 846 294 844 304 C844 310 838 312 832 312 H712 C704 312 700 308 700 300 Z" />
          <path d="M1090 214 C1090 205 1102 200 1111 203 C1116 191 1137 189 1146 199 C1156 191 1176 195 1178 207 C1190 206 1198 212 1196 219 C1196 223 1192 225 1188 225 H1099 C1093 225 1090 221 1090 214 Z" />
        </g>
      </g>

      <circle cx="1040" cy="282" r="190" fill="url(#sun)" className="sun-glow" />

      {/* three ridges, lighter and hazier with distance */}
      <path
        d="M0 438 C90 410 150 382 230 392 C310 402 350 352 440 362 C530 372 580 418 670 404 C760 390 800 346 880 356 C960 366 1010 410 1090 396 C1140 388 1170 372 1200 366 V600 H0 Z"
        fill="url(#ridge1)"
      />
      <path d="M0 470 C120 430 220 444 330 458 C450 474 540 420 660 436 C780 452 860 468 960 446 C1050 426 1130 440 1200 430 V600 H0 Z" fill="url(#ridge2)" />
      <g fill="#063730">
        {[
          [1052, 470, 1],
          [1090, 476, 0.72],
          [1134, 468, 1.2],
          [1176, 478, 0.85],
          [706, 470, 0.7],
          [738, 474, 0.55],
        ].map(([x, y, s], i) => (
          <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d={PINE} />
        ))}
      </g>
      {/* dark foreground: the lesson trail is drawn on top of this */}
      <path d="M0 496 C220 474 440 490 640 482 C860 474 1020 492 1200 478 V600 H0 Z" fill="url(#ridge3)" />
      <rect width="1200" height="600" fill="url(#fade)" />
    </svg>
  );
}

/** The same ridges and pines as the header, in daylight, with books and a paper plane. */
export function FooterArt() {
  const flight = "M-40 92 C140 30 300 110 480 62 C660 14 860 96 1240 34";
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
      <circle cx="930" cy="70" r="26" fill="#f6b84a" opacity="0.9" />
      <circle cx="930" cy="70" r="44" fill="#f6b84a" opacity="0.18" className="sun-glow" />

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
          [1010, 138, 1.15],
          [1056, 146, 0.8],
          [1102, 138, 1.3],
          [1150, 148, 0.9],
          [404, 152, 0.7],
          [820, 152, 0.75],
        ].map(([x, y, s], i) => (
          <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d={PINE} />
        ))}
      </g>

      {/* stack of books with a sprout, centre stage */}
      <g transform="translate(600 122) scale(1.5)">
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

      <path d="M0 186 C240 164 420 192 640 180 C860 168 1020 190 1200 172 V200 H0 Z" fill="#0f6b5c" />
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
