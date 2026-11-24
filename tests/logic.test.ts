import { describe, expect, it } from "vitest";
import { openDb, uniqueSlug } from "../lib/db";
import { LENGTHS, activityGrid, cleanSvg, dailyPlan, inspectSvg, fitMinutes, isWeak, matchConcept, nextMastery, progressPercent, reviewCard, slugify, streak, toneInstruction } from "../lib/logic";
import { extractJson } from "../lib/llm";
import { RAMP, SCENE_ROWS, buildScene, sceneText } from "../lib/ascii";

describe("mastery", () => {
  it("first answer sets mastery, later answers move it halfway", () => {
    expect(nextMastery(null, false)).toBe(0);
    expect(nextMastery(null, true)).toBe(1);
    expect(nextMastery(0, true)).toBe(0.5);
    expect(nextMastery(0.5, true)).toBe(0.75);
    expect(nextMastery(1, false)).toBe(0.5);
  });
  it("one miss is weak until two correct answers follow; untested is not weak", () => {
    expect(isWeak(null)).toBe(false);
    expect(isWeak(nextMastery(null, false))).toBe(true);
    expect(isWeak(nextMastery(0, true))).toBe(true);
    expect(isWeak(nextMastery(0.5, true))).toBe(false);
  });
});

describe("progress", () => {
  it("weights lessons by length", () => {
    expect(progressPercent([])).toBe(0);
    expect(progressPercent([{ est_minutes: 30, completed_at: "x" }, { est_minutes: 10, completed_at: null }])).toBe(75);
    expect(progressPercent([{ est_minutes: 5, completed_at: "x" }])).toBe(100);
  });
  it("fits estimates to the course length", () => {
    expect(fitMinutes([10, 10, 20], 120)).toEqual([30, 30, 60]);
    expect(fitMinutes([0, NaN], 10)).toEqual([5, 5]);
    expect(fitMinutes([], 10)).toEqual([]);
  });
});

describe("flashcard scheduling", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("promotes on a hit and resets on a miss", () => {
    expect(reviewCard(1, true, now)).toEqual({ box: 2, dueAt: "2026-01-02 00:00:00" });
    expect(reviewCard(2, true, now)).toEqual({ box: 3, dueAt: "2026-01-04 00:00:00" });
    expect(reviewCard(5, true, now).box).toBe(5);
    expect(reviewCard(4, false, now)).toEqual({ box: 1, dueAt: "2026-01-01 00:00:00" });
  });
});

describe("streak", () => {
  const today = new Date("2026-03-10T15:00:00Z");
  it("counts consecutive days ending today or yesterday", () => {
    expect(streak([], today)).toBe(0);
    expect(streak(["2026-03-10", "2026-03-09", "2026-03-08"], today)).toBe(3);
    expect(streak(["2026-03-09", "2026-03-08"], today)).toBe(2);
    expect(streak(["2026-03-08"], today)).toBe(0);
    expect(streak(["2026-03-10", "2026-03-08"], today)).toBe(1);
  });
});

describe("daily plan", () => {
  const lessons = [
    { id: 1, title: "a", est_minutes: 30, completed_at: "2026-03-01 10:00:00" },
    { id: 2, title: "b", est_minutes: 30, completed_at: null },
    { id: 3, title: "c", est_minutes: 30, completed_at: null },
  ];
  it("is absent for single-sitting courses", () => {
    expect(dailyPlan("30min", "2026-03-01 09:00:00", lessons)).toBeNull();
  });
  it("suggests lessons up to the daily target", () => {
    const plan = dailyPlan("1w", "2026-03-01 09:00:00", lessons, new Date("2026-03-02T12:00:00Z"))!;
    expect(plan.dailyMinutes).toBe(Math.ceil(LENGTHS["1w"].minutes / 7));
    expect(plan.dayNumber).toBe(2);
    expect(plan.minutesToday).toBe(0);
    expect(plan.upNext.map((l) => l.id)).toEqual([2, 3]);
    expect(plan.targetMet).toBe(false);
  });
  it("marks the target met once enough is done today", () => {
    const plan = dailyPlan("1w", "2026-03-01 09:00:00", [{ ...lessons[0], est_minutes: 45 }, lessons[1]], new Date("2026-03-01T12:00:00Z"))!;
    expect(plan.targetMet).toBe(true);
    expect(plan.upNext).toEqual([]);
  });
});

