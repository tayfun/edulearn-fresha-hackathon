"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeaderArt, Icon } from "@/components/art";
import { Card, ErrorNote, Loading, ResourceList, api, useLoad } from "@/components/ui";

type Lesson = { id: number; title: string; est_minutes: number; completed_at: string | null; objectives: string[]; bestScore: number | null };
type Detail = {
  course: { id: number; title: string; description: string; topic: string; tone: string; lengthLabel: string; image_svg: string | null };
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  minutesTotal: number;
  weakCount: number;
  dueCards: number;
  totalCards: number;
  streak: number;
  nextLessonId: number | null;
  activity: { date: string; count: number; future: boolean }[][];
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

const fmtMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`);
/** Drop "Module 2:" / "Lesson 4:" prefixes the model sometimes adds; position is already shown. */
const bare = (title: string) => title.replace(/^(module|lesson|week|part|unit)\s+\d+\s*[:.\-–—]\s*/i, "");
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

function Panel({ icon, title, i, children, className = "" }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; i: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel rise flex flex-col p-5 ${className}`} style={delay(i)}>
      <h2 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
        <Icon name={icon} className="h-[18px] w-[18px] text-brand" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const shown = useCountUp(value);
  const r = 52;
  const full = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-48 w-48 sm:h-52 sm:w-52" role="img" aria-label={`Course progress ${value}%`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90 overflow-visible">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#67e8f9" />
            <stop offset="1" stopColor="#0ea5c6" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} fill="none" stroke="#12283d" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="url(#ring)" strokeWidth="10" strokeLinecap="round" strokeDasharray={full} strokeDashoffset={full * (1 - shown / 100)} className="glow-line" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted">Complete</span>
        <span className="flex items-start text-6xl font-bold leading-none tracking-tight text-white">
          {shown}
          <span className="ml-0.5 mt-1.5 text-2xl leading-none text-brand">%</span>
        </span>
      </div>
    </div>
  );
}

const HEAT = ["bg-[#10243a]", "bg-[#0e5a70]", "bg-[#0e8fae]", "bg-[#22d3ee]", "bg-[#a5f3fc]"];

