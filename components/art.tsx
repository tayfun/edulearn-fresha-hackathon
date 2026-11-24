// Decorative SVG artwork. Everything here is aria-hidden: it carries no information.

const STARS = [
  [60, 60, 1.8], [170, 130, 1.2], [260, 40, 1.4], [350, 100, 1.1], [450, 36, 1.7], [540, 150, 1.2], [630, 60, 1.3], [720, 120, 1.1],
  [800, 40, 1.6], [880, 150, 1], [960, 70, 1.3], [1120, 50, 1.5], [1170, 150, 1.2], [30, 200, 1.1], [400, 210, 1], [690, 230, 1.2],
];

/** Dusk landscape behind the course header. The progress ring sits where the sun would be, above the ridge. */
export function HeroArt() {
  return (
    <svg aria-hidden viewBox="0 0 1200 600" preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#052a25" />
          <stop offset="0.5" stopColor="#0c5a4d" />
          <stop offset="0.78" stopColor="#1d8171" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#f6b84a" stopOpacity="0.2" />
          <stop offset="1" stopColor="#f6b84a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#052a25" stopOpacity="0.8" />
          <stop offset="0.6" stopColor="#052a25" stopOpacity="0.2" />
          <stop offset="1" stopColor="#052a25" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="600" fill="url(#sky)" />

      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff7df" className="twinkle" style={{ "--i": i } as React.CSSProperties} />
      ))}

      <circle cx="1040" cy="270" r="230" fill="url(#sun)" className="sun-glow" />

      <g fill="#ffffff" opacity="0.13">
        <g className="drift" style={{ "--d": "110s", "--o": "-40s" } as React.CSSProperties}>
          <ellipse cx="0" cy="170" rx="80" ry="13" />
          <ellipse cx="52" cy="158" rx="50" ry="12" />
        </g>
        <g className="drift" style={{ "--d": "150s", "--o": "-110s" } as React.CSSProperties}>
          <ellipse cx="0" cy="250" rx="100" ry="11" />
          <ellipse cx="-56" cy="240" rx="56" ry="10" />
        </g>
      </g>

      {/* far range, kept below the ring */}
      <path d="M0 430 L110 388 L200 414 L320 362 L430 410 L540 380 L660 418 L760 372 L840 338 L930 396 L1010 368 L1100 402 L1200 360 V600 H0 Z" fill="#0b5246" />
      <path d="M840 338 L812 368 L830 362 L842 376 L856 361 L874 371 Z" fill="#eaf6f1" opacity="0.8" />
      <g transform="translate(840 338)">
        <line x1="0" y1="0" x2="0" y2="-30" stroke="#fff7df" strokeWidth="2" strokeLinecap="round" />
        <path d="M1 -30 L22 -24 L1 -17 Z" fill="#f6b84a" className="flag-wave" />
      </g>
      {/* mid hills */}
      <path d="M0 462 C140 418 280 440 420 456 C560 472 680 420 820 440 C940 456 1060 426 1200 444 V600 H0 Z" fill="#08433a" />
      <g fill="#06342d">
        {[[1050, 446, 1], [1086, 452, 0.8], [1130, 444, 1.15], [1172, 454, 0.9], [610, 452, 0.8], [644, 456, 0.65], [90, 458, 0.9], [126, 462, 0.7]].map(([x, y, s], i) => (
          <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -34 L11 -12 H6 L15 6 H3 V14 H-3 V6 H-15 L-6 -12 H-11 Z" />
        ))}
      </g>
      {/* flat dark ground: the lesson trail is drawn on top of this */}
      <path d="M0 492 C220 470 440 486 640 478 C860 470 1020 488 1200 474 V600 H0 Z" fill="#06342d" />
      <rect width="1200" height="600" fill="url(#fade)" />
    </svg>
  );
}

/** Rolling hills, a few trees, a stack of books and a paper plane closing the page. */
export function FooterArt() {
  return (
    <svg aria-hidden viewBox="0 0 1200 170" preserveAspectRatio="xMidYMax slice" className="block h-36 w-full sm:h-44">
      <path d="M0 110 C160 60 300 86 470 104 C640 122 760 52 930 74 C1040 88 1120 70 1200 82 V170 H0 Z" fill="#e3f1ed" />
      <path d="M0 134 C200 96 380 140 600 122 C820 104 1000 138 1200 108 V170 H0 Z" fill="#bfded5" />

      {/* paper plane on a looping flight path */}
      <path id="flight" d="M-40 70 C180 10 320 90 520 46 C720 2 860 74 1240 22" fill="none" stroke="#0f6b5c" strokeWidth="1.2" strokeDasharray="2 8" opacity="0.35" />
      <g className="fly" style={{ offsetPath: "path('M-40 70 C180 10 320 90 520 46 C720 2 860 74 1240 22')" }}>
        <path d="M-14 -7 L14 0 L-14 7 L-8 0 Z" fill="#0f6b5c" />
        <path d="M-8 0 L14 0 L-14 7 Z" fill="#0a4f44" />
      </g>

      {/* trees */}
      {[[150, 112, 1], [190, 118, 0.75], [1030, 104, 1.1], [1075, 110, 0.8], [760, 98, 0.7]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-2" y="-4" width="4" height="16" rx="1" fill="#0a4f44" />
          <circle cx="0" cy="-16" r="15" fill="#0f6b5c" />
          <circle cx="-9" cy="-8" r="9" fill="#157a69" />
          <circle cx="9" cy="-9" r="8" fill="#0d6052" />
        </g>
      ))}

      {/* stack of books with a sprout */}
      <g transform="translate(560 96)">
        <g className="bob">
        <rect x="-34" y="18" width="68" height="13" rx="2.5" fill="#0a4f44" />
        <rect x="-28" y="20.5" width="40" height="2" rx="1" fill="#e3f1ed" opacity="0.7" />
        <rect x="-28" y="5" width="60" height="13" rx="2.5" fill="#f6b84a" />
        <rect x="-22" y="7.5" width="30" height="2" rx="1" fill="#fff7df" opacity="0.8" />
        <rect x="-32" y="-8" width="58" height="13" rx="2.5" fill="#b45309" />
        <rect x="-26" y="-5.5" width="34" height="2" rx="1" fill="#fdf1dc" opacity="0.8" />
        <path d="M-2 -8 V-24" stroke="#0f6b5c" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M-2 -18 C-14 -20 -16 -30 -15 -33 C-8 -32 -2 -27 -2 -18 Z" fill="#157a69" />
        <path d="M-2 -22 C8 -23 12 -32 11 -36 C4 -35 -2 -30 -2 -22 Z" fill="#0f6b5c" />
        </g>
      </g>

      <path d="M0 152 C240 132 420 162 640 148 C860 134 1020 158 1200 140 V170 H0 Z" fill="#0f6b5c" />
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