describe("helpers", () => {
  it("matches concept names loosely and falls back to the first", () => {
    const known = [{ name: "Chlorophyll" }, { name: "Light reactions" }];
    expect(matchConcept("light reactions", known)).toBe(known[1]);
    expect(matchConcept("the light reactions stage", known)).toBe(known[1]);
    expect(matchConcept("unrelated", known)).toBe(known[0]);
    expect(matchConcept("x", [])).toBeUndefined();
  });
  it("maps tone presets and passes custom tones through", () => {
    expect(toneInstruction("Beginner")).toMatch(/no prior knowledge/i);
    expect(toneInstruction("like a pirate")).toContain("like a pirate");
  });
  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('<think>hmm {x}</think>Sure: {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("course illustration", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><circle cx="1" cy="1" r="1"/><path d="M0 0L1 1"/><rect width="2" height="2"/></svg>';
  it("accepts plain geometry, with or without surrounding chatter", () => {
    expect(cleanSvg(ok)).toBe(ok);
    expect(cleanSvg("Here you go:\n```svg\n" + ok + "\n```")).toBe(ok);
  });
  const robots = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" stroke-linecap="round" stroke-linejoin="round">
  <path d="M200 62V52" fill="none" stroke="#22d3ee" stroke-width="3"/>
  <circle cx="200" cy="44" r="6" fill="none" stroke="#22d3ee" stroke-width="3"/>
  <rect x="155" y="62" width="90" height="68" rx="16" fill="none" stroke="#22d3ee" stroke-width="3"/>

  <path d="M183 108Q200 120 217 108" fill="none" stroke="#67e8f9" stroke-width="1.5"/>
  <circle cx="140" cy="135" r="2.5" fill="#a5f3fc" stroke="none"/>
</svg>`;
  it("accepts a real model drawing", () => {
    expect(cleanSvg(robots)).toBe(robots);
  });
  it("takes the final drawing when the reply also holds prose or an earlier draft", () => {
    const reply = `First attempt:\n<svg viewBox="0 0 1 1"><circle r="1"/></svg>\nThat was too sparse. I must avoid <style>, <script> and href="..." as instructed.\nFinal:\n\`\`\`svg\n${robots}\n\`\`\`\nDone, no <image> used.`;
    expect(cleanSvg(reply)).toBe(robots);
  });
  it("cleans a drawing instead of rejecting it", () => {
    const messy = ok
      .replace("<circle", '<!-- lens --><title>Camera</title><style>.a{stroke:red}</style><script>alert(1)</script><circle onload="x()"')
      .replace("<rect", '<image href="http://x/y.png"/><text x="1" y="1">hi</text><rect');
    expect(cleanSvg(messy)).toBe(ok);
  });
  it("adds a viewBox when the model leaves it out", () => {
    expect(cleanSvg(ok.replace(' viewBox="0 0 400 240"', ""))).toContain('viewBox="0 0 400 240"');
  });
  it("says why when nothing usable is left", () => {
    expect(inspectSvg("no drawing")).toEqual({ svg: null, reason: "the reply contained no <svg> element" });
    expect(inspectSvg('<svg viewBox="0 0 1 1"><circle r="1"/>').reason).toMatch(/cut off/);
    expect(inspectSvg('<svg viewBox="0 0 1 1"><circle r="1"/></svg>').reason).toMatch(/only 1 shape/);
    expect(inspectSvg(ok.replace("<rect", '<rect style="fill:url(http://x)"')).reason).toMatch(/outside itself/);
    expect(cleanSvg(ok.replace("<rect", '<rect fill="url(#g)"'))).not.toBeNull();
  });
});