/** Twelve weeks of study activity, one column per week, Monday at the top. */
function Heatmap({ weeks }: { weeks: Detail["activity"] }) {
  return (
    <div>
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-1 text-[11px] leading-none text-muted" aria-hidden>
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
            <span key={i} className="flex h-full items-center">
              {d}
            </span>
          ))}
        </div>
        <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Study activity over the last 12 weeks">
          {weeks.flatMap((week, w) =>
            week.map((day, d) => (
              <span
                key={day.date}
                title={day.future ? undefined : `${day.date}: ${day.count ? `${day.count} thing${day.count === 1 ? "" : "s"} done` : "no study"}`}
                className={`cell-in aspect-square w-full rounded-[3px] ${day.future ? "bg-transparent ring-1 ring-inset ring-[#10243a]" : HEAT[Math.min(4, day.count)]}`}
                style={delay(w * 7 + d)}
              />
            )),
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>12 weeks</span>
        <span className="flex items-center gap-1" aria-hidden>
          Less
          {HEAT.map((c) => (
            <span key={c} className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

/** A perspective floor that fades out towards the horizon and the sides, with a pool of light where the subject stands. */
function Floor() {
  return (
    <svg aria-hidden viewBox="0 0 400 110" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[52%] w-full">
      <defs>
        <radialGradient id="floorfade" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="floormask">
          <rect width="400" height="110" fill="url(#floorfade)" />
        </mask>
        <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="34" rx="150" ry="26" fill="url(#pool)" />
      <g mask="url(#floormask)" stroke="#22d3ee" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {[-520, -380, -270, -180, -105, -45, 0, 45, 105, 180, 270, 380, 520].map((dx) => (
          <line key={dx} x1={200 + dx * 0.38} y1="14" x2={200 + dx * 1.7} y2="110" opacity="0.55" />
        ))}
        {[14, 22, 33, 48, 68, 94].map((y, i) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} opacity={0.3 + i * 0.08} className="twinkle" style={{ "--i": i } as React.CSSProperties} />
        ))}
      </g>
    </svg>
  );
}

/** The course illustration on a glowing perspective floor. Drawn once by the model, then stored. */
function CourseImage({ courseId, initial }: { courseId: number; initial: string | null }) {
  const [svg, setSvg] = useState(initial);
  const [state, setState] = useState<"drawing" | "done">(initial ? "done" : "drawing");
  const asked = useRef(false);
  useEffect(() => {
    if (initial || asked.current) return;
    asked.current = true;
    api<{ image: string | null }>(`/api/courses/${courseId}/image`, { method: "POST" })
      .then((r) => setSvg(r.image))
      // The illustration is decoration: on failure the animated placeholder simply stays.
      .catch(() => {})
      .finally(() => setState("done"));
  }, [courseId, initial]);

  return (
    <div className="relative mt-3 h-40 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(closest-side,rgb(34_211_238/0.2),transparent)]" />
      <Floor />
      {svg ? (
        // The drawing is model output: an <img> renders it without running anything inside it.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} className="fade-in glow-line relative mx-auto h-[82%] w-auto" />
      ) : (
        <svg aria-hidden viewBox="0 0 400 240" className="glow-line relative mx-auto h-[82%]">
          <path
            d="M40 150 C90 40 130 40 180 120 S270 220 320 90 L360 60"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            style={{ animation: "draw 2.4s ease-in-out infinite alternate" }}
          />
        </svg>
      )}
      {state === "drawing" && <span className="absolute bottom-2 right-3 text-xs text-muted">drawing illustration…</span>}
    </div>
  );
}

/** Every lesson as a waypoint on one glowing track from Start to Finish. */
function Path({ lessons, nextId }: { lessons: Lesson[]; nextId: number | null }) {
  const n = lessons.length;
  const nextIndex = lessons.findIndex((l) => l.id === nextId);
  const pos = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const reached = nextIndex === -1 ? 100 : pos(nextIndex);
  const dense = n > 16;
  return (
    <div className="relative mx-2 h-8">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#12283d]" />
      <span aria-hidden className="bar-in glow-line absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#0ea5c6] to-[#67e8f9]" style={{ width: `${reached}%` }} />
      <ol>
        {lessons.map((l, i) => {
          const isNext = l.id === nextId;
          return (
            <li key={l.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(i)}%` }}>
              <Link
                href={`/lessons/${l.id}`}
                title={`${i + 1}. ${bare(l.title)}${l.completed_at ? " (done)" : isNext ? " (up next)" : ""}`}
                aria-label={`Lesson ${i + 1}: ${bare(l.title)}${l.completed_at ? ", done" : isNext ? ", up next" : ""}`}
                className={`group relative flex items-center justify-center ${dense ? "h-6 w-2" : "h-8 w-6"}`}
              >
                {isNext && <span aria-hidden className="ping-soft absolute h-4 w-4 rounded-full bg-brand" />}
                <span
                  className={`relative block rounded-full transition-transform group-hover:scale-150 ${
                    l.completed_at
                      ? `bg-[#a5f3fc] ${dense ? "h-2 w-2" : "h-3 w-3"}`
                      : isNext
                        ? `border-[3px] border-brand bg-paper shadow-[0_0_12px_rgb(34_211_238/0.9)] ${dense ? "h-3.5 w-3.5" : "h-5 w-5"}`
                        : `border-2 border-[#2c4a66] bg-paper ${dense ? "h-2 w-2" : "h-3 w-3"}`
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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${score >= 0.75 ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>
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
  href,
  animate = "",
}: {
  icon: "book" | "clock" | "target" | "cards";
  label: string;
  value: React.ReactNode;
  tint: string;
  i: number;
  href: string;
  animate?: string;
}) {
  return (
    <Link href={href} className="panel rise lift group flex items-center gap-3 px-4 py-4" style={delay(i)}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon name={icon} className={`h-5 w-5 ${animate}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold leading-tight tabular-nums text-white">{value}</span>
        <span className="block text-xs leading-tight text-muted">{label}</span>
      </span>
      <span aria-hidden className="hidden text-muted transition group-hover:translate-x-1 group-hover:text-brand sm:block">
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
  const activeDays = data.activity.flat().filter((d) => d.count > 0).length;
  const scores = allLessons.map((l) => l.bestScore).filter((x): x is number => x !== null);
  const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;
  const minutesDone = allLessons.filter((l) => l.completed_at).reduce((s, l) => s + l.est_minutes, 0);

  async function remove() {
    if (!confirm(`Delete "${course.title}" and all its progress? This cannot be undone.`)) return;
    await api(`/api/courses/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <header className="rise relative">
        <HeaderArt />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
            <span aria-hidden>‹</span> My courses
          </Link>
          <p className="mt-3 text-sm font-medium uppercase tracking-widest text-brand">{data.lessonsDone === 0 ? "Ready to start" : done ? "Course complete" : "Welcome back"}</p>
          <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-tight text-white sm:text-3xl lg:max-w-[64%] lg:text-4xl">{course.title}</h1>
          {course.description && <p className="mt-2 max-w-xl text-muted lg:max-w-[58%]">{course.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {[course.lengthLabel, course.tone, `${data.lessonsTotal} lesson${data.lessonsTotal === 1 ? "" : "s"}`, fmtMinutes(data.minutesTotal)].map((t) => (
              <span key={t} className="rounded-full border border-line bg-card px-2.5 py-1 text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Panel i={1} icon="target" title="Course progress">
          <div className="flex flex-1 flex-col justify-center py-4">
            <ProgressRing value={data.progress} />
          </div>
          <p className="text-center text-sm text-ink">
            {data.lessonsDone} of {data.lessonsTotal} lessons <span className="text-muted">·</span> <span className="text-brand">{fmtMinutes(minutesDone)}</span> studied
          </p>
          <p className="mt-1 text-center text-xs text-muted">
            {done
              ? "Every lesson complete"
              : plan
                ? `Day ${Math.min(plan.dayNumber, plan.totalDays)} of ${plan.totalDays} · target pace ${plan.expectedPercent}%`
                : `${fmtMinutes(data.minutesTotal - minutesDone)} to go`}
          </p>
        </Panel>

        <Panel i={2} icon="flame" title="Study streak">
          <div className="mt-3 flex items-end gap-3">
            <span className="glow-text text-6xl font-bold leading-none tracking-tight text-brand">{data.streak}</span>
            <span className="pb-1">
              <span className="block text-lg font-bold leading-tight text-white">day streak</span>
              <span className="block text-sm text-muted">{data.streak > 1 ? "Keep it up!" : data.streak === 1 ? "It starts with one day." : "Study today to start one."}</span>
            </span>
          </div>
          <div className="my-auto py-5">
            <Heatmap weeks={data.activity} />
          </div>
          <p className="text-center text-xs text-muted">
            Active on <span className="font-semibold text-ink">{activeDays}</span> day{activeDays === 1 ? "" : "s"} in the last 12 weeks
          </p>
        </Panel>

        <Panel i={3} icon="book" title={nextLesson ? "Next up" : "Course complete"} className="order-first md:order-none md:col-span-2 lg:col-span-1">
          <div className="flex flex-1 flex-col md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:items-center md:max-lg:gap-6">
            <CourseImage courseId={course.id} initial={course.image_svg} />
            <div className="mt-4 flex flex-1 flex-col md:max-lg:mt-3 md:max-lg:self-stretch">
              {nextLesson ? (
                <>
                  <p className="text-xs text-muted">
                    Lesson {allLessons.indexOf(nextLesson) + 1} of {data.lessonsTotal} · {nextLesson.est_minutes} min
                  </p>
                  <p className="mt-0.5 text-xl font-bold leading-snug text-white">{bare(nextLesson.title)}</p>
                  {nextLesson.objectives[0] && <p className="mb-4 mt-1 line-clamp-2 text-sm text-muted">{nextLesson.objectives[0]}</p>}
                  <Link
                    href={`/lessons/${nextLesson.id}`}
                    className="glow-btn group mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#5eead4] px-5 py-3 text-sm font-bold text-on-brand transition hover:brightness-110"
                  >
                    {data.lessonsDone === 0 ? "Start" : "Continue"}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-white">You finished every lesson.</p>
                  <p className="mt-1 text-sm text-muted">{data.weakCount ? "A few weak spots are left to polish." : "Nothing left to polish. Nicely done."}</p>
                  <Link
                    href={`/courses/${id}/weaknesses`}
                    className="mt-auto flex items-center justify-center rounded-xl border border-brand/40 px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft"
                  >
                    Review weak spots
                  </Link>
                </>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <section className="panel rise p-5" style={delay(4)}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
            <Icon name="flag" className="h-[18px] w-[18px] text-brand" />
            Your path
          </h2>
          <span className="min-w-0 truncate text-sm text-muted">
            {nextLesson ? (
              <>
                You are at <span className="text-ink">{bare(nextLesson.title)}</span> · {data.lessonsTotal - data.lessonsDone} to go
              </>
            ) : (
              "All lessons complete"
            )}
          </span>
        </div>
        <div className="mt-4">
          <Path lessons={allLessons} nextId={data.nextLessonId} />
        </div>
        <div className="mx-2 mt-1 flex justify-between text-xs uppercase tracking-wider text-muted">
          <span>Start</span>
          <span>Finish</span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat i={5} icon="clock" href="#curriculum" tint="bg-brand-soft text-brand" label={done ? "all done" : "left to study"} value={done ? "0 min" : fmtMinutes(data.minutesTotal - minutesDone)} />
        <Stat i={6} icon="book" href="#curriculum" tint="bg-brand-soft text-brand" label="avg quiz score" value={avgScore === null ? "–" : `${avgScore}%`} />
        <Stat
          i={7}
          icon="target"
          href={`/courses/${id}/weaknesses`}
          tint={data.weakCount ? "bg-bad-soft text-bad" : "bg-brand-soft text-brand"}
          label={data.weakCount === 1 ? "weak spot" : "weak spots"}
          value={data.weakCount}
        />
        <Stat i={8} icon="cards" href={`/courses/${id}/flashcards`} tint="bg-brand-soft text-brand" label={data.dueCards === 1 ? "card due" : "cards due"} value={data.dueCards} />
      </div>

      {plan && !done && (
        <section className="panel rise p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
              <Icon name="clock" className="h-[18px] w-[18px] text-brand" />
              Today&apos;s plan
            </h2>
            <span className="text-sm text-muted">
              <span className="font-semibold text-ink">{plan.minutesToday}</span> of {plan.dailyMinutes} min target
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#12283d]">
            <div
              className={`bar-in h-full rounded-full ${plan.targetMet ? "bg-good" : "glow-line bg-brand"}`}
              style={{ width: `${Math.min(100, Math.round((plan.minutesToday / plan.dailyMinutes) * 100))}%` }}
            />
          </div>
          {plan.targetMet ? (
            <p className="mt-3 text-sm font-medium text-good">✓ Target met. Come back tomorrow to keep your streak, or keep going.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {plan.upNext.map((l) => (
                <li key={l.id}>
                  <Link href={`/lessons/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/60 px-4 py-2.5 text-sm transition hover:border-brand">
                    <span>{bare(l.title)}</span>
                    <span className="shrink-0 text-xs text-muted">{l.est_minutes} min</span>
                  </Link>
                </li>
              ))}
              {data.dueCards > 0 && (
                <li>
                  <Link
                    href={`/courses/${id}/flashcards`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/60 px-4 py-2.5 text-sm transition hover:border-brand"
                  >
                    <span>
                      Review {data.dueCards} flashcard{data.dueCards > 1 ? "s" : ""}
                    </span>
                    <span className="shrink-0 text-xs text-muted">~{Math.max(1, Math.round(data.dueCards / 3))} min</span>
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      <section id="curriculum" className="scroll-mt-20 space-y-4 pt-2">
        <h2 className="text-2xl font-bold text-white">Curriculum</h2>
        {data.modules.map((m, mi) => {
          const doneCount = m.lessons.filter((l) => l.completed_at).length;
          const modulePct = m.lessons.length ? Math.round((doneCount / m.lessons.length) * 100) : 0;
          const active = m.lessons.some((l) => l.id === data.nextLessonId);
          return (
            <section key={m.id} className={`panel rise p-5 ${active ? "!border-brand/60" : ""}`}>
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold ${modulePct === 100 ? "bg-good text-on-brand" : active ? "border border-brand bg-brand-soft text-brand shadow-[0_0_14px_rgb(34_211_238/0.45)]" : "border border-line bg-paper text-muted"}`}
                >
                  {modulePct === 100 ? "✓" : mi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-lg font-bold text-white">
                      {bare(m.title)}
                      {modulePct === 100 && <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide text-good">Complete</span>}
                      {active && modulePct < 100 && <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide text-brand">In progress</span>}
                    </h3>
                    <span className="shrink-0 text-xs text-muted">
                      {doneCount}/{m.lessons.length} lessons
                    </span>
                  </div>
                  {m.summary && <p className="mt-1 text-sm text-muted">{m.summary}</p>}
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#12283d]">
                    <div className={`bar-in h-full rounded-full ${modulePct === 100 ? "bg-good" : "bg-brand"}`} style={{ width: `${modulePct}%` }} />
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
                        className={`group flex items-start gap-3 px-2 py-3 transition sm:items-center ${isNext ? "bg-brand-soft/70 hover:bg-brand-soft" : "hover:bg-white/[0.03]"}`}
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold sm:mt-0 ${
                            l.completed_at ? "border-good bg-good text-on-brand" : isNext ? "border-2 border-brand shadow-[0_0_10px_rgb(34_211_238/0.7)]" : "border-[#2c4a66]"
                          }`}
                          aria-label={l.completed_at ? "Completed" : "Not completed"}
                        >
                          {l.completed_at ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-medium ${l.completed_at ? "text-ink/80" : "text-ink"}`}>
                            {bare(l.title)}
                            {isNext && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-on-brand">Next</span>}
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
                        <span aria-hidden className={`hidden shrink-0 transition group-hover:translate-x-1 sm:block ${isNext ? "text-brand" : "text-muted opacity-40 group-hover:opacity-100"}`}>
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
            </section>
          );
        })}
      </section>

      {data.sessions.length > 0 && (
        <section id="sessions" className="scroll-mt-20">
          <h2 className="mb-3 text-2xl font-bold text-white">Study sessions</h2>
          <ul className={`grid gap-3 ${data.sessions.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {data.sessions.map((s) => (
              <li key={s.id}>
                <Card className="h-full p-4">
                  <div className="font-medium text-ink">
                    {new Date(s.started_at.replace(" ", "T") + "Z").toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {s.lessons_done} lesson{s.lessons_done === 1 ? "" : "s"} · {s.quizzes_done} quiz{s.quizzes_done === 1 ? "" : "zes"} · {s.cards_reviewed} card{s.cards_reviewed === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-xs text-muted">Weak spots at the end: {s.weaknesses.length ? s.weaknesses.map((w) => w.name).join(", ") : "none"}</div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 border-t border-line pt-4 text-right">
        <button onClick={remove} className="text-sm text-muted hover:text-bad hover:underline">
          Delete this course
        </button>
      </div>
    </div>
  );
}
