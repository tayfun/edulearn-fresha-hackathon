import { beforeEach, describe, expect, it } from "vitest";
import { AGENT_STEPS, decideNextActivity, focusBrief, gradeAssessment } from "../lib/agent";
import { openDb, setDb } from "../lib/db";

let db: ReturnType<typeof openDb>;
beforeEach(() => {
  db = openDb(":memory:");
  setDb(db);
});

const question = (concept: string, answer_index: number, level = "basic") => ({ prompt: `About ${concept}?`, options: ["a", "b", "c", "d"], answer_index, concept, level });

function course(lessons: { done: boolean }[]) {
  const id = Number(db.prepare("INSERT INTO courses (topic, title, slug, tone, length_preset) VALUES ('t','T','t','Beginner','30min')").run().lastInsertRowid);
  const m = db.prepare("INSERT INTO modules (course_id, position, title) VALUES (?,0,'M')").run(id).lastInsertRowid;
  lessons.forEach((l, i) => db.prepare("INSERT INTO lessons (course_id, module_id, position, title, completed_at) VALUES (?,?,?,?,?)").run(id, m, i, `L${i + 1}`, l.done ? "2026-01-01 00:00:00" : null));
  return id;
}

describe("agent", () => {
  it("names the eight steps of the workflow", () => {
    expect(AGENT_STEPS.map((s) => s.id)).toEqual(["assess", "decide-study", "curriculum", "resources", "teach", "evaluate", "gaps", "next"]);
  });

  it("grades a diagnostic, treating -1 and missing answers as not known", () => {
    const id = Number(db.prepare("INSERT INTO assessments (topic, questions) VALUES ('t', ?)").run(JSON.stringify([question("orbits", 2), question("tides", 0), question("redshift", 1, "advanced")])).lastInsertRowid);
    const results = gradeAssessment(id, [2, -1]);
    expect(results.map((r) => [r.concept, r.correct, r.skipped])).toEqual([
      ["orbits", true, false],
      ["tides", false, true],
      ["redshift", false, true],
    ]);
    expect(() => gradeAssessment(999, [])).toThrow();
  });

  it("briefs the curriculum designer with the study decision", () => {
    expect(focusBrief(null)).toBe("");
    const brief = focusBrief({ summary: "s", known: ["orbits"], focus: ["tides", "redshift"], start_level: "skip the introduction", score: 1, total: 3 });
    expect(brief).toContain("1/3 correct");
    expect(brief).toContain("Already known, cover only briefly or build on: orbits");
    expect(brief).toContain("priority order: tides, redshift");
  });

  it("goes straight to the next lesson when nothing needs review, without asking the model", async () => {
    const id = course([{ done: true }, { done: false }, { done: false }]);
    const next = await decideNextActivity(id);
    expect(next).toMatchObject({ action: "lesson", lessonNumber: 2, decidedBy: "rules" });
    expect(next.title).toBe("Continue with lesson 2: L2");
  });

  it("reports the course complete when every lesson is done and nothing is weak or due", async () => {
    expect(await decideNextActivity(course([{ done: true }]))).toMatchObject({ action: "complete", lessonNumber: null });
  });

  it("falls back to rules, fixing a serious gap first, when the model cannot be reached", async () => {
    const saved = process.env.NEBIUS_API_KEY;
    delete process.env.NEBIUS_API_KEY;
    try {
      const id = course([{ done: true }, { done: false }]);
      db.prepare("INSERT INTO concepts (course_id, name, mastery, incorrect) VALUES (?, 'Tides', 0, 2)").run(id);
      const next = await decideNextActivity(id);
      expect(next).toMatchObject({ action: "practice", decidedBy: "rules" });
      expect(next.reason).toContain("Tides");
      // the decision is stored and reused while the state is unchanged
      expect(await decideNextActivity(id)).toEqual(next);
    } finally {
      if (saved) process.env.NEBIUS_API_KEY = saved;
    }
  });
});
