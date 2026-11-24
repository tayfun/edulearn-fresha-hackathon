// A Renaissance townscape drawn in characters. The scene is composed for whatever number of
// columns fits the screen, so nothing is ever cropped: narrow screens get the dome and a few
// cypresses, wide ones add the bell tower, an arcade, a bridge and more hills.

export type Tone = "sky" | "hill" | "stone" | "tree" | "water" | "sun";
export type Cell = { ch: string; tone: Tone };
export type Scene = { cols: number; rows: number; cells: Cell[]; ground: number };

export const SCENE_ROWS = 24;

const DOME = [
  "              +              ",
  "              |              ",
  "             /_\\             ",
  "            |[_]|            ",
  "          _.-'''-._          ",
  "        .'  / | \\  '.        ",
  "       /   /  |  \\   \\       ",
  "      /   |   |   |   \\      ",
  "     |    |   |   |    |     ",
  "    _|____|___|___|____|_    ",
  "   [_____________________]   ",
  "    |  _  |  /^\\  |  _  |    ",
  "    | (_) |  |_|  | (_) |    ",
  "  __|_____|__|_|__|_____|__  ",
  " |___|___|___|_|___|___|___| ",
];

const TOWER = [
  "  /\\  ",
  " /__\\ ",
  " |[]| ",
  " |  | ",
  " |::| ",
  " |  | ",
  " |[]| ",
  " |  | ",
  " |::| ",
  " |  | ",
  " |[]| ",
  " |  | ",
  " |/\\| ",
  "_|||||_",
];

const CYPRESS_TALL = ["  ^  ", " /^\\ ", " |^| ", " |^| ", " |^| ", " \\^/ ", "  |  "];
const CYPRESS_SMALL = [" ^ ", "/^\\", "|^|", "\\^/", " | "];

const HOUSE = [
  "   ______   ",
  "  /______\\  ",
  " /________\\ ",
  " | [] [] |  ",
  " | [] /\\ |  ",
  " |____||_|  ",
];

const ARCADE_UNIT = ["_______", "  ___  ", " /   \\ ", "|     |", "|     |"];

const SUN = ["  \\ | /  ", "   .-.   ", "- ( O ) -", "   '-'   ", "  / | \\  "];

