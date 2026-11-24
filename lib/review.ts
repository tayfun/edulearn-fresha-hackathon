import { z } from "zod";
import { getCourseRow } from "./courses";
import { getDb } from "./db";
import { chatJson } from "./llm";
import { matchConcept, reviewCard, toneInstruction } from "./logic";
import { weakConcepts } from "./quiz";
import { touchSession } from "./session";
import { webSearch } from "./tavily";

type ConceptStat = { id: number; name: string; mastery: number | null; correct: number; incorrect: number; last_seen_at: string | null };

function missedQuestions(conceptId: number, limit = 3) {
  return getDb()
    .prepare(
      `SELECT q.prompt, q.type, q.options, q.correct_answer, a.response FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE q.concept_id = ? AND a.is_correct = 0 ORDER BY a.id DESC LIMIT ?`,
    )
    .all(conceptId, limit)
    .map((r) => {
      const row = r as { prompt: string; type: string; options: string; correct_answer: string; response: string };
      const options = JSON.parse(row.options) as string[];
      const show = (v: string) => (row.type === "mcq" ? (options[Number(v)] ?? "no answer") : v || "no answer");
      return { prompt: row.prompt, answered: show(row.response), correct: show(row.correct_answer) };
    });
}

/** Everything the weaknesses page shows: all tracked concepts, weak ones with advice, resources and lessons to revisit. */
export function getWeaknesses(courseId: number) {
  const db = getDb();
  const course = getCourseRow(courseId);
  const concepts = db.prepare("SELECT id, name, mastery, correct, incorrect, last_seen_at FROM concepts WHERE course_id = ? ORDER BY id").all(courseId) as ConceptStat[];
  const weakIds = new Set(weakConcepts(courseId).map((c) => c.id));
  const weak = concepts
    .filter((c) => weakIds.has(c.id))
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
    .map((c) => {
      const rec = db.prepare("SELECT advice, steps, created_at FROM recommendations WHERE concept_id = ? ORDER BY id DESC LIMIT 1").get(c.id) as { advice: string; steps: string; created_at: string } | undefined;
      return {
        ...c,
        missed: missedQuestions(c.id),
        lessons: db.prepare("SELECT l.id, l.title FROM lessons l JOIN lesson_concepts lc ON lc.lesson_id = l.id WHERE lc.concept_id = ? ORDER BY l.position").all(c.id),
        resources: db.prepare("SELECT id, title, url, snippet FROM resources WHERE concept_id = ?").all(c.id),
        recommendation: rec ? { advice: rec.advice, steps: JSON.parse(rec.steps) as string[], stale: !!c.last_seen_at && rec.created_at < c.last_seen_at } : null,
        flashcards: (db.prepare("SELECT COUNT(*) AS n FROM flashcards WHERE concept_id = ?").get(c.id) as { n: number }).n,
      };
    });
  return {
    course: { id: course.id, title: course.title },
    weak,
    tracked: concepts.filter((c) => c.mastery !== null).map((c) => ({ id: c.id, name: c.name, mastery: c.mastery, correct: c.correct, incorrect: c.incorrect })),
    untested: concepts.filter((c) => c.mastery === null).length,
  };
}

const RecSchema = z.object({
  items: z.array(z.object({ concept: z.string(), advice: z.string().min(5), steps: z.array(z.string()).default([]) })),
});

