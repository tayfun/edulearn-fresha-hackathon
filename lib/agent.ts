import { z } from "zod";
import { NotFound, getCourseRow } from "./courses";
import { getDb } from "./db";
import { chatJson } from "./llm";
import { WEAK_THRESHOLD, toneInstruction } from "./logic";
import { traceNote } from "./trace";

/**
 * The EduLearn agent, as one loop over a learner and a course. Each step lives where its data
 * lives; this file holds the two decisions that tie the loop together (what to study, what to
 * do next) and the diagnostic that feeds the first of them.
 */
export const AGENT_STEPS = [
  { id: "assess", label: "Assesses existing knowledge", where: "lib/agent.ts: createAssessment, gradeAssessment" },
  { id: "decide-study", label: "Decides what the learner needs to study", where: "lib/agent.ts: decideStudyFocus" },
  { id: "curriculum", label: "Creates a personalised curriculum", where: "lib/courses.ts: createCourse" },
  { id: "resources", label: "Searches for relevant educational resources", where: "lib/tavily.ts, used by createCourse and generateRecommendations" },
  { id: "teach", label: "Generates lessons and exercises", where: "lib/courses.ts: lessonContentStream; lib/quiz.ts: createQuiz" },
  { id: "evaluate", label: "Evaluates learner responses", where: "lib/quiz.ts: submitAttempt" },
  { id: "gaps", label: "Identifies knowledge gaps", where: "lib/quiz.ts mastery updates; lib/review.ts: getWeaknesses" },
  { id: "next", label: "Decides what learning activity should happen next", where: "lib/agent.ts: decideNextActivity" },
] as const;

// ---------- 1. assess existing knowledge ----------

const AssessmentSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().min(5),
        options: z.array(z.string().min(1)).length(4),
        answer_index: z.coerce.number().int().min(0).max(3),
        concept: z.string().min(1),
        level: z.enum(["basic", "intermediate", "advanced"]).default("basic"),
      }),
    )
    .min(3)
    .max(6),
});
type AssessmentQuestion = z.infer<typeof AssessmentSchema>["questions"][number];

/** Write a short diagnostic for a topic and store it; correct answers stay on the server. */
export async function createAssessment(input: { topic: string; goal: string; tone: string }) {
  const res = await chatJson({
    label: `Agent · assess: write a diagnostic for "${input.topic}"`,
    schema: AssessmentSchema,
    messages: [
      {
        role: "system",
        content: `You are assessing what a learner already knows before designing a course for them. Write exactly 5 multiple-choice questions on the topic, ordered from basic to advanced (2 basic, 2 intermediate, 1 advanced), each testing a different core concept so the result shows where their knowledge stops. Reply with JSON:
{"questions":[{"prompt":string,"options":[4 strings],"answer_index":0-3,"concept":string (1-4 words),"level":"basic"|"intermediate"|"advanced"}]}
Wrong options must be plausible. Vary the position of the correct option. Do not use "all of the above". Wording style: ${toneInstruction(input.tone)}`,
      },
      { role: "user", content: `Topic: ${input.topic}\nWhat the learner wants: ${input.goal || "not specified"}` },
    ],
  });
  const id = Number(getDb().prepare("INSERT INTO assessments (topic, questions) VALUES (?, ?)").run(input.topic, JSON.stringify(res.questions)).lastInsertRowid);
  traceNote("db", "Agent · assess: save diagnostic", `assessment #${id}, ${res.questions.length} questions`);
  return { id, questions: res.questions.map((q) => ({ prompt: q.prompt, options: q.options, level: q.level })) };
}

export type AssessmentResult = { concept: string; level: string; prompt: string; correct: boolean; skipped: boolean };

/** Grade a submitted diagnostic. An answer of -1 means "I don't know". */
export function gradeAssessment(id: number, answers: number[]): AssessmentResult[] {
  const row = getDb().prepare("SELECT questions FROM assessments WHERE id = ?").get(id) as { questions: string } | undefined;
  if (!row) throw new NotFound("Assessment not found");
  const questions = JSON.parse(row.questions) as AssessmentQuestion[];
  const results = questions.map((q, i) => ({ concept: q.concept, level: q.level, prompt: q.prompt, correct: answers[i] === q.answer_index, skipped: answers[i] === undefined || answers[i] < 0 }));
  traceNote("db", "Agent · assess: grade diagnostic", `${results.filter((r) => r.correct).length}/${results.length} correct`, {
    results: results.map((r) => `${r.correct ? "✓" : r.skipped ? "?" : "✗"} [${r.level}] ${r.concept}`).join("\n"),
  });
  return results;
}

