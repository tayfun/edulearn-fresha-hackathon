import { getDb } from "./db";
import { WEAK_THRESHOLD, dayOf, streak } from "./logic";

const SESSION_GAP_MINUTES = 30;

/** Record activity: extends the open study session or starts a new one after a 30 minute gap. */
export function touchSession(courseId: number, delta: { lessons?: number; quizzes?: number; cards?: number } = {}) {
  const db = getDb();
  const open = db
    .prepare(
      `SELECT id FROM study_sessions WHERE course_id = ?
       AND ended_at >= datetime('now', '-${SESSION_GAP_MINUTES} minutes') ORDER BY id DESC LIMIT 1`,
    )
    .get(courseId) as { id: number } | undefined;
  const id = open?.id ?? Number(db.prepare("INSERT INTO study_sessions (course_id) VALUES (?)").run(courseId).lastInsertRowid);
  const weak = db
    .prepare("SELECT name, mastery FROM concepts WHERE course_id = ? AND mastery IS NOT NULL AND mastery < ? ORDER BY mastery")
    .all(courseId, WEAK_THRESHOLD);
  db.prepare(
    `UPDATE study_sessions SET ended_at = datetime('now'), lessons_done = lessons_done + ?,
     quizzes_done = quizzes_done + ?, cards_reviewed = cards_reviewed + ?, weaknesses = ? WHERE id = ?`,
  ).run(delta.lessons ?? 0, delta.quizzes ?? 0, delta.cards ?? 0, JSON.stringify(weak), id);
  return id;
}

export function courseStreak(courseId: number): number {
  const rows = getDb()
    .prepare("SELECT DISTINCT substr(ended_at, 1, 10) AS d FROM study_sessions WHERE course_id = ?")
    .all(courseId) as { d: string }[];
  return streak(rows.map((r) => dayOf(r.d)));
}

export function listSessions(courseId: number) {
  const rows = getDb()
    .prepare("SELECT * FROM study_sessions WHERE course_id = ? ORDER BY id DESC LIMIT 10")
    .all(courseId) as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, weaknesses: JSON.parse(String(r.weaknesses)) }));
}
