"use client";

import { useEffect, useRef } from "react";
import { RAMP, SCENE_ROWS, Scene, Tone, buildScene } from "@/lib/ascii";

// Ink colours: periwinkle blues for the land, coral for the sun and its light.
const COLOR: Record<Tone, [string, number]> = {
  sky: ["#8ea2e8", 0.4],
  glow: ["#ff9478", 0.9],
  sun: ["#ff7a59", 1],
  far: ["#8fa0ee", 0.9],
  mid: ["#7c92f2", 0.85],
  land: ["#7d97ff", 0.9],
  tree: ["#a3b6ff", 1],
  water: ["#6f89ee", 0.6],
  shine: ["#ff8f70", 0.95],
};
// By day the sun and its light on the water are pale gold rather than coral.
const DAY: Partial<Record<Tone, [string, number]>> = { sun: ["#ffe08a", 1], glow: ["#ffe9a8", 0.7], shine: ["#fff0c4", 0.85] };
const SPARK = "@#%&$*+=<>/\\|";
const CELL_W = 4.2;
const CELL_H = 7;
const FONT_PX = 7;
const REACH = 9; // how far, in cell widths, the pointer disturbs the picture

/**
 * The footer artwork: a landscape engraving in ASCII (see lib/ascii.ts). A block cursor types
 * it in when it first scrolls into view; after that the sun's reflection shimmers on the water
 * and the pointer scrambles and lights up the characters it passes over, which settle back.
 */
export function AsciiScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const family = getComputedStyle(cv).fontFamily;
    const height = SCENE_ROWS * CELL_H;
    const plate = document.createElement("canvas"); // the finished picture, drawn once per size
    // A new landscape on every page load; it stays the same while the page is open, resizes included.
    const seed = 1 + Math.floor(Math.random() * 2 ** 31);
    let scene: Scene = buildScene(40);
    let shimmer: number[] = [];
    let heat = new Float32Array(0);
    let hot = new Set<number>();
    let revealed = still ? Infinity : 0;
    let visible = false;
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;
    let dpr = 1;

    const ink = (tone: Tone) => (!scene.sunset && DAY[tone]) || COLOR[tone];
    const paint = (c: CanvasRenderingContext2D, i: number, ch: string, color: string, alpha: number) => {
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.fillText(ch, (i % scene.cols) * CELL_W, ((i / scene.cols) | 0) * CELL_H);
    };

    const layout = () => {
      const width = el.clientWidth;
      if (!width) return;
      const cols = Math.ceil(width / CELL_W);
      scene = buildScene(cols, SCENE_ROWS, CELL_W / CELL_H, seed);
      heat = new Float32Array(cols * SCENE_ROWS);
      hot = new Set();
      shimmer = scene.cells.flatMap((c, i) => (c.tone === "shine" ? [i] : []));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [cv, plate]) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      cv.style.height = `${height}px`;
      const pc = plate.getContext("2d")!;
      for (const c of [ctx, pc]) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.font = `${FONT_PX}px ${family}`;
        c.textBaseline = "top";
      }
      scene.cells.forEach((cell, i) => {
        if (cell.ch === " ") return;
        const [color, alpha] = ink(cell.tone);
        paint(pc, i, cell.ch, color, alpha * (0.5 + 0.5 * cell.ink));
      });
      draw(0);
    };

    const draw = (frame: number) => {
      const { cols, rows, cells } = scene;
      const width = el.clientWidth;
      const total = cols * rows;
      const shown = Math.min(total, revealed);
      const fullRows = (shown / cols) | 0;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      // everything typed so far: whole rows, then the part of the row the cursor is on
      const blit = (x: number, y: number, w: number, h: number) => w > 0 && h > 0 && ctx.drawImage(plate, x * dpr, y * dpr, w * dpr, h * dpr, x, y, w, h);
      blit(0, 0, width, fullRows * CELL_H);
      if (shown < total) {
        blit(0, fullRows * CELL_H, (shown % cols) * CELL_W, CELL_H);
        ctx.fillStyle = "#eef2ff";
        ctx.fillRect((shown % cols) * CELL_W, fullRows * CELL_H, CELL_W, CELL_H);
      }
      const redraw = (i: number, ch: string, color: string, alpha: number) => {
        ctx.clearRect((i % cols) * CELL_W, ((i / cols) | 0) * CELL_H, CELL_W, CELL_H);
        paint(ctx, i, ch, color, alpha);
      };
      // the sun's path on the water flickers
      if (!still) {
        for (const i of shimmer) {
          if (i >= shown || hash3(i, frame >> 2) > 0.3) continue;
          redraw(i, "~=-*"[(hash3(i, frame) * 4) | 0], ink("shine")[0], 0.55 + 0.45 * hash3(frame, i));
        }
      }
      // characters the pointer has stirred up
      for (const i of hot) {
        const h = heat[i];
        if (i >= shown) continue;
        const cell = cells[i];
        const stirred = Math.random() < h;
        const ch = stirred ? SPARK[(Math.random() * SPARK.length) | 0] : cell.ch === " " ? RAMP[1 + ((h * 4) | 0)] : cell.ch;
        const warm = cell.tone === "sun" || cell.tone === "shine" || cell.tone === "glow";
        redraw(i, ch, h > 0.5 ? "#ffffff" : warm ? (scene.sunset ? "#ffc2ad" : "#fff3cf") : "#cdd8ff", Math.min(1, 0.35 + h));
      }
      ctx.globalAlpha = 1;
    };

    let frame = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || now - last < 33) return; // ~30 frames a second, and only while on screen
      last = now;
      frame++;
      const { cols, rows } = scene;
      if (revealed < cols * rows) revealed += Math.ceil((cols * rows) / 80); // about 2.7 seconds to type the scene
      if (pointer) {
        const px = pointer.x / CELL_W;
        const py = pointer.y / CELL_H;
        const reachY = (REACH * CELL_W) / CELL_H;
        for (let y = Math.max(0, Math.floor(py - reachY)); y < Math.min(rows, py + reachY); y++) {
          for (let x = Math.max(0, Math.floor(px - REACH)); x < Math.min(cols, px + REACH); x++) {
            const d = Math.hypot(x + 0.5 - px, ((y + 0.5 - py) * CELL_H) / CELL_W);
            if (d >= REACH) continue;
            const i = y * cols + x;
            heat[i] = Math.max(heat[i], 1 - d / REACH);
            hot.add(i);
          }
        }
      }
      for (const i of hot) {
        heat[i] *= 0.9;
        if (heat[i] < 0.06) {
          heat[i] = 0;
          hot.delete(i);
        }
      }
      draw(frame);
    };

    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const leave = () => (pointer = null);

    const resize = new ResizeObserver(layout);
    resize.observe(el);
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.05 });
    seen.observe(el);
    if (!still) {
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerdown", move);
      cv.addEventListener("pointerleave", leave);
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerdown", move);
      cv.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={wrap} aria-hidden className="w-full overflow-hidden">
      <canvas ref={canvas} className="block w-full touch-pan-y font-mono" />
    </div>
  );
}

/** Cheap repeatable randomness for the shimmer, so it does not depend on Math.random's rhythm. */
function hash3(a: number, b: number) {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
