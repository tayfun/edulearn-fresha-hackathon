// The footer landscape, as a tonal ASCII engraving: tall trees framing a river that runs to a
// sunset between layered mountains. Nature only. The picture is computed, not stored: every
// character cell asks `shade` how much ink falls on it and which layer it belongs to, and the
// answer picks a character from a light-to-dark ramp. Because it is computed per cell it fills
// any number of columns exactly, so nothing is ever cropped.

export type Tone = "sky" | "glow" | "sun" | "far" | "mid" | "land" | "tree" | "water" | "shine";
export type Cell = { ch: string; tone: Tone; ink: number };
export type Scene = {
  cols: number;
  rows: number;
  cells: Cell[];
  /** Where the sun sits: 0..1 across, and 0..1 down the picture. */
  sunU: number;
  sunV: number;
  /** True when the sun is on the horizon; false for a daytime sky with the sun up. */
  sunset: boolean;
  /** How many trees stand at the left and right edges. */
  trees: [left: number, right: number];
};

export const SCENE_ROWS = 64;
/** Characters from least to most ink. */
export const RAMP = " .,:;-~=+*o%#@";

const HORIZON = 0.58;

type Peak = [centre: number, width: number, height: number];
/** Everything about one particular landscape that a seed decides. */
type Look = { shift: number; sunU: number; sunV: number; sunset: boolean; far: Peak[]; mid: Peak[]; bend: number; phase: number; left: Tree; right: Tree };

/** Seed 0 is the reference composition; any other seed rearranges it. */
function lookFor(seed: number): Look {
  if (!seed) {
    return {
      shift: 0,
      sunU: 0.5,
      far: [[0.8, 0.13, 0.2], [0.16, 0.15, 0.12], [0.35, 0.07, 0.08], [0.64, 0.05, 0.06]],
      mid: [[0.07, 0.17, 0.09], [0.93, 0.15, 0.08], [0.7, 0.08, 0.045], [0.28, 0.07, 0.04]],
      bend: 0.045,
      phase: 0.4,
      left: LEFT,
      right: RIGHT,
      sunV: HORIZON,
      sunset: true,
    };
  }
  let state = Math.floor(seed) >>> 0 || 1;
  const rnd = () => {
    // mulberry32: small, fast, and repeatable for a given seed
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const range = (count: number, minH: number, maxH: number, minW: number, maxW: number): Peak[] =>
    Array.from({ length: count }, (_, i) => [between(i / count, (i + 1) / count), between(minW, maxW), between(minH, maxH)]);
  /** A stand of `count` trees: the one nearest the edge is tallest, each with its own cluster of crowns. */
  const stand = (count: number): Tree => {
    const tree: Tree = { trunks: [], crowns: [] };
    for (let i = 0; i < count; i++) {
      const baseX = 0.05 + i * between(0.075, 0.105);
      const topX = baseX + between(-0.03, 0.06);
      const topY = Math.min(0.62, between(0.16, 0.3) + i * between(0.05, 0.1));
      const size = between(0.085, 0.13) * (1 - i * 0.1);
      tree.trunks.push([baseX, topX, topY]);
      tree.crowns.push([topX, topY - size * 0.45, size]);
      const extra = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < extra; k++) tree.crowns.push([topX + between(-1.25, 1.25) * size, topY + between(-0.75, 0.9) * size, size * between(0.5, 0.85)]);
    }
    return tree;
  };
  const sunset = rnd() < 0.5;
  // one to four trees a side, and now and then one side left open
  let leftCount = 1 + Math.floor(rnd() * 4);
  let rightCount = 1 + Math.floor(rnd() * 4);
  const open = rnd();
  if (open < 0.12) leftCount = 0;
  else if (open < 0.24) rightCount = 0;
  return {
    shift: between(10, 5000),
    sunU: between(0.36, 0.64),
    sunV: sunset ? HORIZON : between(0.14, 0.3),
    sunset,
    left: stand(leftCount),
    right: stand(rightCount),
    far: range(5, 0.05, 0.22, 0.05, 0.15),
    mid: range(5, 0.03, 0.1, 0.06, 0.17),
    bend: between(0.02, 0.07) * (rnd() < 0.5 ? -1 : 1),
    phase: between(0, 6.28),
  };
}

// Set once the tree shapes below exist, and again by every buildScene call.
let look: Look;

