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

function ProgressRing({ value }: { value: number }) {
  const shown = useCountUp(value);
  const r = 52;
  const full = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0 sm:h-40 sm:w-40" role="img" aria-label={`Course progress ${value}%`}>
      {/* moonlight behind the ring, wherever the ring ends up */}
      <span aria-hidden className="sun-glow absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(217_255_243/0.4),rgb(143_227_205/0.12)_55%,transparent)] sm:-inset-16" />
      <svg viewBox="0 0 128 128" className="relative h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="rgb(4 36 31 / 0.72)" stroke="rgb(255 255 255 / 0.22)" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f6b84a" strokeWidth="10" strokeLinecap="round" strokeDasharray={full} strokeDashoffset={full * (1 - shown / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="font-display text-2xl font-semibold leading-none tabular-nums sm:text-4xl">{shown}%</span>
        <span className="mt-1 text-[9px] uppercase tracking-wider text-white/80 sm:text-[11px]">complete</span>
      </div>
    </div>
  );
}

// The trail is one cubic curve climbing the foreground hill, in fractions of the trail box.
type Pt = [number, number];
const CURVE: [Pt, Pt, Pt, Pt] = [
  [0.04, 0.5],
  [0.32, 0.64],
  [0.6, 0.26],
  [0.9, 0.2],
];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** De Casteljau: the point at t and the control points of the curve from 0 to t. */
function splitCurve(t: number) {
  const [p0, p1, p2, p3] = CURVE;
  const a = lerp(p0, p1, t),
    b = lerp(p1, p2, t),
    c = lerp(p2, p3, t);
  const d = lerp(a, b, t),
    e = lerp(b, c, t);
  return { point: lerp(d, e, t), head: [p0, a, d, lerp(d, e, t)] as Pt[] };
}
const W = 1000;
const H = 200;
const svgPath = (pts: Pt[]) =>
  `M${pts[0][0] * W} ${pts[0][1] * H} C${pts
    .slice(1)
    .map((p) => `${p[0] * W} ${p[1] * H}`)
    .join(" ")}`;

/** The foreground hill. Lessons are waypoints along its crest, climbing from Start to a flag at the summit. */
function Trail({ lessons, nextId, children }: { lessons: Lesson[]; nextId: number | null; children: React.ReactNode }) {
  const n = lessons.length;
  const tOf = (i: number) => (i + 0.5) / n;
  const nextIndex = lessons.findIndex((l) => l.id === nextId);
  const reached = nextIndex === -1 ? 1 : tOf(nextIndex);
  const crest = svgPath(CURVE);
  const [p0, , , p3] = CURVE;
  const hill = `M0 ${p0[1] * H - 6} L${p0[0] * W} ${p0[1] * H} ${crest.slice(crest.indexOf("C"))} L${W} ${p3[1] * H + 4} V${H} H0 Z`;
  const pct = (p: Pt) => ({ left: `${p[0] * 100}%`, top: `${p[1] * 100}%` });
  const dense = n > 16;
  return (
    <div className="relative h-52">
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a443a" />
            <stop offset="0.6" stopColor="#052a25" />
          </linearGradient>
        </defs>
        <path d={hill} fill="url(#hill)" />
        <path d={crest} fill="none" stroke="rgb(255 255 255 / 0.4)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={svgPath(splitCurve(reached).head)} fill="none" stroke="#f6b84a" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <span className="absolute -translate-x-2 text-[11px] font-medium uppercase tracking-wider text-white/85" style={{ left: `${p0[0] * 100}%`, top: `calc(${p0[1] * 100}% - 30px)` }}>
        Start
      </span>

      <ol>
        {lessons.map((l, i) => {
          const isNext = l.id === nextId;
          return (
            <li key={l.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(splitCurve(tOf(i)).point)}>
              <Link
                href={`/lessons/${l.id}`}
                title={`${i + 1}. ${l.title}${l.completed_at ? " (done)" : isNext ? " (up next)" : ""}`}
                aria-label={`Lesson ${i + 1}: ${l.title}${l.completed_at ? ", done" : isNext ? ", up next" : ""}`}
                className={`group relative flex items-center justify-center ${dense ? "h-5 w-2" : "h-7 w-5"}`}
              >
                {isNext && <span aria-hidden className="ping-soft absolute h-4 w-4 rounded-full bg-[#f6b84a]" />}
                <span
                  className={`relative block rounded-full transition-transform group-hover:scale-150 ${
                    l.completed_at
                      ? `bg-[#f6b84a] ring-2 ring-[#052a25] ${dense ? "h-2 w-2" : "h-3 w-3"}`
                      : isNext
                        ? `border-[3px] border-[#f6b84a] bg-[#052a25] ${dense ? "h-3 w-3" : "h-4 w-4"}`
                        : `bg-white/70 ring-2 ring-[#0a443a] ${dense ? "h-1.5 w-1.5" : "h-2.5 w-2.5"}`
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ol>

      {/* summit flag at the top of the climb */}
      <div aria-hidden className="absolute" style={pct(p3)}>
        <svg viewBox="0 0 40 56" className="absolute -left-[3px] bottom-0 h-12 w-9 sm:h-14 sm:w-10">
          <line x1="3" y1="56" x2="3" y2="4" stroke="#fff7df" strokeWidth="3" strokeLinecap="round" />
          <path d="M5 5 C14 0 22 10 36 5 V25 C22 30 14 20 5 25 Z" fill="#f6b84a" className="flag-wave" />
        </svg>
        <span className="absolute right-2 top-2.5 whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-[#f6b84a]">Summit</span>
      </div>

      <div className="absolute inset-x-6 bottom-5 sm:inset-x-9 sm:bottom-6">{children}</div>
    </div>
  );
}

function QuizChip({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${score >= 0.75 ? "bg-good-soft text-good" : "bg-[#f1eadc] text-ink/80"}`}>
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
        <div className="relative px-6 pt-6 sm:px-9 sm:pt-8">
          <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-white/85 hover:text-white hover:underline">
            <span aria-hidden>‹</span> My courses
          </Link>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-5 sm:gap-x-10">
            <div className="col-span-2 sm:col-span-1 sm:max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2.6rem]">{course.title}</h1>
              {course.description && <p className="mt-3 text-white/90">{course.description}</p>}
            </div>
            <div className="col-start-2 row-start-2 self-center sm:row-span-2 sm:row-start-1 sm:mr-6 lg:mr-14">
              <ProgressRing value={data.progress} />
            </div>
            <div className="col-start-1 row-start-2 min-w-0">
              <div className="flex flex-wrap gap-2 text-xs">
                {[course.lengthLabel, course.tone, `${data.lessonsTotal} lesson${data.lessonsTotal === 1 ? "" : "s"}`, fmtMinutes(data.minutesTotal)].map((t) => (
                  <span key={t} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5">
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
                  <span className="inline-block rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm">You reached the summit. Course complete.</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Trail lessons={allLessons} nextId={data.nextLessonId}>
          {nextLesson && (
            <p className="truncate text-sm text-white">
              <span className="text-white/75">Up next ·</span> {nextLesson.title.replace(/^Lesson \d+:\s*/i, "")}
            </p>
          )}
          <p className="mt-1 text-xs text-white/85">
            {data.lessonsDone} of {data.lessonsTotal} lessons complete
            {plan && !done && ` · day ${Math.min(plan.dayNumber, plan.totalDays)} of ${plan.totalDays} · target pace ${plan.expectedPercent}%`}
          </p>
        </Trail>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat i={1} icon="book" href="#curriculum" tint="bg-brand-soft text-brand-dark" label="lessons done" value={`${data.lessonsDone}/${data.lessonsTotal}`} />
        <Stat i={2} icon="flame" href="#sessions" tint="bg-warn-soft text-warn" label="day streak" value={data.streak} animate={data.streak > 0 ? "flame" : ""} />
        <Stat
          i={3}
          icon="target"
          href={`/courses/${id}/weaknesses`}
          tint={data.weakCount ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}
          label={data.weakCount === 1 ? "weak spot" : "weak spots"}
          value={data.weakCount}
        />
        <Stat i={4} icon="cards" href={`/courses/${id}/flashcards`} tint="bg-[#f1eadc] text-ink" label={data.dueCards === 1 ? "card due" : "cards due"} value={data.dueCards} />
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
            <div
              className={`bar-in h-full rounded-full ${plan.targetMet ? "bg-[#f6b84a]" : "bg-brand"}`}
              style={{ width: `${Math.min(100, Math.round((plan.minutesToday / plan.dailyMinutes) * 100))}%` }}
            />
          </div>
          {plan.targetMet ? (
            <p className="mt-3 text-sm font-medium text-good">✓ You&apos;ve hit today&apos;s target. Come back tomorrow to keep your streak, or keep going.</p>
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

      <section id="curriculum" className="scroll-mt-20 space-y-4">
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
                  {modulePct > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="bar-in h-full rounded-full bg-brand" style={{ width: `${modulePct}%` }} />
                    </div>
                  )}
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
                        <span aria-hidden className={`hidden shrink-0 transition group-hover:translate-x-1 sm:block ${isNext ? "text-[#b97a10]" : "text-muted opacity-40 group-hover:opacity-100"}`}>
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {m.resources.length > 0 && (
                <details className="group/res mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className="inline-block transition-transform group-open/res:rotate-90">
                      ›
                    </span>
                    Resources from the web ({m.resources.length})
                  </summary>
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
        <section id="sessions" className="scroll-mt-20">
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
