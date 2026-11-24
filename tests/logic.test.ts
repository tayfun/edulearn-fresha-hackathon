import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { LENGTHS, dailyPlan, fitMinutes, isWeak, matchConcept, nextMastery, progressPercent, reviewCard, streak, toneInstruction } from "../lib/logic";
import { extractJson } from "../lib/llm";

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