function hash(x: number, y: number) {
  const n = Math.sin((x + look.shift) * 127.1 + (y + look.shift * 0.37) * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
/** Smooth value noise, 0..1. */
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;
const bump = (u: number, centre: number, width: number) => Math.exp(-(((u - centre) / width) ** 2));

// Trees are described in units of the picture's height, measured from the nearer side edge.
type Tree = { trunks: [baseX: number, topX: number, topY: number][]; crowns: [x: number, y: number, r: number][] };
const LEFT: Tree = {
  trunks: [[0.1, 0.17, 0.2], [0.2, 0.22, 0.3], [0.05, 0.04, 0.36]],
  crowns: [[0.13, 0.13, 0.14], [0.28, 0.17, 0.11], [0.04, 0.27, 0.1], [0.22, 0.31, 0.1], [0.36, 0.26, 0.07], [0.15, 0.43, 0.07], [0.3, 0.07, 0.07]],
};
const RIGHT: Tree = {
  trunks: [[0.09, 0.13, 0.26], [0.17, 0.16, 0.36]],
  crowns: [[0.1, 0.2, 0.13], [0.23, 0.27, 0.11], [0.05, 0.37, 0.09], [0.2, 0.13, 0.09], [0.31, 0.41, 0.07], [0.14, 0.5, 0.06]],
};

look = lookFor(0);

function inTree(tree: Tree, x: number, y: number, scale: number): number {
  const px = x / scale;
  const py = 1 - (1 - y) / scale; // scale about the ground, so smaller trees still stand on it
  for (const [bx, tx, ty] of tree.trunks) {
    if (py < ty || py > 0.99) continue;
    const t = (py - ty) / (0.99 - ty);
    const cx = tx + (bx - tx) * t * t + 0.008 * Math.sin(py * 22 + bx * 40);
    if (Math.abs(px - cx) < 0.006 + 0.012 * t) return 1;
  }
  for (const [cx, cy, r] of tree.crowns) {
    const d = Math.hypot(px - cx, (py - cy) * 1.15);
    const edge = r * (0.72 + 0.55 * fbm(px * 16 + cx * 9, py * 16));
    if (d < edge) {
      const leaf = fbm(px * 46, py * 46);
      if (leaf < 0.3) continue; // gaps where the sky shows through the leaves
      return 0.5 + 0.5 * leaf * (1 - 0.35 * (d / edge));
    }
  }
  return 0;
}

/** How much ink (0..1) lands at a point, and which layer of the picture it belongs to. */
export function shade(u: number, v: number, aspect: number): { ink: number; tone: Tone } {
  const x = u * aspect;
  const scale = Math.max(0.72, Math.min(1, aspect / 2.6));

  // framing trees and the undergrowth at their feet come first: they stand in front of everything
  const tree = Math.max(inTree(look.left, x, v, scale), inTree(look.right, aspect - x, v, scale));
  if (tree) return { ink: tree, tone: "tree" };
  const brush = 0.93 - 0.17 * bump(u, 0, 0.22) - 0.17 * bump(u, 1, 0.2) + 0.035 * fbm(u * 14 * aspect, 3);
  if (v > brush) return { ink: Math.min(1, 0.45 + (v - brush) * 4 + 0.45 * fbm(x * 30, v * 30) + (v > 0.965 ? 0.4 : 0)), tone: "tree" };

  const { sunU, sunV, sunset } = look;
  const gap = sunset ? 1 : 0.25; // the ranges only open up for a setting sun
  const peaks = (list: Peak[]) => list.reduce((sum, [c, w, h]) => sum + h * bump(u, c, w), 0);
  // both ranges part where the sun sets
  const far = HORIZON - (0.035 + peaks(look.far) + 0.05 * fbm(u * 9, 1)) * (1 - 0.7 * gap * bump(u, sunU, 0.1));
  const mid = HORIZON - (0.014 + peaks(look.mid) + 0.035 * fbm(u * 14, 5)) * (1 - 0.95 * gap * bump(u, sunU, 0.1));

  if (v < HORIZON) {
    const sx = sunU * aspect;
    const sunDist = Math.hypot(x - sx, v - sunV);
    // each range is hatched lightly, darker along its crest and its shaded folds
    if (v > mid) return { ink: Math.min(0.9, 0.34 + (v - mid < 0.02 ? 0.3 : 0) + 0.4 * fbm(x * 14, v * 14)), tone: "mid" };
    if (sunDist < (sunset ? 0.075 : 0.055)) return { ink: 1, tone: "sun" };
    if (v > far) return { ink: Math.min(0.75, 0.3 + (v - far < 0.02 ? 0.3 : 0) + 0.22 * fbm(x * 10 + v * 24, v * 18)), tone: "far" };
    if (sunset) {
      // clear above, with thin streaks of sunset cloud low over the horizon
      const streak = fbm(x * 4, v * 60) * Math.exp(-(((x - sx) / 1.1) ** 2)) * Math.exp(-((HORIZON - v) / 0.2));
      if (streak > 0.24) return { ink: Math.min(0.8, (streak - 0.24) * 3 + 0.12), tone: "glow" };
    } else {
      // daytime: a halo round the high sun and a few flat-bottomed clouds drifting across
      if (sunDist < 0.11 && fbm(x * 60, v * 60) > 0.5) return { ink: 0.3 * (1 - sunDist / 0.11) + 0.08, tone: "glow" };
      const cloud = fbm(x * 2.4 + 7, v * 11) - 0.1 * Math.abs(v - 0.22) * 8;
      if (cloud > 0.53 && v < 0.46) return { ink: Math.min(0.55, (cloud - 0.53) * 3.5 + 0.08), tone: "sky" };
    }
    return { ink: hash(Math.floor(x * 300), Math.floor(v * 300)) > 0.988 ? 0.1 : 0, tone: "sky" };
  }

  // below the horizon: a river that widens towards the viewer, between two banks
  const t = (v - HORIZON) / (1 - HORIZON);
  const centre = sunU + look.bend * (Math.sin(t * 5.2 + look.phase) - Math.sin(look.phase)) + (0.5 - sunU) * t * 0.6;
  const half = 0.03 + 0.34 * t ** 1.25 + 0.03 * (fbm(v * 26, u < centre ? 1 : 9) - 0.5);
  const off = Math.abs(u - centre);
  if (off < half) {
    const ripple = noise(x * 26, v * 190);
    if (Math.abs(u - sunU) < ((sunset ? 0.014 : 0.008) + 0.035 * t) / Math.max(1, aspect / 2.6) + 0.004 && ripple > (sunset ? 0.4 : 0.55)) return { ink: 0.55 + 0.4 * ripple, tone: "shine" };
    return { ink: 0.12 + (ripple > 0.6 ? 0.3 : 0) + 0.12 * t, tone: "water" };
  }
  // banks: clumps of trees and scrub that grow larger towards the viewer, darkest at the waterline
  const near = 0.45 + t;
  const clump = fbm((x * 15) / near, (v * 17) / near);
  const copse = Math.max(0, Math.min(1, (clump - 0.42) * 5)); // round dark masses of trees
  const shore = off - half < 0.008 ? 0.3 : 0;
  return { ink: Math.min(1, 0.16 + 0.1 * t + 0.7 * copse + shore), tone: "land" };
}

/** Build the picture for a grid of `cols` x `rows` cells. The same seed always gives the same landscape. */
export function buildScene(cols: number, rows = SCENE_ROWS, cellAspect = 0.55, seed = 0): Scene {
  cols = Math.max(24, Math.floor(cols));
  look = lookFor(seed);
  const aspect = (cols * cellAspect) / rows;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { ink, tone } = shade((c + 0.5) / cols, (r + 0.5) / rows, aspect);
      // a little grain keeps flat areas from banding, like the dots of an engraving
      const grained = ink <= 0 ? 0 : Math.max(0.05, Math.min(1, ink + (hash(c, r) - 0.5) * 0.3));
      cells.push({ ch: RAMP[Math.round(grained * (RAMP.length - 1))], tone, ink: grained });
    }
  }
  return { cols, rows, cells, sunU: look.sunU, sunV: look.sunV, sunset: look.sunset, trees: [look.left.trunks.length, look.right.trunks.length] };
}

/** Plain-text rendering, used in tests. */
export const sceneText = (s: Scene) =>
  Array.from({ length: s.rows }, (_, y) => s.cells.slice(y * s.cols, (y + 1) * s.cols).map((c) => c.ch).join("")).join("\n");
