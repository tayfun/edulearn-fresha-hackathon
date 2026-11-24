"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeroArt, Icon } from "@/components/art";
import { Card, ErrorNote, Loading, ResourceList, api, useLoad } from "@/components/ui";

type Lesson = { id: number; title: string; est_minutes: number; completed_at: string | null; objectives: string[]; bestScore: number | null };
type Detail = {
  course: { id: number; title: string; description: string; topic: string; tone: string; lengthLabel: string };
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  minutesTotal: number;
  weakCount: number;
  dueCards: number;
  totalCards: number;
  streak: number;
  nextLessonId: number | null;
  plan: null | {
    dailyMinutes: number;
    dayNumber: number;
    totalDays: number;
    minutesToday: number;
    targetMet: boolean;
    expectedPercent: number;
    upNext: { id: number; title: string; est_minutes: number }[];
  };
  modules: { id: number; title: string; summary: string; lessons: Lesson[]; resources: { id: number; title: string; url: string }[] }[];
  sessions: { id: number; started_at: string; ended_at: string; lessons_done: number; quizzes_done: number; cards_reviewed: number; weaknesses: { name: string }[] }[];
};

function fmtMinutes(m: number) {
  return m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`;
}

const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

/** Counts up to the target once on mount. */
function useCountUp(target: number, ms = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return value;
}

function ProgressRing({ value, small = false }: { value: number; small?: boolean }) {
  const shown = useCountUp(value);
  const r = 52;
  const full = 2 * Math.PI * r;
  return (
    <div className={`relative shrink-0 ${small ? "h-[4.5rem] w-[4.5rem]" : "h-40 w-40"}`} role="img" aria-label={`Course progress ${value}%`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="rgb(4 36 31 / 0.6)" stroke="rgb(255 255 255 / 0.2)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#f6b84a"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={full}
          strokeDashoffset={full * (1 - value / 100)}
          className="ring-in"
          style={{ "--ring-full": full } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className={`font-display font-semibold leading-none tabular-nums ${small ? "text-lg" : "text-4xl"}`}>{shown}%</span>
        {!small && <span className="mt-1 text-[11px] uppercase tracking-wider text-white/75">complete</span>}
      </div>
    </div>
  );
}

/** One dot per lesson along a line: done, next (pulsing) or still ahead. */
function Trail({ lessons, nextId }: { lessons: Lesson[]; nextId: number | null }) {
  return (
    <div className="relative mt-6">
      <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wider text-white/70">
        <span>Start</span>
        <span className="flex items-center gap-1 text-[#f6b84a]">
          Summit <Icon name="flag" className="flag-wave h-3.5 w-3.5" />
        </span>
      </div>
      <ol className="relative flex items-center justify-between">
        <span aria-hidden className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-white/25" />
        {lessons.map((l, i) => {
          const isNext = l.id === nextId;
          return (
            <li key={l.id} className="relative">
              <Link
                href={`/lessons/${l.id}`}
                title={`${i + 1}. ${l.title}${l.completed_at ? " (done)" : isNext ? " (up next)" : ""}`}
                aria-label={`Lesson ${i + 1}: ${l.title}${l.completed_at ? ", done" : isNext ? ", up next" : ""}`}
                className="relative flex h-6 w-3 items-center justify-center sm:w-4"
              >
                {isNext && <span aria-hidden className="ping-soft absolute h-3 w-3 rounded-full bg-[#f6b84a]" />}
                <span
                  className={`relative block rounded-full transition-transform hover:scale-150 ${
                    l.completed_at ? "h-2.5 w-2.5 bg-[#f6b84a]" : isNext ? "h-3.5 w-3.5 border-2 border-[#f6b84a] bg-[#062f29]" : "h-2 w-2 bg-white/45"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function QuizChip({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${score >= 0.75 ? "bg-good-soft text-good" : "border border-line bg-paper text-muted"}`}>
      {score >= 0.75 ? `quiz ${pct}%` : `quiz ${pct}% · retake`}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
  i,
  animate = "",
  href,
}: {
  icon: "book" | "flame" | "target" | "cards";
  label: string;
  value: React.ReactNode;
  tint: string;
  i: number;
  animate?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon name={icon} className={`h-6 w-6 ${animate}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl font-semibold leading-tight tabular-nums">{value}</span>
        <span className="block text-xs text-muted">{label}</span>
      </span>
    </>
  );
  const box = "rise flex h-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-4";
  if (!href) {
    return (
      <div className={box} style={delay(i)}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={`${box} lift group hover:border-brand`} style={delay(i)}>
      {body}
      <span aria-hidden className="text-muted transition group-hover:translate-x-1 group-hover:text-brand">
        →
      </span>
    </Link>
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
  const allLessons = data.modules.flatMap((m) => m.lessons);
  const nextLesson = allLessons.find((l) => l.id === data.nextLessonId);

  async function remove() {
    if (!confirm(`Delete "${course.title}" and all its progress? This cannot be undone.`)) return;
    await api(`/api/courses/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="space-y-8">
      <section className="rise-solid relative overflow-hidden rounded-3xl text-white shadow-lg shadow-brand-dark/20">
        <HeroArt />
        <div className="relative p-6 sm:p-9">
          <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-white/75" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white hover:underline">
              My courses
            </Link>
            <span aria-hidden>/</span>
            <span className="text-white">{course.title}</span>
          </nav>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:max-w-[62%]">
              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2.6rem]">{course.title}</h1>
              {course.description && <p className="mt-3 text-white/85">{course.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[course.lengthLabel, course.tone, `${data.lessonsTotal} lesson${data.lessonsTotal === 1 ? "" : "s"}`, fmtMinutes(data.minutesTotal)].map((t) => (
                  <span key={t} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {nextLesson ? (
                  <Link
                    href={`/lessons/${nextLesson.id}`}
                    className="group inline-flex items-center gap-2 rounded-xl bg-[#f6b84a] px-5 py-3 text-sm font-semibold text-[#3a2500] shadow-md transition hover:bg-[#ffc861]"
                  >
                    {data.lessonsDone === 0 ? "Start learning" : "Continue"}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                ) : (
                  <span className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm">You reached the summit. Course complete.</span>
                )}
                <span className="ml-auto sm:hidden">
                  <ProgressRing small value={data.progress} />
                </span>
              </div>
              {nextLesson && (
                <p className="mt-3 text-sm text-white/85">
                  <span className="text-white/65">Up next</span> · {nextLesson.title.replace(/^Lesson \d+:\s*/i, "")}
                </p>
              )}
            </div>
            <div className="hidden sm:block">
              <ProgressRing value={data.progress} />
            </div>
          </div>
          <Trail lessons={allLessons} nextId={data.nextLessonId} />
          <p className="mt-3 text-xs text-white/75">
            {data.lessonsDone} of {data.lessonsTotal} lessons complete
            {plan && !done && ` · day ${Math.min(plan.dayNumber, plan.totalDays)} of ${plan.totalDays} · target pace ${plan.expectedPercent}%`}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat i={1} icon="book" tint="bg-brand-soft text-brand-dark" label="lessons done" value={`${data.lessonsDone}/${data.lessonsTotal}`} />
        <Stat i={2} icon="flame" tint="bg-warn-soft text-warn" label="day streak" value={data.streak} animate={data.streak > 0 ? "flame" : ""} />
        <Stat
          i={3}
          icon="target"
          href={`/courses/${id}/weaknesses`}
          tint={data.weakCount ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}
          label={data.weakCount === 1 ? "weak spot" : "weak spots"}
          value={data.weakCount}
        />
        <Stat i={4} icon="cards" href={`/courses/${id}/flashcards`} tint="bg-[#f1eadc] text-ink" label={data.totalCards ? `of ${data.totalCards} cards due` : "flashcards"} value={data.dueCards} />
      </div>

      {plan && !done && (
        <Card className="rise border-brand/30 bg-brand-soft/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Icon name="clock" className="h-5 w-5 text-brand" />
              Today&apos;s plan
            </h2>
            <span className="text-sm text-muted">
              {plan.minutesToday} min done today · target {plan.dailyMinutes} min
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="bar-in h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((plan.minutesToday / plan.dailyMinutes) * 100))}%` }} />
          </div>
          {plan.targetMet ? (
            <p className="mt-2 text-sm text-good">You&apos;ve hit today&apos;s target. Come back tomorrow to keep your streak, or keep going.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {plan.upNext.map((l) => (
                <li key={l.id}>
                  <Link href={`/lessons/${l.id}`} className="lift flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm hover:border-brand">
                    <span>{l.title}</span>
                    <span className="shrink-0 text-xs text-muted">{l.est_minutes} min</span>
                  </Link>
                </li>
              ))}
              {data.dueCards > 0 && (
                <li>
                  <Link href={`/courses/${id}/flashcards`} className="lift flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm hover:border-brand">
                    <span>
                      Review {data.dueCards} flashcard{data.dueCards > 1 ? "s" : ""}
                    </span>
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
        {data.modules.map((m, mi) => {
          const doneCount = m.lessons.filter((l) => l.completed_at).length;
          const modulePct = m.lessons.length ? Math.round((doneCount / m.lessons.length) * 100) : 0;
          return (
            <Card key={m.id} className="rise">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-semibold ${modulePct === 100 ? "bg-brand text-white" : "bg-brand-soft text-brand-dark"}`}
                >
                  {modulePct === 100 ? "✓" : mi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-display text-xl font-semibold">{m.title}</h3>
                    <span className="shrink-0 text-xs text-muted">
                      {doneCount}/{m.lessons.length} lessons
                    </span>
                  </div>
                  {m.summary && <p className="mt-1 text-sm text-muted">{m.summary}</p>}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="bar-in h-full rounded-full bg-brand" style={{ width: `${modulePct}%` }} />
                  </div>
                </div>
              </div>
              <ol className="mt-4 divide-y divide-line border-y border-line">
                {m.lessons.map((l) => {
                  const isNext = l.id === data.nextLessonId;
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/lessons/${l.id}`}
                        className={`group flex items-start gap-3 px-2 py-3 transition sm:items-center ${isNext ? "bg-[#fdf4df] hover:bg-[#fbecc8]" : "hover:bg-brand-soft/60"}`}
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs sm:mt-0 ${l.completed_at ? "border-brand bg-brand text-white" : isNext ? "border-2 border-[#e09a1f] bg-white" : "border-line bg-white text-muted"}`}
                          aria-label={l.completed_at ? "Completed" : "Not completed"}
                        >
                          {l.completed_at ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {l.title}
                            {isNext && <span className="ml-2 rounded-full bg-[#f6b84a] px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-[#3a2500]">Next</span>}
                          </span>
                          {l.objectives[0] && <span className="line-clamp-2 text-xs text-muted sm:line-clamp-1">{l.objectives[0]}</span>}
                          <span className="mt-1 flex items-center gap-2 text-xs text-muted sm:hidden">
                            {l.est_minutes} min
                            {l.bestScore !== null && <QuizChip score={l.bestScore} />}
                          </span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-3 text-xs text-muted sm:flex">
                          {l.bestScore !== null && <QuizChip score={l.bestScore} />}
                          {l.est_minutes} min
                        </span>
                        <span aria-hidden className={`hidden shrink-0 transition group-hover:translate-x-1 sm:block ${isNext ? "text-[#b97a10]" : "text-muted opacity-0 group-hover:opacity-100"}`}>
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
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
          );
        })}
      </section>

      {data.sessions.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Study sessions</h2>
          <ul className="space-y-3 sm:hidden">
            {data.sessions.map((s) => (
              <li key={s.id}>
                <Card className="p-4">
                  <div className="font-medium">{new Date(s.started_at.replace(" ", "T") + "Z").toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  <div className="mt-1 text-sm text-muted">
                    {s.lessons_done} lesson{s.lessons_done === 1 ? "" : "s"} · {s.quizzes_done} quiz{s.quizzes_done === 1 ? "" : "zes"} · {s.cards_reviewed} card{s.cards_reviewed === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-xs text-muted">Weak spots at the end: {s.weaknesses.length ? s.weaknesses.map((w) => w.name).join(", ") : "none"}</div>
                </Card>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-x-auto p-0 sm:block">
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