// ---------- 2. decide what the learner needs to study ----------

const FocusSchema = z.object({
  summary: z.string().min(5),
  known: z.array(z.string()).default([]),
  focus: z.array(z.string()).default([]),
  start_level: z.string().default(""),
});
export type StudyFocus = z.infer<typeof FocusSchema> & { score: number; total: number };

/** Turn diagnostic results into a decision the curriculum is then built around. */
export async function decideStudyFocus(input: { topic: string; goal: string; priorKnowledge: string; results: AssessmentResult[] }): Promise<StudyFocus> {
  const score = input.results.filter((r) => r.correct).length;
  const total = input.results.length;
  try {
    const res = await chatJson({
      label: `Agent · decide what to study (diagnostic ${score}/${total})`,
      schema: FocusSchema,
      messages: [
        {
          role: "system",
          content: `You decide what a learner needs to study, from a diagnostic they just took. Reply with JSON:
{"summary":string (2 sentences to the learner, "you": what they already have and where the course will concentrate),"known":[string] (short concept names, 1-4 words each, that they clearly have; the course should only touch these briefly),"focus":[string] (short concept names, 1-4 words each, that the course must teach properly, most important first, including what lies just beyond where their knowledge stopped; at most 6),"start_level":string (one short phrase, e.g. "from the very basics" or "skip the introduction, start at intermediate")}
A correct answer on a basic question is weak evidence; a wrong or "don't know" answer is strong evidence of a gap. Be honest, not flattering.`,
        },
        { role: "user", content: JSON.stringify({ topic: input.topic, goal: input.goal, says_they_know: input.priorKnowledge, diagnostic: input.results.map(({ concept, level, correct, skipped }) => ({ concept, level, result: correct ? "correct" : skipped ? "did not know" : "wrong" })) }) },
      ],
    });
    return { ...res, score, total };
  } catch {
    // The decision still has to be made if the model fails: fall back to the raw results.
    return {
      summary: `You answered ${score} of ${total} diagnostic questions correctly, so the course concentrates on what you missed.`,
      known: input.results.filter((r) => r.correct).map((r) => r.concept),
      focus: input.results.filter((r) => !r.correct).map((r) => r.concept),
      start_level: score === total ? "skip the introduction" : score === 0 ? "from the very basics" : "",
      score,
      total,
    };
  }
}

/** How a study decision is handed to the curriculum designer. */
export function focusBrief(focus: StudyFocus | null): string {
  if (!focus) return "";
  return `\nDiagnostic result (${focus.score}/${focus.total} correct). The course MUST follow this decision:
- Already known, cover only briefly or build on: ${focus.known.join(", ") || "nothing established"}
- Needs proper teaching, in priority order: ${focus.focus.join(", ") || "the whole topic"}
- Where to start: ${focus.start_level || "as fits the level"}`;
}

// ---------- 8. decide what learning activity should happen next ----------

export type NextActivity = {
  action: "lesson" | "practice" | "flashcards" | "revisit" | "complete";
  title: string;
  reason: string;
  /** Lesson number within the course, for "lesson" and "revisit". */
  lessonNumber: number | null;
  decidedBy: "agent" | "rules";
};

type Option = Omit<NextActivity, "reason" | "decidedBy">;

/** Drop a "Lesson 3:" style prefix the model sometimes puts in titles; the number is shown separately. */
const bareTitle = (title: string) => title.replace(/^(module|lesson|week|part|unit)\s+\d+\s*[:.\-–—]\s*/i, "");

const ChoiceSchema = z.object({ choice: z.coerce.number().int(), reason: z.string().min(5) });

/**
 * Pick the learner's next activity from the ones that are actually possible right now. The model
 * chooses and explains; simple rules stand in if it fails. The decision is stored against the
 * state it was made for, so it is only re-made when something changes.
 */
