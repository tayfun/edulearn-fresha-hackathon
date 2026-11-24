"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Crumbs, Dots, ErrorNote, Loading, Markdown, ResourceList, api, btn, streamText, useLoad } from "@/components/ui";

type Detail = {
  lesson: { id: number; title: string; est_minutes: number; content: string | null; completed_at: string | null; objectives: string[] };
  course: { id: number; title: string; tone: string };
  module: { id: number; title: string };
  index: number; total: number;
  prev: { id: number; title: string } | null;
  next: { id: number; title: string } | null;
  concepts: { id: number; name: string }[];
  resources: { id: number; title: string; url: string }[];
  quizId: number | null; bestScore: number | null;
  tutor: { role: "user" | "assistant"; content: string }[];
};

const QUICK = ["Explain this differently", "Give me a real-world example", "What's the one thing to remember?"];

function Tutor({ lessonId, initial, ready }: { lessonId: string; initial: Detail["tutor"]; ready: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      await streamText(`/api/lessons/${lessonId}/chat`, { message }, (full) =>
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: full }]),
      );
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setError(e instanceof Error ? e.message : "The tutor could not answer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex max-h-[34rem] flex-col p-0 lg:sticky lg:top-20">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-lg font-semibold">Ask your tutor</h2>
        <p className="text-xs text-muted">Stuck on something in this lesson? Ask here.</p>
      </div>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            {QUICK.map((q) => (
              <button key={q} disabled={!ready || busy} onClick={() => send(q)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm hover:border-brand hover:text-brand-dark disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-6 rounded-xl bg-brand px-3 py-2 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-2 rounded-xl bg-paper px-3 py-2">
              {m.content ? <Markdown small>{m.content}</Markdown> : <span className="text-muted"><Dots /></span>}
            </div>
          ),
        )}
        <ErrorNote message={error} />
      </div>
      {messages.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 py-2">
          <button disabled={busy} onClick={() => send(QUICK[0])} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-brand disabled:opacity-50">
            {QUICK[0]}
          </button>
        </div>
      )}
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          disabled={!ready}
          placeholder="Ask a question"
          aria-label="Question for the tutor"
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button type="submit" disabled={!ready || busy || !input.trim()} className={btn.primary}>
          Ask
        </button>
      </form>
    </Card>
  );
}

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, reload } = useLoad<Detail>(`/api/lessons/${id}`);
  const [streamed, setStreamed] = useState("");
  const [finished, setFinished] = useState(false);
  const [genError, setGenError] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const started = useRef(false);

  const generate = useCallback(() => {
    streamText(`/api/lessons/${id}/generate`, {}, setStreamed).then(
      (full) => (full.trim() ? setFinished(true) : setGenError("The lesson came back empty.")),
      (e) => setGenError(e instanceof Error ? e.message : "Could not write the lesson"),
    );
  }, [id]);

  // Lessons are written the first time they are opened.
  useEffect(() => {
    if (!data || data.lesson.content || started.current) return;
    started.current = true;
    generate();
  }, [data, generate]);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading label="Opening the lesson" />;
  const { lesson, course } = data;
  const content = lesson.content ?? streamed;
  const writing = lesson.content === null && !finished && !genError;
  const ready = !!content && !writing && !genError;
  const retry = () => {
    setGenError("");
    setStreamed("");
    generate();
  };

  async function takeQuiz(fresh = false) {
    setBusy("quiz");
    setActionError("");
    try {
      const { id: quizId } = await api<{ id: number }>("/api/quizzes", { body: { kind: "lesson", lessonId: lesson.id, fresh } });
      router.push(`/quizzes/${quizId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not create the quiz");
      setBusy("");
    }
  }

  async function toggleComplete() {
    setBusy("complete");
    setActionError("");
    try {
      await api(`/api/lessons/${lesson.id}/complete`, { body: { completed: !lesson.completed_at } });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not update the lesson");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <Crumbs items={[{ label: "My courses", href: "/" }, { label: course.title, href: `/courses/${course.id}` }, { label: `Lesson ${data.index} of ${data.total}` }]} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-brand">{data.module.title}</div>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{lesson.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{lesson.est_minutes} min</span>
            <span>·</span>
            <span>{course.tone}</span>
            {lesson.completed_at && <span className="rounded-full bg-good-soft px-2 py-0.5 font-medium text-good">Completed</span>}
          </div>

          {lesson.objectives.length > 0 && (
            <div className="mt-5 rounded-xl border border-line bg-card px-4 py-3">
              <div className="text-sm font-medium">By the end you&apos;ll be able to</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                {lesson.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            {!content && writing && <Loading label="Writing your lesson" />}
            {content && <Markdown>{content}</Markdown>}
            {content && writing && <div className="mt-2 text-muted"><Dots /></div>}
            <ErrorNote message={genError} onRetry={retry} />
          </div>

          {ready && (
            <>
              <Card className="mt-8 border-brand/30 bg-brand-soft/50">
                <h2 className="text-xl font-semibold">Check what stuck</h2>
                <p className="mt-1 text-sm text-muted">
                  A short quiz on {data.concepts.map((c) => c.name).join(", ")}. It finds what to revisit and completes the lesson.
                  {data.bestScore !== null && ` Your best score so far: ${Math.round(data.bestScore * 100)}%.`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={btn.primary} disabled={!!busy} onClick={() => takeQuiz(false)}>
                    {busy === "quiz" ? <>Preparing quiz <Dots /></> : data.quizId ? "Retake the quiz" : "Take the quiz"}
                  </button>
                  {data.quizId && (
                    <button className={btn.secondary} disabled={!!busy} onClick={() => takeQuiz(true)}>
                      New questions
                    </button>
                  )}
                  <button className={btn.ghost} disabled={!!busy} onClick={toggleComplete}>
                    {lesson.completed_at ? "Mark as not done" : "Skip quiz, mark complete"}
                  </button>
                </div>
                <div className="mt-3">
                  <ErrorNote message={actionError} />
                </div>
              </Card>

              {data.resources.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-3 text-xl font-semibold">Further reading</h2>
                  <ResourceList resources={data.resources} />
                </div>
              )}
            </>
          )}

          <div className="mt-10 flex justify-between gap-3 border-t border-line pt-4 text-sm">
            {data.prev ? (
              <Link href={`/lessons/${data.prev.id}`} className="text-muted hover:text-ink">
                ← {data.prev.title}
              </Link>
            ) : (
              <span />
            )}
            {data.next ? (
              <Link href={`/lessons/${data.next.id}`} className="text-right text-muted hover:text-ink">
                {data.next.title} →
              </Link>
            ) : (
              <Link href={`/courses/${course.id}`} className="text-right text-muted hover:text-ink">
                Back to course →
              </Link>
            )}
          </div>
        </article>

        <aside>
          <Tutor key={lesson.id} lessonId={id} initial={data.tutor} ready={ready} />
        </aside>
      </div>
    </div>
  );
}