/** Write advice for weak concepts that have none yet (or whose advice predates their latest quiz result). */
export async function generateRecommendations(courseId: number) {
  const db = getDb();
  const course = getCourseRow(courseId);
  const targets = getWeaknesses(courseId).weak.filter((c) => !c.recommendation || c.recommendation.stale).slice(0, 5);
  if (targets.length === 0) return 0;

  const searches = await Promise.all(targets.map((c) => webSearch(`${c.name} ${course.topic} explained with examples`, 3)));
  const res = await chatJson({
    schema: RecSchema,
    model: "fast",
    messages: [
      {
        role: "system",
        content: `You are a learning coach. For each concept the learner is weak on, diagnose the likely misunderstanding from the questions they got wrong, and recommend how to fix it. Reply with JSON:
{"items":[{"concept":string (copied exactly from the input),"advice":string (2-3 sentences: what they seem to be misunderstanding and the correct way to think about it),"steps":[string] (2-4 concrete, specific actions, e.g. an exercise to try, what to re-read and what to look for, how to self-test)}]}
Speak directly to the learner ("you"). Style: ${toneInstruction(course.tone)}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          course: course.title,
          concepts: targets.map((c, i) => ({
            concept: c.name,
            mastery_percent: Math.round((c.mastery ?? 0) * 100),
            questions_missed: c.missed,
            lessons_covering_it: (c.lessons as { title: string }[]).map((l) => l.title),
            available_resources: searches[i].map((r) => r.title),
          })),
        }),
      },
    ],
  });

  db.transaction(() => {
    targets.forEach((c, i) => {
      const item = res.items.find((x) => x.concept.trim().toLowerCase() === c.name.toLowerCase()) ?? res.items[i];
      if (!item) return;
      db.prepare("DELETE FROM recommendations WHERE concept_id = ?").run(c.id);
      db.prepare("INSERT INTO recommendations (course_id, concept_id, advice, steps) VALUES (?,?,?,?)").run(courseId, c.id, item.advice, JSON.stringify(item.steps));
      if (searches[i].length) {
        db.prepare("DELETE FROM resources WHERE concept_id = ?").run(c.id);
        for (const r of searches[i]) db.prepare("INSERT INTO resources (course_id, concept_id, title, url, snippet) VALUES (?,?,?,?,?)").run(courseId, c.id, r.title, r.url, r.snippet);
      }
    });
  })();
  return targets.length;
}

// ---------- flashcards ----------

const CardSchema = z.object({
  cards: z.array(z.object({ concept: z.string().default(""), front: z.string().min(3), back: z.string().min(1) })).min(1),
});

/** Generate flashcards for the learner's weak concepts. */
export async function generateFlashcards(courseId: number) {
  const db = getDb();
  const course = getCourseRow(courseId);
  const targets = getWeaknesses(courseId).weak.slice(0, 6);
  if (targets.length === 0) throw new Error("No weak concepts yet. Flashcards are built from what quizzes show you are struggling with.");
  const existing = db.prepare("SELECT front FROM flashcards WHERE course_id = ?").all(courseId) as { front: string }[];

  const res = await chatJson({
    schema: CardSchema,
    model: "fast",
    messages: [
      {
        role: "system",
        content: `You write flashcards that fix specific misunderstandings. Reply with JSON: {"cards":[{"concept":string (copied exactly from the input),"front":string (one clear question or prompt),"back":string (the answer, max 2 sentences)}]}
Write 3 cards per concept: one that states the core idea, one that targets the mistake the learner made, and one that applies the idea to a small example. One fact per card. Do not duplicate the existing cards. Style: ${toneInstruction(course.tone)}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          course: course.title,
          concepts: targets.map((c) => ({ concept: c.name, questions_missed: c.missed })),
          existing_cards: existing.map((e) => e.front).slice(-40),
        }),
      },
    ],
  });

  const insert = db.prepare("INSERT INTO flashcards (course_id, concept_id, front, back) VALUES (?,?,?,?)");
  db.transaction(() => {
    for (const card of res.cards) insert.run(courseId, matchConcept(card.concept, targets)?.id ?? null, card.front, card.back);
  })();
  return res.cards.length;
}

export function getFlashcards(courseId: number) {
  const db = getDb();
  const course = getCourseRow(courseId);
  const cards = db
    .prepare(
      `SELECT f.id, f.front, f.back, f.box, f.due_at, f.reviews, c.name AS concept, f.due_at <= datetime('now') AS due
       FROM flashcards f LEFT JOIN concepts c ON c.id = f.concept_id WHERE f.course_id = ? ORDER BY f.due_at, f.id`,
    )
    .all(courseId) as { id: number; front: string; back: string; box: number; due_at: string; reviews: number; concept: string | null; due: number }[];
  return { course: { id: course.id, title: course.title }, cards, weakCount: weakConcepts(courseId).length };
}

export function reviewFlashcard(cardId: number, knewIt: boolean) {
  const db = getDb();
  const card = db.prepare("SELECT id, course_id, box FROM flashcards WHERE id = ?").get(cardId) as { id: number; course_id: number; box: number } | undefined;
  if (!card) return null;
  const next = reviewCard(card.box, knewIt);
  db.prepare("UPDATE flashcards SET box = ?, due_at = ?, reviews = reviews + 1 WHERE id = ?").run(next.box, next.dueAt, cardId);
  touchSession(card.course_id, { cards: 1 });
  return next;
}

export function deleteFlashcard(cardId: number) {
  getDb().prepare("DELETE FROM flashcards WHERE id = ?").run(cardId);
}
