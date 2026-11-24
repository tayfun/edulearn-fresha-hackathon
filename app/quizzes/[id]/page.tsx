"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, Crumbs, Dots, ErrorNote, Loading, ProgressBar, api, btn, masteryTone, useLoad } from "@/components/ui";

type Quiz = {
  quiz: { id: number; course_id: number; lesson_id: number | null; kind: string; title: string; courseTitle: string; courseSlug: string };
  questions: { id: number; type: "mcq" | "short"; prompt: string; options: string[] }[];
};
type Result = {
  attempt: { id: number; score: number };
  nextLesson: { id: number; title: string; number: number } | null;
  weakCount: number;
  review: { id: number; type: "mcq" | "short"; prompt: string; options: string[]; response: string; correct: boolean; correctAnswer: string; correctIndex: number | null; explanation: string; feedback: string; concept: string | null }[];
  concepts: { id: number; name: string; mastery: number | null; weak: boolean }[];
};

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<Quiz>(`/api/quizzes/${id}`);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Agent step 8: once the quiz is graded, ask what should happen next.
  const { data: agentNext } = useLoad<{ action: string; title: string; reason: string; lessonNumber: number | null }>(result && data ? `/api/courses/${data.quiz.course_id}/next` : null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading the quiz" />;
  const { quiz, questions } = data;
  const courseHref = `/courses/${quiz.courseSlug}`;
  const answered = questions.filter((q) => (responses[q.id] ?? "").trim()).length;

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      setResult(await api<Result>(`/api/quizzes/${id}/attempts`, { body: { responses } }));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not grade the quiz");
    } finally {
      setSubmitting(false);
    }
  }

  const crumbs = <Crumbs items={[{ label: "My courses", href: "/" }, { label: quiz.courseTitle, href: courseHref }, { label: "Quiz" }]} />;

  if (result) {
    const pct = Math.round(result.attempt.score * 100);
    const right = result.review.filter((r) => r.correct).length;
    const weak = result.concepts.filter((c) => c.weak);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {crumbs}
        <Card className="text-center">
          <div className={`font-display text-6xl font-semibold ${pct >= 75 ? "text-good" : pct >= 50 ? "text-warn" : "text-bad"}`}>{pct}%</div>
          <p className="mt-1 text-muted">
            {right} of {result.review.length} correct
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm">
            {weak.length === 0
              ? "Solid. Nothing here needs another look."
              : `Worth another look: ${weak.map((c) => c.name).join(", ")}. We've saved ${weak.length > 1 ? "these" : "this"} to your weak spots.`}
          </p>
          {agentNext && agentNext.action !== "complete" && (
            <Link
              href={agentNext.action === "practice" ? `${courseHref}/weaknesses` : agentNext.action === "flashcards" ? `${courseHref}/flashcards` : `${courseHref}/${agentNext.lessonNumber}`}
              className="group mx-auto mt-5 block max-w-md rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-left transition hover:border-brand"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand">Your agent recommends next</span>
              <span className="block text-sm font-semibold text-ink">
                {agentNext.title} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
              <span className="block text-xs text-muted">{agentNext.reason}</span>
            </Link>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {result.weakCount > 0 && (
              <Link href={`${courseHref}/weaknesses`} className={weak.length ? btn.primary : btn.secondary}>
                See how to improve ({result.weakCount})
              </Link>
            )}
            {result.nextLesson ? (
              <Link href={`${courseHref}/${result.nextLesson.number}`} className={weak.length ? btn.secondary : btn.primary}>
                Next lesson →
              </Link>
            ) : (
              <Link href={courseHref} className={weak.length ? btn.secondary : btn.primary}>
                Back to course
              </Link>
            )}
            <button
              className={btn.ghost}
              onClick={() => {
                setResult(null);
                setResponses({});
              }}
            >
              Retake
            </button>
          </div>
        </Card>

        {result.concepts.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold">Concept mastery</h2>
            <div className="mt-3 space-y-3">
              {result.concepts.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="text-muted">{Math.round((c.mastery ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={(c.mastery ?? 0) * 100} tone={masteryTone(c.mastery)} label={`${c.name} mastery`} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Review</h2>
          {result.review.map((r, i) => (
            <Card key={r.id} className={r.correct ? "" : "border-bad/40"}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  {i + 1}. {r.prompt}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${r.correct ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{r.correct ? "Correct" : "Missed"}</span>
              </div>
              {r.type === "mcq" ? (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {r.options.map((o, oi) => {
                    const picked = r.response === String(oi);
                    const isRight = oi === r.correctIndex;
                    return (
                      <li key={oi} className={`rounded-lg border px-3 py-2 ${isRight ? "border-good bg-good-soft" : picked ? "border-bad bg-bad-soft" : "border-line"}`}>
                        {o}
                        {isRight && <span className="ml-2 text-xs font-medium text-good">correct answer</span>}
                        {picked && !isRight && <span className="ml-2 text-xs font-medium text-bad">your answer</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <div className={`rounded-lg border px-3 py-2 ${r.correct ? "border-good bg-good-soft" : "border-bad bg-bad-soft"}`}>
                    <span className="text-xs text-muted">Your answer</span>
                    <div>{r.response || "(blank)"}</div>
                  </div>
                  <div className="rounded-lg border border-line px-3 py-2">
                    <span className="text-xs text-muted">Model answer</span>
                    <div>{r.correctAnswer}</div>
                  </div>
                  {r.feedback && <p className="text-muted">{r.feedback}</p>}
                </div>
              )}
              {r.explanation && <p className="mt-3 text-sm text-muted">{r.explanation}</p>}
              {r.concept && <p className="mt-2 text-xs text-muted">Concept: {r.concept}</p>}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {crumbs}
      <h1 className="text-3xl font-semibold">{quiz.title}</h1>
      <p className="mt-1 text-sm text-muted">{questions.length} questions. There&apos;s no time limit, and wrong answers are how we find what to work on.</p>
      <div className="mt-6 space-y-4">
        {questions.map((q, i) => (
          <Card key={q.id}>
            <fieldset>
              <legend className="font-medium">
                {i + 1}. {q.prompt}
              </legend>
              {q.type === "mcq" ? (
                <div className="mt-3 space-y-2">
                  {q.options.map((o, oi) => {
                    const checked = responses[q.id] === String(oi);
                    return (
                      <label key={oi} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${checked ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                        <input type="radio" name={`q${q.id}`} checked={checked} onChange={() => setResponses((r) => ({ ...r, [q.id]: String(oi) }))} className="mt-1 accent-[var(--color-brand)]" />
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={responses[q.id] ?? ""}
                  onChange={(e) => setResponses((r) => ({ ...r, [q.id]: e.target.value }))}
                  rows={3}
                  maxLength={1500}
                  placeholder="Answer in a sentence or two"
                  aria-label={`Answer to question ${i + 1}`}
                  className="mt-3 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                />
              )}
            </fieldset>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <ErrorNote message={submitError} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted">
          {answered} of {questions.length} answered
        </span>
        <button className={btn.primary} disabled={submitting || answered === 0} onClick={submit}>
          {submitting ? <>Grading <Dots /></> : "Submit answers"}
        </button>
      </div>
    </div>
  );
}
