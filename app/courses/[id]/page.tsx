"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, Crumbs, ErrorNote, Loading, ProgressBar, ResourceList, api, btn, useLoad } from "@/components/ui";

type Lesson = { id: number; title: string; est_minutes: number; completed_at: string | null; objectives: string[]; bestScore: number | null };
type Detail = {
  course: { id: number; title: string; description: string; topic: string; tone: string; lengthLabel: string };
  progress: number; lessonsDone: number; lessonsTotal: number; minutesTotal: number; weakCount: number; dueCards: number; totalCards: number;
  streak: number; nextLessonId: number | null;
  plan: null | { dailyMinutes: number; dayNumber: number; totalDays: number; minutesToday: number; targetMet: boolean; expectedPercent: number; upNext: { id: number; title: string; est_minutes: number }[] };
  modules: { id: number; title: string; summary: string; lessons: Lesson[]; resources: { id: number; title: string; url: string }[] }[];
  sessions: { id: number; started_at: string; ended_at: string; lessons_done: number; quizzes_done: number; cards_reviewed: number; weaknesses: { name: string }[] }[];
};

function fmtMinutes(m: number) {
  return m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`;
}

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <div className={`font-display text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, reload } = useLoad<Detail>(`/api/courses/${id}`);
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading label="Opening your course" />;
  const { course, plan } = data;
  const done = data.progress === 100;

  async function remove() {
    if (!confirm(`Delete "${course.title}" and all its progress? This cannot be undone.`)) return;
    await api(`/api/courses/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="space-y-8">
      <div>
        <Crumbs items={[{ label: "My courses", href: "/" }, { label: course.title }]} />
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{course.title}</h1>
        {course.description && <p className="mt-2 max-w-3xl text-muted">{course.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[course.lengthLabel, course.tone, `${data.lessonsTotal} lesson${data.lessonsTotal === 1 ? "" : "s"}`, fmtMinutes(data.minutesTotal)].map((t) => (
            <span key={t} className="rounded-full border border-line bg-card px-2.5 py-1 text-muted">
              {t}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Course progress</div>
            <div className="font-display text-4xl font-semibold text-brand-dark">{data.progress}%</div>
          </div>
          {data.nextLessonId ? (
            <Link href={`/lessons/${data.nextLessonId}`} className={btn.primary}>
              {data.lessonsDone === 0 ? "Start learning" : "Continue"} →
            </Link>
          ) : (
            <span className="rounded-full bg-good-soft px-3 py-1.5 text-sm font-medium text-good">Course complete</span>
          )}
        </div>
        <div className="mt-4">
          <ProgressBar value={data.progress} label="Course progress" />
        </div>
        <p className="mt-2 text-xs text-muted">
          {data.lessonsDone} of {data.lessonsTotal} lessons complete
          {plan && !done && ` · day ${Math.min(plan.dayNumber, plan.totalDays)} of ${plan.totalDays}, on pace would be ${plan.expectedPercent}%`}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="lessons done" value={`${data.lessonsDone}/${data.lessonsTotal}`} />
        <Stat label={`day streak`} value={data.streak} />
        <Link href={`/courses/${id}/weaknesses`} className="transition hover:opacity-80">
          <Stat label="weak spots →" value={data.weakCount} tone={data.weakCount ? "text-warn" : ""} />
        </Link>
        <Link href={`/courses/${id}/flashcards`} className="transition hover:opacity-80">
          <Stat label={`of ${data.totalCards} flashcards due →`} value={data.dueCards} />
        </Link>
      </div>

      {plan && !done && (
        <Card className="border-brand/30 bg-brand-soft/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">Today&apos;s plan</h2>
            <span className="text-sm text-muted">
              {plan.minutesToday} of {plan.dailyMinutes} min done today
            </span>
          </div>
          {plan.targetMet ? (
            <p className="mt-2 text-sm text-good">You&apos;ve hit today&apos;s target. Come back tomorrow to keep your streak, or keep going.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {plan.upNext.map((l) => (
                <li key={l.id}>
                  <Link href={`/lessons/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm hover:border-brand">
                    <span>{l.title}</span>
                    <span className="shrink-0 text-xs text-muted">{l.est_minutes} min</span>
                  </Link>
                </li>
              ))}
              {data.dueCards > 0 && (
                <li>
                  <Link href={`/courses/${id}/flashcards`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm hover:border-brand">
                    <span>Review {data.dueCards} flashcard{data.dueCards > 1 ? "s" : ""}</span>
                    <span className="shrink-0 text-xs text-muted">~{Math.max(1, Math.round(data.dueCards / 3))} min</span>
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Curriculum</h2>
        {data.modules.map((m, mi) => (
          <Card key={m.id}>
            <div className="text-xs font-medium uppercase tracking-wide text-brand">Module {mi + 1}</div>
            <h3 className="font-display text-xl font-semibold">{m.title}</h3>
            {m.summary && <p className="mt-1 text-sm text-muted">{m.summary}</p>}
            <ol className="mt-4 divide-y divide-line border-y border-line">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/lessons/${l.id}`} className="flex items-center gap-3 py-3 hover:bg-paper">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${l.completed_at ? "border-good bg-good text-white" : l.id === data.nextLessonId ? "border-brand text-brand" : "border-line text-muted"}`}
                      aria-label={l.completed_at ? "Completed" : "Not completed"}
                    >
                      {l.completed_at ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{l.title}</span>
                      {l.objectives[0] && <span className="block truncate text-xs text-muted">{l.objectives[0]}</span>}
                    </span>
                    {l.bestScore !== null && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${l.bestScore >= 0.75 ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>
                        quiz {Math.round(l.bestScore * 100)}%
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted">{l.est_minutes} min</span>
                  </Link>
                </li>
              ))}
            </ol>
            {m.resources.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted hover:text-ink">Resources from the web ({m.resources.length})</summary>
                <div className="mt-3">
                  <ResourceList resources={m.resources} />
                </div>
              </details>
            )}
          </Card>
        ))}
      </section>

      {data.sessions.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Study sessions</h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Lessons</th>
                  <th className="px-4 py-2.5 font-medium">Quizzes</th>
                  <th className="px-4 py-2.5 font-medium">Cards</th>
                  <th className="px-4 py-2.5 font-medium">Weak spots at the end</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">{new Date(s.started_at.replace(" ", "T") + "Z").toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-4 py-2.5">{s.lessons_done}</td>
                    <td className="px-4 py-2.5">{s.quizzes_done}</td>
                    <td className="px-4 py-2.5">{s.cards_reviewed}</td>
                    <td className="px-4 py-2.5 text-muted">{s.weaknesses.length ? s.weaknesses.map((w) => w.name).join(", ") : "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <div className="border-t border-line pt-4 text-right">
        <button onClick={remove} className="text-sm text-muted hover:text-bad hover:underline">
          Delete this course
        </button>
      </div>
    </div>
  );
}
