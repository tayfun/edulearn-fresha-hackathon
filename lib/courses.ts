import { z } from "zod";
import { getDb } from "./db";
import { chatJson, chatStream, chatText } from "./llm";
import { LENGTHS, LengthPreset, WEAK_THRESHOLD, activityGrid, dailyPlan, inspectSvg, fitMinutes, progressPercent, toneInstruction } from "./logic";
import { courseStreak, listSessions, touchSession } from "./session";
import { webSearch } from "./tavily";
import { traceNote } from "./trace";

export class NotFound extends Error {}

export type CourseRow = {
  id: number; topic: string; title: string; description: string; goal: string; tone: string;
  prior_knowledge: string; length_preset: LengthPreset; created_at: string; image_svg: string | null;
};
export type LessonRow = {
  id: number; course_id: number; module_id: number; position: number; title: string; objectives: string;
  est_minutes: number; content: string | null; completed_at: string | null;
};

// ---------- intake ----------

const IntakeSchema = z.object({
  questions: z
    .array(z.object({ question: z.string().min(3), options: z.array(z.string().min(1)).min(2).max(5) }))
    .min(1)
    .max(3),
});

/** Topic-specific clarifying questions shown in the intake wizard. */
export async function intakeQuestions(topic: string) {
  const res = await chatJson({
    label: `Write clarifying questions for "${topic}"`,
    schema: IntakeSchema,
    messages: [
      {
        role: "system",
        content:
          "You help design personalised courses. Given a topic a learner typed, write 2 short clarifying questions that would most change what the course covers (for example which sub-area, or what they want to be able to do afterwards). Do NOT ask about their experience level, tone, or how long the course should be; those are asked separately. Each question has 3-4 short answer options (max 6 words each) specific to the topic. Reply with JSON: {\"questions\":[{\"question\":string,\"options\":[string]}]}",
      },
      { role: "user", content: `Topic: ${topic}` },
    ],
  });
  return res.questions;
}

// ---------- curriculum ----------

const OutlineSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  modules: z
    .array(
      z.object({
        title: z.string().min(2),
        summary: z.string().default(""),
        lessons: z
          .array(
            z.object({
              title: z.string().min(2),
              objectives: z.array(z.string()).default([]),
              est_minutes: z.coerce.number().default(10),
              concepts: z.array(z.string().min(1)).min(1).max(4),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type CourseInput = {
  topic: string; goal: string; priorKnowledge: string; tone: string; length: LengthPreset;
};

export async function createCourse(input: CourseInput): Promise<number> {
  const preset = LENGTHS[input.length];
  const grounding = await webSearch(`${input.topic} learning roadmap syllabus`, 5);
  const outline = await chatJson({
    label: `Design the curriculum (${preset.label} course, ${preset.lessons} lesson${preset.lessons === 1 ? "" : "s"})`,
    schema: OutlineSchema,
    model: "strong",
    maxTokens: 12000,
    messages: [
      {
        role: "system",
        content: `You are an expert curriculum designer. Design a course outline as JSON:
{"title":string,"description":string (one or two sentences),"modules":[{"title":string,"summary":string,"lessons":[{"title":string,"objectives":[string] (2-3 things the learner will be able to do),"est_minutes":number,"concepts":[string] (1-3 short concept names, 1-4 words each, that this lesson teaches and a quiz can test)}]}]}
Rules:
- Exactly ${preset.modules} module(s) and ${preset.lessons} lesson(s) in total, about ${preset.minutes} minutes of study overall (${preset.label} course).
- Order lessons so each builds on earlier ones. Reuse the exact same concept name when a later lesson revisits a concept.
- Fit the scope to the time available: a short course covers the essentials only.
- Tailor everything to the learner's goal, prior knowledge and level.
- Reply with the JSON object only.`,
      },
      {
        role: "user",
        content: `Topic: ${input.topic}
Learner's goal and preferences: ${input.goal || "not specified"}
Prior knowledge: ${input.priorKnowledge || "not specified"}
Level / tone: ${input.tone} (${toneInstruction(input.tone)})
${grounding.length ? `\nWeb search results for grounding (use to judge what matters, do not copy):\n${grounding.map((r) => `- ${r.title}: ${r.snippet.slice(0, 250)}`).join("\n")}` : ""}`,
      },
    ],
  });

  const flat = outline.modules.flatMap((m) => m.lessons);
  const minutes = fitMinutes(flat.map((l) => l.est_minutes), preset.minutes);

  const db = getDb();
  const save = db.transaction(() => {
    const courseId = Number(
      db
        .prepare("INSERT INTO courses (topic, title, description, goal, tone, prior_knowledge, length_preset) VALUES (?,?,?,?,?,?,?)")
        .run(input.topic, outline.title, outline.description, input.goal, input.tone, input.priorKnowledge, input.length).lastInsertRowid,
    );
    const conceptIds = new Map<string, number>();
    const moduleIds: { id: number; title: string }[] = [];
    let n = 0;
    outline.modules.forEach((m, mi) => {
      const moduleId = Number(
        db.prepare("INSERT INTO modules (course_id, position, title, summary) VALUES (?,?,?,?)").run(courseId, mi, m.title, m.summary).lastInsertRowid,
      );
      moduleIds.push({ id: moduleId, title: m.title });
      for (const l of m.lessons) {
        const lessonId = Number(
          db
            .prepare("INSERT INTO lessons (course_id, module_id, position, title, objectives, est_minutes) VALUES (?,?,?,?,?,?)")
            .run(courseId, moduleId, n, l.title, JSON.stringify(l.objectives), minutes[n]).lastInsertRowid,
        );
        n++;
        for (const raw of l.concepts) {
          const name = raw.trim().slice(0, 80);
          const key = name.toLowerCase();
          if (!name) continue;
          if (!conceptIds.has(key)) {
            conceptIds.set(key, Number(db.prepare("INSERT INTO concepts (course_id, name) VALUES (?,?)").run(courseId, name).lastInsertRowid));
          }
          db.prepare("INSERT OR IGNORE INTO lesson_concepts (lesson_id, concept_id) VALUES (?,?)").run(lessonId, conceptIds.get(key));
        }
      }
    });
    return { courseId, moduleIds };
  });
  const { courseId, moduleIds } = save();
  traceNote("db", "Save curriculum", `course #${courseId}: ${moduleIds.length} modules, ${flat.length} lessons, ${new Set(flat.flatMap((l) => l.concepts.map((c) => c.trim().toLowerCase()))).size} concepts to track`);

  // Resources per module; a failed search just leaves that module without links.
  const found = await Promise.all(moduleIds.map((m) => webSearch(`${input.topic}: ${m.title} tutorial guide`, 3)));
  const insert = db.prepare("INSERT INTO resources (course_id, module_id, title, url, snippet) VALUES (?,?,?,?,?)");
  const seen = new Set<string>();
  db.transaction(() => {
    found.forEach((results, i) => {
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        insert.run(courseId, moduleIds[i].id, r.title, r.url, r.snippet);
      }
    });
  })();
  traceNote("db", "Save web resources", `${seen.size} links across ${moduleIds.length} modules`);
  touchSession(courseId);
  return courseId;
}

// ---------- reads ----------

export function getCourseRow(id: number): CourseRow {
  const row = getDb().prepare("SELECT * FROM courses WHERE id = ?").get(id) as CourseRow | undefined;
  if (!row) throw new NotFound("Course not found");
  return row;
}

function courseStats(courseId: number) {
  const db = getDb();
  const lessons = db
    .prepare("SELECT id, module_id, position, title, objectives, est_minutes, completed_at, content IS NOT NULL AS has_content FROM lessons WHERE course_id = ? ORDER BY position")
    .all(courseId) as (Omit<LessonRow, "content" | "course_id"> & { has_content: number })[];
  const weakCount = (db.prepare("SELECT COUNT(*) AS n FROM concepts WHERE course_id = ? AND mastery IS NOT NULL AND mastery < ?").get(courseId, WEAK_THRESHOLD) as { n: number }).n;
  const dueCards = (db.prepare("SELECT COUNT(*) AS n FROM flashcards WHERE course_id = ? AND due_at <= datetime('now')").get(courseId) as { n: number }).n;
  const totalCards = (db.prepare("SELECT COUNT(*) AS n FROM flashcards WHERE course_id = ?").get(courseId) as { n: number }).n;
  return { lessons, weakCount, dueCards, totalCards, progress: progressPercent(lessons) };
}

export function listCourses() {
  const rows = getDb().prepare("SELECT * FROM courses ORDER BY id DESC").all() as CourseRow[];
  return rows.map(({ image_svg, ...c }) => {
    const s = courseStats(c.id);
    return {
      ...c,
      image: image_svg,
      lengthLabel: LENGTHS[c.length_preset].label,
      progress: s.progress,
      lessonsTotal: s.lessons.length,
      lessonsDone: s.lessons.filter((l) => l.completed_at).length,
      weakCount: s.weakCount,
      dueCards: s.dueCards,
    };
  });
}

export function getCourseDetail(id: number) {
  const db = getDb();
  const course = getCourseRow(id);
  const s = courseStats(id);
  const modules = db.prepare("SELECT * FROM modules WHERE course_id = ? ORDER BY position").all(id) as { id: number; position: number; title: string; summary: string }[];
  const resources = db.prepare("SELECT id, module_id, title, url, snippet FROM resources WHERE course_id = ? AND module_id IS NOT NULL").all(id) as { id: number; module_id: number; title: string; url: string; snippet: string }[];
  const lessonScores = db
    .prepare(
      `SELECT q.lesson_id AS lesson_id, MAX(a.score) AS best FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE q.course_id = ? AND q.lesson_id IS NOT NULL AND q.kind = 'lesson' GROUP BY q.lesson_id`,
    )
    .all(id) as { lesson_id: number; best: number }[];
  const best = new Map(lessonScores.map((r) => [r.lesson_id, r.best]));
  const lessons = s.lessons.map((l) => ({ ...l, objectives: JSON.parse(l.objectives) as string[], bestScore: best.get(l.id) ?? null }));
  return {
    course: { ...course, lengthLabel: LENGTHS[course.length_preset].label },
    progress: s.progress,
    lessonsDone: lessons.filter((l) => l.completed_at).length,
    lessonsTotal: lessons.length,
    minutesTotal: lessons.reduce((a, l) => a + l.est_minutes, 0),
    weakCount: s.weakCount,
    dueCards: s.dueCards,
    totalCards: s.totalCards,
    streak: courseStreak(id),
    activity: activityGrid(activityCounts(id)),
    plan: dailyPlan(course.length_preset, course.created_at, s.lessons),
    nextLessonId: lessons.find((l) => !l.completed_at)?.id ?? null,
    modules: modules.map((m) => ({
      ...m,
      lessons: lessons.filter((l) => l.module_id === m.id),
      resources: resources.filter((r) => r.module_id === m.id),
    })),
    sessions: listSessions(id),
  };
}

/** Things done per day: lessons completed, quizzes taken, and at least 1 for any day with a study session. */
function activityCounts(courseId: number): Record<string, number> {
  const db = getDb();
  const counts: Record<string, number> = {};
  const add = (rows: unknown[], floor = false) => {
    for (const r of rows as { d: string; n: number }[]) counts[r.d] = floor ? Math.max(counts[r.d] ?? 0, 1) : (counts[r.d] ?? 0) + r.n;
  };
  add(db.prepare("SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n FROM lessons WHERE course_id = ? AND completed_at IS NOT NULL GROUP BY d").all(courseId));
  add(db.prepare("SELECT substr(a.created_at, 1, 10) AS d, COUNT(*) AS n FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE q.course_id = ? GROUP BY d").all(courseId));
  add(db.prepare("SELECT substr(ended_at, 1, 10) AS d, 1 AS n FROM study_sessions WHERE course_id = ? GROUP BY d").all(courseId), true);
  return counts;
}

// ---------- illustration ----------

const drawing = new Map<number, Promise<string | null>>();

/**
 * Draw the course illustration once and store it. Tries the illustration model first and the
 * fast model if that fails; returns null when neither produces a usable drawing.
 */
export function ensureCourseImage(courseId: number): Promise<string | null> {
  const course = getCourseRow(courseId);
  if (course.image_svg) return Promise.resolve(course.image_svg);
  const running = drawing.get(courseId);
  if (running) return running;
  const messages = [
    {
      role: "user" as const,
      content: `Draw a minimalist neon line-art illustration for a course titled "${course.title}" (topic: ${course.topic}).
Return ONLY an SVG document, no prose, no code fences.
Rules:
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"> with no width/height attributes and no background rectangle (it sits on a dark card).
- One clear, recognisable subject that symbolises the topic, centred, filling about 60% of the canvas, with nothing below y=215. Built from simple geometry: line, polyline, path, circle, ellipse, rect, polygon. 8 to 30 elements.
- Stroke-only wireframe style: fill="none" on shapes, stroke="#22d3ee" (main lines, stroke-width 3) and stroke="#67e8f9" or "#0e7490" for secondary detail (stroke-width 1.5), stroke-linecap="round" stroke-linejoin="round". A few small solid dots in #a5f3fc are allowed.
- No text, no <image>, no <script>, no <style>, no <foreignObject>, no <use>, no href, no gradients, no filters, no animation.`,
    },
  ];
  const job = (async () => {
    for (const model of ["image", "fast"] as const) {
      try {
        const { svg, reason } = inspectSvg(await chatText({ label: `Draw the course illustration (${model === "image" ? "illustration model" : "fast model fallback"})`, model, messages, maxTokens: 16000 }));
        if (svg) {
          getDb().prepare("UPDATE courses SET image_svg = ? WHERE id = ?").run(svg, courseId);
          traceNote("db", "Save course illustration", `${svg.length} characters of SVG`);
          return svg;
        }
        traceNote("db", "Discard course illustration", reason);
      } catch {
        // already traced by chatText; try the next model
      }
    }
    return null;
  })().finally(() => drawing.delete(courseId));
  drawing.set(courseId, job);
  return job;
}

export function deleteCourse(id: number) {
  getDb().prepare("DELETE FROM courses WHERE id = ?").run(id);
}

// ---------- lessons ----------

export function getLessonRow(id: number): LessonRow {
  const row = getDb().prepare("SELECT * FROM lessons WHERE id = ?").get(id) as LessonRow | undefined;
  if (!row) throw new NotFound("Lesson not found");
  return row;
}

export function lessonConcepts(lessonId: number) {
  return getDb()
    .prepare("SELECT c.id, c.name, c.mastery FROM concepts c JOIN lesson_concepts lc ON lc.concept_id = c.id WHERE lc.lesson_id = ?")
    .all(lessonId) as { id: number; name: string; mastery: number | null }[];
}

export function getLessonDetail(id: number) {
  const db = getDb();
  const lesson = getLessonRow(id);
  const course = getCourseRow(lesson.course_id);
  const mod = db.prepare("SELECT id, title FROM modules WHERE id = ?").get(lesson.module_id) as { id: number; title: string };
  const all = db.prepare("SELECT id, title FROM lessons WHERE course_id = ? ORDER BY position").all(course.id) as { id: number; title: string }[];
  const idx = all.findIndex((l) => l.id === id);
  const quiz = db.prepare("SELECT id FROM quizzes WHERE lesson_id = ? AND kind = 'lesson' ORDER BY id DESC LIMIT 1").get(id) as { id: number } | undefined;
  const bestScore = (db.prepare("SELECT MAX(a.score) AS s FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE q.lesson_id = ?").get(id) as { s: number | null }).s;
  return {
    lesson: { ...lesson, objectives: JSON.parse(lesson.objectives) as string[] },
    course: { id: course.id, title: course.title, tone: course.tone },
    module: mod,
    index: idx + 1,
    total: all.length,
    prev: all[idx - 1] ?? null,
    next: all[idx + 1] ?? null,
    concepts: lessonConcepts(id),
    resources: db.prepare("SELECT id, title, url, snippet FROM resources WHERE module_id = ?").all(lesson.module_id),
    quizId: quiz?.id ?? null,
    bestScore,
    tutor: db.prepare("SELECT role, content FROM tutor_messages WHERE lesson_id = ? ORDER BY id").all(id),
  };
}

/** Stream lesson content; the caller persists the full text when the stream ends. */
export function lessonContentStream(id: number) {
  const db = getDb();
  const lesson = getLessonRow(id);
  const course = getCourseRow(lesson.course_id);
  const outline = db.prepare("SELECT title, position FROM lessons WHERE course_id = ? ORDER BY position").all(course.id) as { title: string; position: number }[];
  const resources = db.prepare("SELECT title, snippet FROM resources WHERE module_id = ? LIMIT 4").all(lesson.module_id) as { title: string; snippet: string }[];
  const concepts = lessonConcepts(id).map((c) => c.name);
  const words = Math.min(1100, Math.max(250, lesson.est_minutes * 70));
  touchSession(course.id);
  return chatStream({
    label: `Write lesson "${lesson.title}" (~${words} words, ${course.tone})`,
    model: "lesson",
    maxTokens: 5000,
    messages: [
      {
        role: "system",
        content: `You are an excellent teacher writing one lesson of a personalised course.
Style: ${toneInstruction(course.tone)}
Write the lesson in Markdown, about ${words} words. Do not repeat the lesson title as a heading; start directly with a short hook. Use "##" section headings, short paragraphs, and at least one concrete worked example or analogy. Use tables or code blocks only where they genuinely help. End with a "## Key takeaways" section of 3-5 bullets.
Do not include quiz questions, and do not invent links or citations.`,
      },
      {
        role: "user",
        content: `Course: ${course.title} (topic: ${course.topic})
Learner's goal: ${course.goal || "not specified"}
Prior knowledge: ${course.prior_knowledge || "not specified"}
Course outline:
${outline.map((l) => `${l.position + 1}. ${l.title}${l.position === lesson.position ? "   <-- write THIS lesson" : ""}`).join("\n")}

Lesson to write: "${lesson.title}"
Objectives: ${(JSON.parse(lesson.objectives) as string[]).join("; ") || "cover the lesson title"}
Concepts that must be taught clearly (they will be quizzed): ${concepts.join(", ")}
${resources.length ? `\nBackground from web sources (for accuracy; do not quote or cite):\n${resources.map((r) => `- ${r.title}: ${r.snippet.slice(0, 300)}`).join("\n")}` : ""}`,
      },
    ],
  });
}

export function saveLessonContent(id: number, content: string) {
  getDb().prepare("UPDATE lessons SET content = ? WHERE id = ?").run(content.trim(), id);
  traceNote("db", "Save lesson content", `lesson #${id}, ${content.trim().length} characters; later visits read it from the database`);
}

export function setLessonCompleted(id: number, completed: boolean) {
  const lesson = getLessonRow(id);
  if (completed && !lesson.completed_at) {
    getDb().prepare("UPDATE lessons SET completed_at = datetime('now') WHERE id = ?").run(id);
    traceNote("db", "Mark lesson complete", `"${lesson.title}"`);
    touchSession(lesson.course_id, { lessons: 1 });
  } else if (!completed && lesson.completed_at) {
    getDb().prepare("UPDATE lessons SET completed_at = NULL WHERE id = ?").run(id);
  }
}

// ---------- tutor ----------

export function tutorStream(lessonId: number, message: string) {
  const db = getDb();
  const lesson = getLessonRow(lessonId);
  const course = getCourseRow(lesson.course_id);
  const history = (db.prepare("SELECT role, content FROM tutor_messages WHERE lesson_id = ? ORDER BY id DESC LIMIT 10").all(lessonId) as { role: "user" | "assistant"; content: string }[]).reverse();
  db.prepare("INSERT INTO tutor_messages (lesson_id, role, content) VALUES (?, 'user', ?)").run(lessonId, message);
  touchSession(course.id);
  return chatStream({
    label: `Tutor answers: "${message.slice(0, 80)}"`,
    model: "fast",
    maxTokens: 1500,
    messages: [
      {
        role: "system",
        content: `You are a patient tutor helping a learner with one lesson of the course "${course.title}".
Style: ${toneInstruction(course.tone)}
Answer the learner's question about this lesson concisely in Markdown (under 200 words unless asked for more). If asked to explain differently, use a new analogy or angle rather than repeating the lesson. If a question is unrelated to the course, say so briefly and steer back.

Lesson "${lesson.title}":
${(lesson.content ?? "(not generated yet)").slice(0, 7000)}`,
      },
      ...history,
      { role: "user", content: message },
    ],
  });
}

export function saveTutorReply(lessonId: number, content: string) {
  getDb().prepare("INSERT INTO tutor_messages (lesson_id, role, content) VALUES (?, 'assistant', ?)").run(lessonId, content.trim());
}
