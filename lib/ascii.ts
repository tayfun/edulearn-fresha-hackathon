// A Renaissance-style landscape drawn in characters: mountains, rolling hills, cypresses,
// stone pines and olive trees above a river. Nature only, no buildings. The scene is composed
// for whatever number of columns fits the screen, so nothing is ever cropped: narrow screens
// get a peak, the great pine and a few cypresses; wide ones add more ranges, trees and clouds.

export type Tone = "sky" | "hill" | "stone" | "tree" | "water" | "sun";
export type Cell = { ch: string; tone: Tone };
export type Scene = { cols: number; rows: number; cells: Cell[]; ground: number };

export const SCENE_ROWS = 24;

const GREAT_PINE = [
  "    .-~~~~~~~-.    ",
  " .-(  ~  ~~  ~ )-. ",
  "(  ~~   ~   ~~  ~ )",
  " '-(_ ~~  ~  ~_)-' ",
  "     '--\\ /--'     ",
  "         | |       ",
  "         | |       ",
  "         | |       ",
  "        /| |\\      ",
];

const STONE_PINE = [" .-~~~-. ", "( ~ ~ ~ )", " '-._.-' ", "    |    ", "    |    ", "    |    "];
const CYPRESS_TALL = ["  ^  ", " /^\\ ", " |^| ", " |^| ", " |^| ", " \\^/ ", "  |  "];
const CYPRESS_SMALL = [" ^ ", "/^\\", "|^|", "\\^/", " | "];
const OLIVE = [" .oOo. ", "(OoOoO)", " 'oOo' ", "   Y   "];
const BUSH = [".oOo.", "(ooo)"];
const REEDS = ["\\|/", " | "];

const CLOUD_BIG = ["    .--.      ", " .-(    ).-.  ", "(___.__)____) "];
const CLOUD_SMALL = ["  .-.   ", " (   ). ", "(___)__)"];
const SUN = ["  \\ | /  ", "   .-.   ", "- ( O ) -", "   '-'   ", "  / | \\  "];