/** Deterministic 0..1 noise so the sky looks the same on every render. */
function noise(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function buildScene(cols: number, rows = SCENE_ROWS): Scene {
  cols = Math.max(32, Math.floor(cols));
  const cells: Cell[] = Array.from({ length: cols * rows }, () => ({ ch: " ", tone: "sky" as Tone }));
  const ground = rows - 5;
  const put = (x: number, y: number, ch: string, tone: Tone) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows && ch !== " ") cells[y * cols + x] = { ch, tone };
  };
  const taken = new Uint8Array(cols); // columns already holding a building or tree
  const free = (x: number, w: number) => {
    if (x < 1 || x + w > cols - 1) return false;
    for (let i = x - 1; i < x + w + 1; i++) if (taken[i]) return false;
    return true;
  };
  /** Stamp a sprite with its bottom row on `base`; inner spaces stay see-through only at the edges. */
  const stamp = (sprite: string[], x: number, base: number, tone: Tone) => {
    sprite.forEach((line, i) => {
      const y = base - (sprite.length - 1) + i;
      const first = line.search(/\S/);
      const last = line.length - 1 - [...line].reverse().join("").search(/\S/);
      for (let j = first; j <= last && first >= 0; j++) {
        if (x + j < 0 || x + j >= cols || y < 0 || y >= rows) continue;
        cells[y * cols + x + j] = { ch: line[j], tone };
      }
    });
    for (let i = Math.max(0, x); i < Math.min(cols, x + sprite[0].length); i++) taken[i] = 1;
  };

  // sky
  for (let y = 0; y < ground - 6; y++) {
    for (let x = 0; x < cols; x++) {
      const n = noise(x, y);
      if (n > 0.972) put(x, y, n > 0.992 ? "*" : n > 0.983 ? "+" : ".", "sky");
    }
  }

  // two ranges of hills
  const far = (x: number) => ground - 5 - Math.round(2.4 * Math.sin(x * 0.06 + 1) + 1.6 * Math.sin(x * 0.021 + 4));
  const near = (x: number) => ground - 1 - Math.round(1.1 * Math.sin(x * 0.045 + 2.4) + 0.6 * Math.sin(x * 0.11));
  for (let x = 0; x < cols; x++) {
    const f = far(x);
    put(x, f, far(x - 1) < f ? "\\" : far(x + 1) < f ? "/" : far(x - 1) > f ? "/" : "_", "hill");
    for (let y = f + 1; y < ground; y++) if (noise(x * 3, y * 7) > 0.93) put(x, y, y % 2 ? "." : ",", "hill");
  }

  // ground and river
  for (let x = 0; x < cols; x++) {
    put(x, ground + 1, "_", "stone");
    for (let y = ground + 2; y < rows; y++) put(x, y, "~-~ ~ -~"[(x + y * 3) % 8], "water");
  }

  // sun, high on the right
  if (cols >= 44) stamp(SUN, Math.round(cols * 0.84) - 4, 5, "sun");
  taken.fill(0);

  // the dome takes centre stage, with the bell tower beside it when there is room
  const mid = Math.floor(cols / 2);
  const domeX = mid - Math.floor(DOME[0].length / 2);
  stamp(DOME, domeX, ground + 1, "stone");
  if (cols >= 52) stamp(TOWER, domeX - TOWER[0].length - 1, ground + 1, "stone");

  // arcade to the left, houses and a bridge to the right, as width allows
  if (cols >= 96) {
    const units = Math.min(5, Math.floor((domeX - TOWER[0].length - 16) / 7));
    const ax = domeX - TOWER[0].length - 6 - units * 7;
    if (units >= 2 && ax > 4) {
      for (let u = 0; u < units; u++) stamp(ARCADE_UNIT, ax + u * 7, ground + 1, "stone");
      for (let x = ax - 1; x <= ax + units * 7; x++) put(x, ground - 4, x === ax - 1 ? "." : x === ax + units * 7 ? "." : "=", "stone");
    }
  }
  const right = domeX + DOME[0].length;
  if (cols >= 72 && free(right + 4, HOUSE[0].length)) stamp(HOUSE, right + 4, ground + 1, "stone");
  if (cols >= 110) {
    const bx = right + 22;
    const span = Math.min(30, cols - bx - 8);
    if (span >= 18) {
      for (let i = 0; i < span; i++) {
        put(bx + i, ground + 1, "=", "stone");
        put(bx + i, ground + 2, i % 6 === 0 ? "|" : i % 6 === 1 ? "/" : i % 6 === 5 ? "\\" : i % 6 === 3 ? "'" : " ", "stone");
        if (i % 6 === 0) put(bx + i, ground + 3, "|", "stone");
      }
      for (let i = 4; i < span - 4; i += 9) stamp(["  _  ", " /_\\ ", " |_| "], bx + i, ground, "stone");
      for (let i = bx - 1; i < bx + span + 1; i++) if (i >= 0 && i < cols) taken[i] = 1;
    }
  }

  // cypresses wherever a gap is left, taller ones first
  for (let x = 2; x < cols - 6; x++) {
    const n = noise(x, 99);
    if (n > 0.86 && free(x, 5)) stamp(CYPRESS_TALL, x, ground + 1, "tree");
    else if (n > 0.74 && free(x, 3)) stamp(CYPRESS_SMALL, x, ground + 1, "tree");
  }

  // the nearer slope, drawn last and only in the open ground between buildings and trees
  for (let x = 0; x < cols; x++) {
    const n = near(x);
    if (!taken[x] && cells[n * cols + x].ch === " ") put(x, n, near(x + 1) < n ? "/" : near(x - 1) < n ? "\\" : "-", "hill");
  }

  // a few birds over the rooftops
  for (const [dx, dy] of [[-9, 2], [-5, 1], [11, 3]] as const) {
    const bx = mid + dx * 2;
    if (bx > 1 && bx < cols - 2 && cells[dy * cols + bx].ch === " ") put(bx, dy + 1, "v", "sky");
  }

  return { cols, rows, cells, ground };
}

/** Plain-text rendering, used in tests and as the canvas fallback text. */
export const sceneText = (s: Scene) =>
  Array.from({ length: s.rows }, (_, y) => s.cells.slice(y * s.cols, (y + 1) * s.cols).map((c) => c.ch).join("")).join("\n");
