"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, ErrorNote, ProgressBar, btn, useLoad } from "@/components/ui";

type CourseSummary = {
  id: number; title: string; topic: string; tone: string; lengthLabel: string; progress: number;
  lessonsDone: number; lessonsTotal: number; weakCount: number; dueCards: number; image: string | null;
};

const IDEAS = ["How black holes work", "SQL for data analysis", "Conversational Spanish", "Personal finance basics", "The French Revolution", "Music theory for guitar"];

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const { data, error, reload } = useLoad<{ courses: CourseSummary[] }>("/api/courses");
  const start = (t: string) => {
    const clean = t.trim();
    if (clean.length >= 2) router.push(`/new?topic=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="space-y-14">
      <section className="pt-8 text-center sm:pt-16">
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">What do you want to learn?</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Type any topic. We&apos;ll ask a few questions, then build a course around you, with quizzes that find your weak spots and help you fix them.
        </p>
        <form
          className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(topic);
          }}
        >
          <input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={300}
            placeholder="e.g. How neural networks learn"
            aria-label="Topic to learn"
            className="h-12 flex-1 rounded-xl border border-line bg-card px-4 text-base shadow-sm focus:border-brand focus:outline-none"
          />
          <button type="submit" disabled={topic.trim().length < 2} className={`${btn.primary} h-12 px-6`}>
            Build my course
          </button>
        </form>
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {IDEAS.map((idea) => (
            <button key={idea} onClick={() => start(idea)} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-muted hover:border-brand hover:text-brand-dark">
              {idea}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Your courses</h2>
        <ErrorNote message={error} onRetry={reload} />
        {data && data.courses.length === 0 && <p className="text-muted">No courses yet. Your first one is a sentence away.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="group">
              <Card className="lift h-full group-hover:border-brand">
                <div className="flex items-start justify-between gap-3">
                  {c.image && (
                    // Model-drawn SVG, shown through an <img> so nothing inside it can run.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(c.image)}`} className="glow-line h-12 w-20 shrink-0 rounded-lg bg-brand-soft/60 object-contain p-1" />
                  )}
                  <h3 className="min-w-0 flex-1 font-display text-lg font-semibold leading-snug">{c.title}</h3>
                  <span className="shrink-0 text-sm font-semibold text-brand-dark">{c.progress}%</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.lengthLabel} · {c.tone}
                </p>
                <div className="mt-4">
                  <ProgressBar value={c.progress} label={`${c.title} progress`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    {c.lessonsDone}/{c.lessonsTotal} lessons
                  </span>
                  {c.weakCount > 0 && <span className="text-warn">{c.weakCount} weak spot{c.weakCount > 1 ? "s" : ""}</span>}
                  {c.dueCards > 0 && <span>{c.dueCards} card{c.dueCards > 1 ? "s" : ""} due</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