/** Deterministic 0..1 noise so the picture is the same on every render. */
function noise(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function buildScene(cols: number, rows = SCENE_ROWS): Scene {
  cols = Math.max(32, Math.floor(cols));
  const cells: Cell[] = Array.from({ length: cols * rows }, () => ({ ch: " ", tone: "sky" as Tone }));
  const ground = rows - 5;
  const at = (x: number, y: number) => cells[y * cols + x];
  const put = (x: number, y: number, ch: string, tone: Tone) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows && ch !== " ") cells[y * cols + x] = { ch, tone };
  };
  const taken = new Uint8Array(cols); // columns already holding a tree
  const free = (x: number, w: number) => {
    if (x < 1 || x + w > cols - 1) return false;
    for (let i = x - 1; i < x + w + 1; i++) if (taken[i]) return false;
    return true;
  };
  /** Stamp a sprite with its bottom row on `base`. Each row is solid between its outermost characters. */
  const stamp = (sprite: string[], x: number, base: number, tone: Tone, reserve = true) => {
    sprite.forEach((line, i) => {
      const y = base - (sprite.length - 1) + i;
      const first = line.search(/\S/);
      if (first < 0) return;
      const last = line.trimEnd().length - 1;
      for (let j = first; j <= last; j++) {
        if (x + j < 0 || x + j >= cols || y < 0 || y >= rows) continue;
        cells[y * cols + x + j] = { ch: line[j], tone };
      }
    });
    if (reserve) for (let i = Math.max(0, x); i < Math.min(cols, x + sprite[0].length); i++) taken[i] = 1;
  };

  const far = (x: number) => ground - 5 - Math.round(2.4 * Math.sin(x * 0.06 + 1) + 1.6 * Math.sin(x * 0.021 + 4));
  const near = (x: number) => ground - 1 - Math.round(1.1 * Math.sin(x * 0.045 + 2.4) + 0.6 * Math.sin(x * 0.11));
  const mid = Math.floor(cols / 2);

  // sun and clouds
  const sunX = Math.round(cols * 0.84) - 4;
  if (cols >= 44) stamp(SUN, sunX, 5, "sun", false);
  const cloudSpots: [number, number, string[]][] = [
    [0.08, 3, CLOUD_BIG],
    [0.56, 2, CLOUD_SMALL],
    [0.3, 5, CLOUD_SMALL],
    [0.68, 5, CLOUD_BIG],
  ];
  cloudSpots.slice(0, cols < 60 ? 1 : cols < 100 ? 2 : 4).forEach(([fx, base, sprite]) => {
    const x = Math.round(cols * fx);
    if (x + sprite[0].length < sunX - 2 || x > sunX + 11) stamp(sprite, x, base, "sky", false);
  });

  // mountains: a main peak just off centre, more ranges as width allows
  const peaks: [number, number][] = [[mid - 6, 10]];
  if (cols >= 60) peaks.push([mid + 14, 7]);
  if (cols >= 90) peaks.push([mid - 30, 8], [mid + 36, 6]);
  if (cols >= 130) peaks.push([mid - 54, 6], [mid + 58, 8]);
  peaks.sort((a, b) => a[1] - b[1]); // tallest drawn last, in front
  for (const [cx, h] of peaks) {
    const base = ground - 4;
    for (let i = 0; i < h; i++) {
      const y = base - h + 1 + i;
      for (let x = cx - i; x <= cx + i + 1; x++) {
        if (x < 0 || x >= cols || y < 0) continue;
        const edge = x === cx - i ? "/" : x === cx + i + 1 ? "\\" : " ";
        // snow near the summit, sparse rock texture lower down
        const inside = i < 3 ? (i > 0 && noise(x, y) > 0.35 ? "*" : " ") : noise(x * 5, y * 3) > 0.9 ? (x % 2 ? "." : "'") : " ";
        cells[y * cols + x] = { ch: edge !== " " ? edge : inside, tone: i < 3 && edge === " " ? "sky" : "stone" };
      }
    }
  }

  // far hills in front of the mountains' feet
  for (let x = 0; x < cols; x++) {
    const f = far(x);
    for (let y = f; y <= ground; y++) cells[y * cols + x] = { ch: " ", tone: "hill" };
    put(x, f, far(x - 1) < f ? "\\" : far(x + 1) < f ? "/" : far(x - 1) > f ? "/" : "_", "hill");
    for (let y = f + 1; y < ground; y++) if (noise(x * 3, y * 7) > 0.93) put(x, y, y % 2 ? "." : ",", "hill");
  }

  // river bank and river
  for (let x = 0; x < cols; x++) {
    put(x, ground + 1, noise(x, 7) > 0.8 ? '"' : "_", "hill");
    for (let y = ground + 2; y < rows; y++) put(x, y, "~-~ ~ -~"[(x + y * 3) % 8], "water");
  }

  // the great stone pine stands on the bank at the centre
  stamp(GREAT_PINE, Math.max(1, Math.min(mid + 2, cols - GREAT_PINE[0].length - 1)), ground + 1, "tree");

  // other trees wherever a gap is left: pines, cypresses, olives, bushes
  for (let x = 2; x < cols - 9; x++) {
    const n = noise(x, 99);
    if (n > 0.93 && cols >= 70 && free(x, 9)) stamp(STONE_PINE, x, ground + 1, "tree");
    else if (n > 0.84 && free(x, 5)) stamp(CYPRESS_TALL, x, ground + 1, "tree");
    else if (n > 0.74 && free(x, 3)) stamp(CYPRESS_SMALL, x, ground + 1, "tree");
    else if (n > 0.66 && free(x, 7)) stamp(OLIVE, x, ground + 1, "tree");
    else if (n > 0.6 && free(x, 5)) stamp(BUSH, x, ground + 1, "tree");
  }

  // the nearer slope, only in the open ground between trees
  for (let x = 0; x < cols; x++) {
    const n = near(x);
    if (!taken[x] && at(x, n).ch === " ") put(x, n, near(x + 1) < n ? "/" : near(x - 1) < n ? "\\" : "-", "hill");
  }

  // reeds at the water's edge
  for (let x = 3; x < cols - 4; x++) {
    if (noise(x, 41) > 0.9 && !taken[x] && !taken[x + 1] && !taken[x + 2]) {
      stamp(REEDS, x, ground + 2, "tree", false);
      x += 6;
    }
  }

  // a few birds in open sky
  for (const [dx, dy] of [[-18, 2], [-14, 1], [22, 3], [26, 2]] as const) {
    const bx = mid + dx;
    if (bx > 1 && bx < cols - 2 && at(bx, dy).ch === " " && at(bx - 1, dy).ch === " " && at(bx + 1, dy).ch === " ") put(bx, dy, "v", "sky");
  }

  return { cols, rows, cells, ground };
}

/** Plain-text rendering, used in tests. */
export const sceneText = (s: Scene) =>
  Array.from({ length: s.rows }, (_, y) => s.cells.slice(y * s.cols, (y + 1) * s.cols).map((c) => c.ch).join("")).join("\n");
