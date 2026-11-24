"use client";

import { useEffect, useRef } from "react";
import { SCENE_ROWS, Scene, Tone, buildScene } from "@/lib/ascii";

const COLOR: Record<Tone, string> = { sky: "#6f8fae", hill: "#1f7d94", stone: "#67e8f9", tree: "#2dd4bf", water: "#1795b3", sun: "#fbbf24" };
const SPARK = "@#%&$*+=<>/\\|";
const CELL_W = 8.4;
const CELL_H = 15;
const FONT_PX = 14;
const REACH = 4.5; // how far, in cells, the pointer disturbs the picture

/**
 * The footer artwork: a Renaissance-style landscape in ASCII (mountains, hills, pines, cypresses
 * and a river; no buildings). A block cursor types it in when it first scrolls into view; after
 * that the water moves and the pointer scrambles and lights up the characters it passes over,
 * which then settle back.
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
    let scene: Scene = buildScene(40);
    let heat = new Float32Array(0);
    let revealed = still ? Infinity : 0;
    let visible = false;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let raf = 0;
    let last = 0;

    const layout = () => {
      const width = el.clientWidth;
      const cols = Math.max(32, Math.floor(width / CELL_W));
      scene = buildScene(cols);
      heat = new Float32Array(cols * SCENE_ROWS);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(width * dpr);
      cv.height = Math.round(SCENE_ROWS * CELL_H * dpr);
      cv.style.height = `${SCENE_ROWS * CELL_H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT_PX}px ${family}`;
      ctx.textBaseline = "top";
      draw();
    };

    const draw = () => {
      const { cols, rows, cells, ground } = scene;
      const offsetX = (el.clientWidth - cols * CELL_W) / 2;
      ctx.clearRect(0, 0, el.clientWidth, rows * CELL_H);
      const total = cols * rows;
      const shown = Math.min(total, revealed);
      for (let i = 0; i < shown; i++) {
        const x = i % cols;
        const y = (i / cols) | 0;
        let { ch } = cells[i];
        const tone = cells[i].tone;
        const h = heat[i];
        if (tone === "water" && !still) ch = "~-~ ~ -~"[(x + y * 3 + ((frame / 5) | 0)) % 8];
        if (ch === "v" && !still && ((frame / 12) | 0) % 2 === (x % 2)) ch = "^"; // birds flap
        if (h > 0.08 && Math.random() < h) ch = SPARK[(Math.random() * SPARK.length) | 0];
        else if (ch === " ") continue;
        if (h > 0.08) {
          ctx.fillStyle = h > 0.55 ? "#ecfeff" : "#a5f3fc";
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 10 * h;
        } else {
          ctx.fillStyle = COLOR[tone];
          ctx.shadowBlur = tone === "stone" || tone === "sun" ? 5 : 0;
          ctx.shadowColor = tone === "sun" ? "#fbbf24" : "#22d3ee";
        }
        ctx.fillText(ch, offsetX + x * CELL_W, y * CELL_H - (h > 0.08 ? h * 2 : 0));
        if (y > ground + 6) break;
      }
      // the typing cursor
      if (shown < total) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#22d3ee";
        ctx.fillStyle = "#ecfeff";
        ctx.fillRect(offsetX + (shown % cols) * CELL_W, ((shown / cols) | 0) * CELL_H, CELL_W, CELL_H - 2);
      }
      ctx.shadowBlur = 0;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || now - last < 33) return; // ~30 frames a second, and only while on screen
      last = now;
      frame++;
      const { cols, rows } = scene;
      if (revealed < cols * rows) revealed += Math.ceil((cols * rows) / 75); // about 2.5 seconds to type the scene
      if (pointer) {
        const px = pointer.x / CELL_W;
        const py = pointer.y / CELL_H;
        for (let y = Math.max(0, Math.floor(py - REACH)); y < Math.min(rows, py + REACH); y++) {
          for (let x = Math.max(0, Math.floor(px - REACH)); x < Math.min(cols, px + REACH); x++) {
            const d = Math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.7);
            if (d < REACH) heat[y * cols + x] = Math.max(heat[y * cols + x], 1 - d / REACH);
          }
        }
      }
      for (let i = 0; i < heat.length; i++) heat[i] *= 0.9;
      draw();
    };

    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const offsetX = (el.clientWidth - scene.cols * CELL_W) / 2;
      pointer = { x: e.clientX - r.left - offsetX, y: e.clientY - r.top };
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