describe("activity grid", () => {
  it("lays out Monday-first weeks ending in the current week", () => {
    // 2026-03-11 is a Wednesday.
    const grid = activityGrid({ "2026-03-11": 3, "2026-03-09": 1 }, 2, new Date("2026-03-11T15:00:00Z"));
    expect(grid).toHaveLength(2);
    expect(grid[0][0].date).toBe("2026-03-02");
    expect(grid[1].map((d) => d.count)).toEqual([1, 0, 3, 0, 0, 0, 0]);
    expect(grid[1].map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
  });
});

describe("database", () => {
  it("creates the schema and cascades course deletion", () => {
    const db = openDb(":memory:");
    const c = db.prepare("INSERT INTO courses (topic, title, tone, length_preset) VALUES ('t','T','Beginner','5min')").run().lastInsertRowid;
    const m = db.prepare("INSERT INTO modules (course_id, position, title) VALUES (?,0,'M')").run(c).lastInsertRowid;
    db.prepare("INSERT INTO lessons (course_id, module_id, position, title) VALUES (?,?,0,'L')").run(c, m);
    db.prepare("INSERT INTO concepts (course_id, name) VALUES (?, 'X')").run(c);
    db.prepare("DELETE FROM courses WHERE id = ?").run(c);
    for (const t of ["modules", "lessons", "concepts"]) {
      expect((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
    }
  });
});

describe("ascii scene", () => {
  const toneAt = (cols: number, u: number, v: number) => {
    const scene = buildScene(cols);
    return scene.cells[Math.floor(v * scene.rows) * scene.cols + Math.floor(u * scene.cols)].tone;
  };
  it("fills any width exactly, using only the ink ramp", () => {
    for (const cols of [24, 93, 183, 343, 460]) {
      const lines = sceneText(buildScene(cols)).split("\n");
      expect(lines).toHaveLength(SCENE_ROWS);
      expect(lines.every((l) => l.length === cols && [...l].every((ch) => RAMP.includes(ch)))).toBe(true);
    }
  });
  it("is composed like the reference: clear sky, a sun on the horizon, a river below it, trees at both sides", () => {
    for (const cols of [93, 343]) {
      expect(toneAt(cols, 0.5, 0.05)).toBe("sky");
      expect(toneAt(cols, 0.5, 0.55)).toBe("sun");
      expect(["water", "shine"]).toContain(toneAt(cols, 0.5, 0.8));
      expect(toneAt(cols, 0.01, 0.97)).toBe("tree");
      expect(toneAt(cols, 0.99, 0.97)).toBe("tree");
      const tones = new Set(buildScene(cols).cells.map((c) => c.tone));
      for (const t of ["glow", "far", "mid", "land", "tree", "water", "shine"]) expect(tones.has(t as never)).toBe(true);
    }
  });
  it("leaves the upper sky almost empty and the foreground dense", () => {
    const scene = buildScene(343);
    const inkOfRow = (r: number) => scene.cells.slice(r * scene.cols, (r + 1) * scene.cols).reduce((s, c) => s + c.ink, 0) / scene.cols;
    expect(inkOfRow(scene.rows - 1)).toBeGreaterThan(0.6);
    // the middle half of the top row is open sky between the trees
    const top = scene.cells.slice(Math.floor(scene.cols * 0.3), Math.floor(scene.cols * 0.7));
    expect(top.filter((c) => c.ch !== " ").length / top.length).toBeLessThan(0.05);
  });
  it("gives the same picture for the same seed and a different one for another", () => {
    const text = (seed: number) => sceneText(buildScene(183, SCENE_ROWS, 0.6, seed));
    expect(text(7)).toBe(text(7));
    expect(text(7)).not.toBe(text(8));
    expect(text(0)).toBe(sceneText(buildScene(183, SCENE_ROWS, 0.6)));
  });
  it("keeps the composition whatever the seed: sun on the horizon over the river, trees at both edges", () => {
    for (const seed of [1, 2, 3, 99, 12345, 2 ** 31 - 1]) {
      const scene = buildScene(343, SCENE_ROWS, 0.6, seed);
      const at = (u: number, v: number) => scene.cells[Math.floor(v * scene.rows) * scene.cols + Math.floor(u * scene.cols)].tone;
      expect(scene.sunU).toBeGreaterThan(0.3);
      expect(scene.sunU).toBeLessThan(0.7);
      expect(at(scene.sunU, 0.555)).toBe("sun");
      expect(["water", "shine"]).toContain(at(scene.sunU, 0.62));
      expect(at(0.01, 0.97)).toBe("tree");
      expect(at(0.99, 0.97)).toBe("tree");
      expect(new Set(scene.cells.map((c) => c.tone)).size).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("course addresses", () => {
  it("turns titles into readable slugs", () => {
    expect(slugify("Black Holes: Made Simple!")).toBe("black-holes-made-simple");
    expect(slugify("  Café & Crème — 101  ")).toBe("cafe-creme-101");
    expect(slugify("1984")).toBe("course-1984");
    expect(slugify("???")).toBe("course-untitled");
    expect(slugify("x".repeat(80) + " tail").length).toBeLessThanOrEqual(60);
  });
  it("keeps slugs unique and backfills courses created before slugs existed", () => {
    const db = openDb(":memory:");
    const add = (title: string) => db.prepare("INSERT INTO courses (topic, title, slug, tone, length_preset) VALUES ('t', ?, ?, 'Beginner', '5min')").run(title, uniqueSlug(db, title));
    add("Black Holes Made Simple");
    add("Black Holes Made Simple");
    add("Black Holes Made Simple");
    expect((db.prepare("SELECT slug FROM courses ORDER BY id").all() as { slug: string }[]).map((r) => r.slug)).toEqual(["black-holes-made-simple", "black-holes-made-simple-2", "black-holes-made-simple-3"]);
  });
});
