"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Card, Dots, ErrorNote, Loading, ProgressBar, api, btn } from "@/components/ui";
import { LENGTHS, LengthPreset, TONES } from "@/lib/logic";

type Question = { question: string; options: string[] };

const STAGES = ["Searching the web for the best material", "Designing your modules and lessons", "Picking the concepts to track", "Collecting resources for each module"];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${selected ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-card hover:border-brand"}`}
    >
      {children}
    </button>
  );
}

function Wizard() {
  const router = useRouter();
  const topic = (useSearchParams().get("topic") ?? "").trim();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [prior, setPrior] = useState("");
  const [tone, setTone] = useState<string>(TONES[1].label);
  const [customTone, setCustomTone] = useState("");
  const [length, setLength] = useState<LengthPreset>("30min");
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const asked = useRef(false);

  useEffect(() => {
    if (!topic) {
      router.replace("/");
      return;
    }
    if (asked.current) return;
    asked.current = true;
    api<{ questions: Question[] }>("/api/intake", { body: { topic } })
      .then((r) => setQuestions(r.questions))
      // The clarifying questions are a nicety: if they fail, carry on with the fixed steps.
      .catch(() => setQuestions([]));
  }, [topic, router]);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 6000);
    return () => clearInterval(t);
  }, [generating]);

  if (!topic || questions === null) return <Loading label="Thinking about what to ask you" />;

  const total = questions.length + 2;
  const isLast = step === total - 1;
  const toneValue = tone === "custom" ? customTone.trim() : tone;
  const canNext = step < questions.length ? !!answers[step]?.trim() : step === questions.length ? toneValue.length >= 2 : true;

  async function generate() {
    setGenerating(true);
    setStage(0);
    setError("");
    try {
      const goal = questions!.map((q, i) => `${q.question} ${answers[i]}`).join(" | ");
      const { id } = await api<{ id: number }>("/api/courses", { body: { topic, goal, priorKnowledge: prior, tone: toneValue, length } });
      router.push(`/courses/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the course");
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <Card className="mx-auto mt-10 max-w-xl text-center">
        <h1 className="text-2xl font-semibold">Building your course</h1>
        <p className="mt-1 text-sm text-muted">{topic}</p>
        <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm">
          {STAGES.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 ${i > stage ? "text-muted/50" : i === stage ? "text-ink" : "text-good"}`}>
              <span className="w-5 text-center">{i < stage ? "✓" : i === stage ? <Dots /> : "·"}</span>
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">This usually takes under a minute. Longer courses take a little more.</p>
      </Card>
    );
  }

  const q = questions[step];
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm text-muted">Your course on</p>
      <h1 className="text-2xl font-semibold">{topic}</h1>
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={((step + 1) / total) * 100} label="Setup progress" />
        <span className="shrink-0 text-xs text-muted">
          {step + 1} of {total}
        </span>
      </div>

      <Card className="mt-6">
        {q ? (
          <fieldset>
            <legend className="font-display text-xl font-semibold">{q.question}</legend>
            <div className="mt-4 grid gap-2">
              {q.options.map((o) => (
                <Chip key={o} selected={answers[step] === o} onClick={() => setAnswers((a) => Object.assign([...a], { [step]: o }))}>
                  {o}
                </Chip>
              ))}
              <input
                value={q.options.includes(answers[step] ?? "") ? "" : (answers[step] ?? "")}
                onChange={(e) => setAnswers((a) => Object.assign([...a], { [step]: e.target.value }))}
                maxLength={200}
                placeholder="Or say it in your own words"
                aria-label="Your own answer"
                className="rounded-xl border border-line bg-card px-4 py-3 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </fieldset>
        ) : step === questions.length ? (
          <div>
            <fieldset>
              <legend className="font-display text-xl font-semibold">How should we teach it?</legend>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {TONES.map((t) => (
                  <Chip key={t.id} selected={tone === t.label} onClick={() => setTone(t.label)}>
                    {t.label}
                  </Chip>
                ))}
                <Chip selected={tone === "custom"} onClick={() => setTone("custom")}>
                  Something else
                </Chip>
              </div>
              {tone === "custom" && (
                <input
                  autoFocus
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Like a witty podcast host, with cooking analogies"
                  aria-label="Custom teaching style"
                  className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm focus:border-brand focus:outline-none"
                />
              )}
            </fieldset>
            <label className="mt-6 block">
              <span className="text-sm font-medium">What do you already know about this? (optional)</span>
              <textarea
                value={prior}
                onChange={(e) => setPrior(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="e.g. I've watched a couple of videos but never practised"
                className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm focus:border-brand focus:outline-none"
              />
            </label>
          </div>
        ) : (
          <fieldset>
            <legend className="font-display text-xl font-semibold">How long should the course be?</legend>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(Object.keys(LENGTHS) as LengthPreset[]).map((k) => (
                <Chip key={k} selected={length === k} onClick={() => setLength(k)}>
                  <span className="font-medium">{LENGTHS[k].label}</span>
                  <span className="block text-xs text-muted">
                    {LENGTHS[k].hint} · {LENGTHS[k].lessons} lesson{LENGTHS[k].lessons > 1 ? "s" : ""}
                  </span>
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
      </Card>

      <div className="mt-4">
        <ErrorNote message={error} onRetry={generate} />
      </div>
      <div className="mt-4 flex justify-between">
        <button className={btn.ghost} onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}>
          ← Back
        </button>
        <button className={btn.primary} disabled={!canNext} onClick={() => (isLast ? generate() : setStep(step + 1))}>
          {isLast ? "Build my course" : "Continue"}
        </button>
      </div>
    </div>
  );
}

export default function NewCoursePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Wizard />
    </Suspense>
  );
}