export async function decideNextActivity(courseId: number): Promise<NextActivity> {
  const db = getDb();
  const course = getCourseRow(courseId);
  const lessons = (db.prepare("SELECT id, title, position + 1 AS number, est_minutes, completed_at FROM lessons WHERE course_id = ? ORDER BY position").all(courseId) as { id: number; title: string; number: number; est_minutes: number; completed_at: string | null }[]).map((l) => ({ ...l, title: bareTitle(l.title) }));
  const weak = db.prepare("SELECT id, name, mastery, correct, incorrect FROM concepts WHERE course_id = ? AND mastery IS NOT NULL AND mastery < ? ORDER BY mastery").all(courseId, WEAK_THRESHOLD) as { id: number; name: string; mastery: number; correct: number; incorrect: number }[];
  const dueCards = (db.prepare("SELECT COUNT(*) AS n FROM flashcards WHERE course_id = ? AND due_at <= datetime('now')").get(courseId) as { n: number }).n;
  const lastAttempt = db.prepare("SELECT a.score, q.kind FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE q.course_id = ? ORDER BY a.id DESC LIMIT 1").get(courseId) as { score: number; kind: string } | undefined;
  const next = lessons.find((l) => !l.completed_at);
  const done = lessons.filter((l) => l.completed_at);

  const options: Option[] = [];
  if (next) options.push({ action: "lesson", title: `${done.length ? "Continue with" : "Start"} lesson ${next.number}: ${next.title}`, lessonNumber: next.number });
  if (weak.length) options.push({ action: "practice", title: `Practice quiz on ${weak.slice(0, 3).map((w) => w.name).join(", ")}`, lessonNumber: null });
  if (dueCards) options.push({ action: "flashcards", title: `Review ${dueCards} flashcard${dueCards === 1 ? "" : "s"}`, lessonNumber: null });
  if (weak.length) {
    const revisit = db
      .prepare("SELECT l.title, l.position + 1 AS number FROM lessons l JOIN lesson_concepts lc ON lc.lesson_id = l.id WHERE lc.concept_id = ? AND l.completed_at IS NOT NULL ORDER BY l.position DESC LIMIT 1")
      .get(weak[0].id) as { title: string; number: number } | undefined;
    if (revisit) options.push({ action: "revisit", title: `Re-read lesson ${revisit.number}: ${bareTitle(revisit.title)}`, lessonNumber: revisit.number });
  }
  if (options.length === 0) return { action: "complete", title: "Course complete", reason: "Every lesson is done and nothing is left to review.", lessonNumber: null, decidedBy: "rules" };

  const state = {
    lessons_done: done.length,
    lessons_total: lessons.length,
    weak_concepts: weak.map((w) => ({ name: w.name, mastery_percent: Math.round(w.mastery * 100), wrong: w.incorrect, right: w.correct })),
    flashcards_due: dueCards,
    last_quiz: lastAttempt ? { kind: lastAttempt.kind, score_percent: Math.round(lastAttempt.score * 100) } : null,
    options: options.map((o, i) => ({ choice: i, activity: o.title })),
  };
  const key = JSON.stringify(state);
  const stored = (db.prepare("SELECT next_activity FROM courses WHERE id = ?").get(courseId) as { next_activity: string | null }).next_activity;
  if (stored) {
    const saved = JSON.parse(stored) as { key: string; activity: NextActivity };
    if (saved.key === key) return saved.activity;
  }

  let activity: NextActivity;
  if (options.length === 1) {
    activity = { ...options[0], reason: next ? "Nothing needs reviewing, so the next lesson is the best use of your time." : "This is all that is left to do.", decidedBy: "rules" };
  } else {
    try {
      const res = await chatJson({
        label: `Agent · decide next activity (${options.length} options)`,
        schema: ChoiceSchema,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a tutor deciding the single best next activity for a learner in the course "${course.title}". Choose one of the listed options and reply with JSON: {"choice":number,"reason":string (one sentence to the learner, "you", naming the specific concept or lesson and why now)}.
Guidance: fix a fresh, serious gap (mastery under 40%, or a quiz just failed) before moving on, with a practice quiz or by re-reading the lesson; a mild gap should not block progress; due flashcards are quick and worth doing when there are several; otherwise keep the learner moving to the next lesson. Do not recommend the same remedial activity when there is nothing new to fix.`,
          },
          { role: "user", content: key },
        ],
      });
      const picked = options[res.choice];
      if (!picked) throw new Error("choice out of range");
      activity = { ...picked, reason: res.reason, decidedBy: "agent" };
    } catch {
      const serious = weak.some((w) => w.mastery < 0.4);
      const picked = (serious && options.find((o) => o.action === "practice")) || (dueCards >= 5 && options.find((o) => o.action === "flashcards")) || options[0];
      activity = { ...picked, reason: serious ? `${weak[0].name} needs another look before you move on.` : "Keep your momentum going.", decidedBy: "rules" };
    }
  }
  db.prepare("UPDATE courses SET next_activity = ? WHERE id = ?").run(JSON.stringify({ key, activity }), courseId);
  traceNote("db", "Agent · next activity decided", `${activity.title} (${activity.decidedBy})`, { reason: activity.reason });
  return activity;
}
