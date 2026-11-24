"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Crumbs, Dots, ErrorNote, Loading, ProgressBar, ResourceList, api, btn, masteryTone, useLoad } from "@/components/ui";

type Weak = {
  id: number; name: string; mastery: number | null; correct: number; incorrect: number; flashcards: number;
  missed: { prompt: string; answered: string; correct: string }[];
  lessons: { id: number; title: string }[];
  resources: { id: number; title: string; url: string }[];
  recommendation: { advice: string; steps: string[]; stale: boolean } | null;
};
type Data = {
  course: { id: number; title: string };
  weak: Weak[];
  tracked: { id: number; name: string; mastery: number | null; correct: number; incorrect: number }[];
  untested: number;
};

export default function WeaknessesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, setData, error, reload } = useLoad<Data>(`/api/courses/${id}/weaknesses`);
  const [adviceState, setAdviceState] = useState<"pending" | "settled">("pending");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const requested = useRef(false);

  const advise = useCallback(() => {
    api<Data>(`/api/courses/${id}/recommendations`, { method: "POST" })
      .then(setData, (e) => setActionError(e instanceof Error ? e.message : "Could not write recommendations"))
      .finally(() => setAdviceState("settled"));
  }, [id, setData]);

  const needsAdvice = !!data?.weak.some((w) => !w.recommendation || w.recommendation.stale);
  const advising = needsAdvice && adviceState === "pending";

  // Write advice automatically for weak spots that have none (or whose advice predates the latest quiz).
  useEffect(() => {
    if (!needsAdvice || requested.current) return;
    requested.current = true;
    advise();
  }, [needsAdvice, advise]);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading label="Looking at your results" />;

  async function practice() {
    setBusy("practice");
    setActionError("");
    try {
      const { id: quizId } = await api<{ id: number }>("/api/quizzes", { body: { kind: "practice", courseId: Number(id) } });
      router.push(`/quizzes/${quizId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not create the practice quiz");
      setBusy("");
    }
  }

  async function makeCards() {
    setBusy("cards");
    setActionError("");
    try {
      await api(`/api/courses/${id}/flashcards`, { method: "POST" });
      router.push(`/courses/${id}/flashcards`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not create flashcards");
      setBusy("");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Crumbs items={[{ label: "My courses", href: "/" }, { label: data.course.title, href: `/courses/${id}` }, { label: "Weak spots" }]} />
        <h1 className="text-3xl font-semibold">Weak spots</h1>
        <p className="mt-1 text-muted">What your quiz answers say you haven&apos;t nailed yet, and what to do about each one.</p>
      </div>

      {data.weak.length === 0 ? (
        <Card className="text-center">
          <p className="font-display text-xl font-semibold">{data.tracked.length ? "No weak spots right now" : "Nothing to show yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {data.tracked.length ? "Every concept you've been quizzed on is above the bar. Keep going." : "Take a lesson quiz and your results will show up here."}
          </p>
          <Link href={`/courses/${id}`} className={`${btn.primary} mt-4`}>
            Back to course
          </Link>
        </Card>
      ) : (
        <>
          <Card className="border-brand/30 bg-brand-soft/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold">{data.weak.length} concept{data.weak.length > 1 ? "s" : ""}</span> to work on. Practise them, or turn them into flashcards.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className={btn.primary} disabled={!!busy} onClick={practice}>
                  {busy === "practice" ? <>Preparing <Dots /></> : "Practice quiz on these"}
                </button>
                <button className={btn.secondary} disabled={!!busy} onClick={makeCards}>
                  {busy === "cards" ? <>Writing cards <Dots /></> : "Create flashcards"}
                </button>
              </div>
            </div>
          </Card>
          <ErrorNote message={actionError} />

          <div className="space-y-4">
            {data.weak.map((w) => (
              <Card key={w.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold">{w.name}</h2>
                  <span className="text-sm text-muted">
                    {w.correct} right · {w.incorrect} wrong · mastery {Math.round((w.mastery ?? 0) * 100)}%
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={(w.mastery ?? 0) * 100} tone={masteryTone(w.mastery)} label={`${w.name} mastery`} />
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold">How to improve</h3>
                  {w.recommendation ? (
                    <>
                      <p className="mt-1 text-sm">{w.recommendation.advice}</p>
                      {w.recommendation.steps.length > 0 && (
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                          {w.recommendation.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      )}
                    </>
                  ) : advising ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                      <Dots /> Working out what went wrong and finding resources
                    </p>
                  ) : (
                    <button
                      className="mt-1 text-sm text-brand-dark underline"
                      onClick={() => {
                        setActionError("");
                        setAdviceState("pending");
                        advise();
                      }}
                    >
                      Get recommendations
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {w.lessons.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold">Revisit</h3>
                      <ul className="mt-1 space-y-1 text-sm">
                        {w.lessons.map((l) => (
                          <li key={l.id}>
                            <Link href={`/lessons/${l.id}`} className="text-brand-dark hover:underline">
                              {l.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {w.resources.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">From the web</h3>
                      <ResourceList resources={w.resources} />
                    </div>
                  )}
                </div>

                {w.missed.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted hover:text-ink">Questions you missed ({w.missed.length})</summary>
                    <ul className="mt-2 space-y-2 text-sm">
                      {w.missed.map((m, i) => (
                        <li key={i} className="rounded-lg border border-line px-3 py-2">
                          <div>{m.prompt}</div>
                          <div className="mt-1 text-xs text-bad">You answered: {m.answered}</div>
                          <div className="text-xs text-good">Correct: {m.correct}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {data.tracked.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">All concepts</h2>
          <Card>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {data.tracked.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-muted">{Math.round((c.mastery ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={(c.mastery ?? 0) * 100} tone={masteryTone(c.mastery)} label={`${c.name} mastery`} />
                </div>
              ))}
            </div>
            {data.untested > 0 && <p className="mt-4 text-xs text-muted">{data.untested} more concept{data.untested > 1 ? "s" : ""} not quizzed yet.</p>}
          </Card>
        </section>
      )}
    </div>
  );
}
