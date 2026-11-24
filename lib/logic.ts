// Pure rules shared by server and client: no DB, no network.

export const LENGTHS = {
  "5min": { label: "5 minutes", hint: "One quick lesson", modules: 1, lessons: 1, minutes: 5, days: 1 },
  "30min": { label: "30 minutes", hint: "A focused sitting", modules: 1, lessons: 3, minutes: 30, days: 1 },
  "2h": { label: "2 hours", hint: "An afternoon deep-dive", modules: 2, lessons: 6, minutes: 120, days: 1 },
  "1w": { label: "1 week", hint: "~40 min a day", modules: 3, lessons: 9, minutes: 280, days: 7 },
  "2w": { label: "2 weeks", hint: "~35 min a day", modules: 4, lessons: 14, minutes: 490, days: 14 },
  "1m": { label: "1 month", hint: "~30 min a day", modules: 4, lessons: 20, minutes: 900, days: 30 },
  "2m": { label: "2 months", hint: "~30 min a day", modules: 8, lessons: 32, minutes: 1800, days: 60 },
} as const;
export type LengthPreset = keyof typeof LENGTHS;
export const isLengthPreset = (v: unknown): v is LengthPreset => typeof v === "string" && v in LENGTHS;

export const TONES = [
  { id: "eli10", label: "Explain like I'm 10", instruction: "Explain as you would to a curious 10-year-old: short sentences, everyday analogies, no jargon, playful but never condescending." },
  { id: "beginner", label: "Beginner", instruction: "Assume no prior knowledge. Define every term the first time it appears and build up step by step with concrete examples." },
  { id: "intermediate", label: "Some experience", instruction: "Assume the basics are known. Skip trivial definitions and focus on how things work and common pitfalls." },
  { id: "professional", label: "Professional", instruction: "Write for a working professional: precise terminology, depth, trade-offs, real-world practice and edge cases. No hand-holding." },
] as const;

/** Preset label -> writing instruction; anything else is the learner's own wording. */
export function toneInstruction(tone: string): string {
  const preset = TONES.find((t) => t.label === tone || t.id === tone);
  return preset ? preset.instruction : `Match this style requested by the learner: "${tone}".`;
}

/** Exponential moving average: the first answer sets mastery, later answers move it halfway. */
export function nextMastery(current: number | null, correct: boolean): number {
  const v = correct ? 1 : 0;
  return current === null ? v : current * 0.5 + v * 0.5;
}
export const WEAK_THRESHOLD = 0.6;
export const isWeak = (mastery: number | null) => mastery !== null && mastery < WEAK_THRESHOLD;

/** Progress as a 0-100 integer, weighted by lesson length. */
export function progressPercent(lessons: { est_minutes: number; completed_at: string | null }[]): number {
  const total = lessons.reduce((s, l) => s + Math.max(1, l.est_minutes), 0);
  if (total === 0) return 0;
  const done = lessons.filter((l) => l.completed_at).reduce((s, l) => s + Math.max(1, l.est_minutes), 0);
  return Math.round((done / total) * 100);
}

/** Scale lesson estimates so they add up to the course length (each at least 2 minutes). */
export function fitMinutes(estimates: number[], totalMinutes: number): number[] {
  if (estimates.length === 0) return [];
  const safe = estimates.map((m) => (Number.isFinite(m) && m > 0 ? m : 1));
  const sum = safe.reduce((a, b) => a + b, 0);
  return safe.map((m) => Math.max(2, Math.round((m / sum) * totalMinutes)));
}

// Leitner boxes: a correct review moves the card up a box, a miss sends it back to box 1.
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14];
export function reviewCard(box: number, knewIt: boolean, now = new Date()): { box: number; dueAt: string } {
  const next = knewIt ? Math.min(BOX_INTERVAL_DAYS.length, box + 1) : 1;
  const due = new Date(now.getTime() + (knewIt ? BOX_INTERVAL_DAYS[next - 1] : 0) * 86_400_000);
  return { box: next, dueAt: toSqlDate(due) };
}

export const toSqlDate = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
export const dayOf = (sqlDate: string) => sqlDate.slice(0, 10);

/** Consecutive study days ending today (or yesterday, so a streak survives until midnight). */
export function streak(activeDays: string[], today = new Date()): number {
  const days = new Set(activeDays);
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const key = () => cursor.toISOString().slice(0, 10);
  if (!days.has(key())) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let n = 0;
  while (days.has(key())) {
    n++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return n;
}

export type PlanLesson = { id: number; title: string; est_minutes: number; completed_at: string | null };
/** Today's study target for multi-day courses. */
export function dailyPlan(preset: LengthPreset, createdAt: string, lessons: PlanLesson[], today = new Date()) {
  const { days, minutes } = LENGTHS[preset];
  if (days <= 1) return null;
  const dailyMinutes = Math.ceil(minutes / days);
  const todayKey = today.toISOString().slice(0, 10);
  const start = new Date(dayOf(createdAt) + "T00:00:00Z").getTime();
  const dayNumber = Math.max(1, Math.floor((new Date(todayKey + "T00:00:00Z").getTime() - start) / 86_400_000) + 1);
  const doneToday = lessons.filter((l) => l.completed_at && dayOf(l.completed_at) === todayKey);
  const minutesToday = doneToday.reduce((s, l) => s + l.est_minutes, 0);
  const upNext: PlanLesson[] = [];
  let budget = dailyMinutes - minutesToday;
  for (const l of lessons) {
    if (l.completed_at) continue;
    if (budget <= 0 && (upNext.length > 0 || minutesToday > 0)) break;
    upNext.push(l);
    budget -= l.est_minutes;
  }
  const expected = Math.min(100, Math.round((Math.min(dayNumber, days) / days) * 100));
  return {
    dailyMinutes,
    dayNumber,
    totalDays: days,
    minutesToday,
    targetMet: minutesToday >= dailyMinutes || lessons.every((l) => l.completed_at),
    upNext,
    expectedPercent: expected,
  };
}

/**
 * Accept a model-drawn SVG only if it is plain static geometry. It is shown through an <img>,
 * which already blocks scripts and external loads; this keeps junk out of the database too.
 */
export function cleanSvg(reply: string): string | null {
  const match = reply.replace(/<think>[\s\S]*?<\/think>/g, "").match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  const svg = match[0].trim();
  if (svg.length > 20_000 || !/viewBox=/i.test(svg)) return null;
  if (/<\s*(script|style|foreignObject|image|use|iframe|a|animate|set)\b|\son\w+\s*=|href\s*=|url\s*\(|javascript:|<!|&#/i.test(svg)) return null;
  const shapes = svg.match(/<(path|line|polyline|polygon|circle|ellipse|rect)\b/gi)?.length ?? 0;
  return shapes >= 3 ? svg : null;
}

/** Days with study activity in the last `weeks` weeks, as columns of Monday-first weeks ending this week. */
export function activityGrid(counts: Record<string, number>, weeks = 12, today = new Date()) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const weekday = (end.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(end.getTime() - (weekday + (weeks - 1) * 7) * 86_400_000);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start.getTime() + (w * 7 + d) * 86_400_000);
      const date = day.toISOString().slice(0, 10);
      return { date, count: counts[date] ?? 0, future: day > end };
    }),
  );
}

/** Match a model-supplied concept name to one of the known names. */
export function matchConcept<T extends { name: string }>(name: string | undefined, known: T[]): T | undefined {
  if (known.length === 0) return undefined;
  const n = (name ?? "").trim().toLowerCase();
  return (
    known.find((c) => c.name.toLowerCase() === n) ??
    (n ? known.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase())) : undefined) ??
    known[0]
  );
}
