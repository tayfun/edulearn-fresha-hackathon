"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, Crumbs, Dots, ErrorNote, Loading, api, btn, useLoad } from "@/components/ui";

type CardRow = { id: number; front: string; back: string; box: number; due_at: string; reviews: number; concept: string | null; due: number };
type Data = { course: { id: number; title: string }; cards: CardRow[]; weakCount: number };

function dueLabel(c: CardRow) {
  if (c.due) return "due now";
  const days = Math.ceil((new Date(c.due_at.replace(" ", "T") + "Z").getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "due tomorrow" : `due in ${days} days`;
}

export default function FlashcardsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<Data>(`/api/courses/${id}/flashcards`);
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ knew: 0, missed: 0 });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading label="Shuffling your cards" />;
  const due = data.cards.filter((c) => c.due);

  async function generate() {
    setBusy(true);
    setActionError("");
    try {
      setData(await api<Data>(`/api/courses/${id}/flashcards`, { method: "POST" }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not create flashcards");
    } finally {
      setBusy(false);
    }
  }

  async function answer(knewIt: boolean) {
    const card = queue![0];
    setActionError("");
    try {
      await api(`/api/flashcards/${card.id}/review`, { body: { knewIt } });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not save that review");
      return;
    }
    setStats((s) => ({ knew: s.knew + (knewIt ? 1 : 0), missed: s.missed + (knewIt ? 0 : 1) }));
    setFlipped(false);
    // A missed card comes round again at the end of this session.
    const rest = queue!.slice(1);
    const next = knewIt ? rest : [...rest, card];
    setQueue(next);
    if (next.length === 0) reload();
  }

  async function remove(cardId: number) {
    await api(`/api/flashcards/${cardId}`, { method: "DELETE" });
    reload();
  }

  const crumbs = <Crumbs items={[{ label: "My courses", href: "/" }, { label: data.course.title, href: `/courses/${id}` }, { label: "Flashcards" }]} />;

  if (queue && queue.length > 0) {
    const card = queue[0];
    return (
      <div className="mx-auto max-w-xl">
        {crumbs}
        <div className="mb-3 flex justify-between text-sm text-muted">
          <span>{queue.length} left</span>
          <button className="hover:text-ink hover:underline" onClick={() => { setQueue(null); reload(); }}>
            End review
          </button>
        </div>
        <button
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Show the question" : "Show the answer"}
          className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-line bg-card p-8 text-center shadow-sm transition hover:border-brand"
        >
          {card.concept && <span className="mb-3 text-xs uppercase tracking-wide text-brand">{card.concept}</span>}
          <span className={flipped ? "text-lg" : "font-display text-2xl font-semibold"}>{flipped ? card.back : card.front}</span>
          <span className="mt-6 text-xs text-muted">{flipped ? "Answer" : "Tap to reveal the answer"}</span>
        </button>
        <div className="mt-3">
          <ErrorNote message={actionError} />
        </div>
        {flipped ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className={btn.secondary} onClick={() => answer(false)}>
              Didn&apos;t know it
            </button>
            <button className={btn.primary} onClick={() => answer(true)}>
              Knew it
            </button>
          </div>
        ) : (
          <button className={`${btn.primary} mt-4 w-full`} onClick={() => setFlipped(true)}>
            Show answer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        {crumbs}
        <h1 className="text-3xl font-semibold">Flashcards</h1>
        <p className="mt-1 text-muted">Cards built from your weak spots. Ones you know come back less often; ones you miss come back sooner.</p>
      </div>

      {queue && queue.length === 0 && (
        <Card className="border-good/40 bg-good-soft text-center">
          <p className="font-display text-xl font-semibold text-good">Review done</p>
          <p className="mt-1 text-sm">
            {stats.knew} known, {stats.missed} to see again.
          </p>
        </Card>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-semibold">{due.length}</span> of {data.cards.length} card{data.cards.length === 1 ? "" : "s"} due for review.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className={btn.primary}
            disabled={due.length === 0}
            onClick={() => {
              setStats({ knew: 0, missed: 0 });
              setFlipped(false);
              setQueue(due);
            }}
          >
            Review due cards
          </button>
          <button className={btn.secondary} disabled={busy || data.weakCount === 0} onClick={generate} title={data.weakCount === 0 ? "No weak spots to build cards from" : undefined}>
            {busy ? <>Writing cards <Dots /></> : `Create cards from weak spots (${data.weakCount})`}
          </button>
        </div>
      </Card>
      <ErrorNote message={actionError} />

      {data.cards.length === 0 ? (
        <p className="text-muted">
          No flashcards yet.{" "}
          {data.weakCount === 0 ? (
            <>
              Cards are made from concepts you get wrong in quizzes, and you have none right now. <Link href={`/courses/${id}`} className="text-brand-dark underline">Back to the course</Link>
            </>
          ) : (
            "Create some from your weak spots above."
          )}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.cards.map((c) => (
            <li key={c.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2 text-xs text-muted">
                  <span>{c.concept ?? "General"}</span>
                  <span className={c.due ? "font-medium text-warn" : ""}>
                    box {c.box} · {dueLabel(c)}
                  </span>
                </div>
                <p className="mt-2 font-medium">{c.front}</p>
                <p className="mt-1 text-sm text-muted">{c.back}</p>
                <button onClick={() => remove(c.id)} className="mt-3 text-xs text-muted hover:text-bad hover:underline">
                  Remove
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
