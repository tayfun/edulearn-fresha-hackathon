"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Card, Dots, ErrorNote, Loading, ProgressBar, api, btn } from "@/components/ui";
import { LENGTHS, LengthPreset, TONES } from "@/lib/logic";

type Question = { question: string; options: string[] };

type Check = { id: number; questions: { prompt: string; options: string[]; level: string }[] };

const STAGES = [
  "Working out what you need to study",
  "Searching the web for the best material",
  "Designing your modules and lessons",
  "Picking the concepts to track",
  "Collecting resources for each module",
];

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
  // Agent step 1: an optional diagnostic, fetched when the learner reaches the last step.
  const [check, setCheck] = useState<Check | null>(null);
  const [checkState, setCheckState] = useState<"idle" | "loading" | "failed">("idle");
  const [checkAnswers, setCheckAnswers] = useState<number[]>([]);

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

  const total = questions.length + 3;
  const isLast = step === total - 1;
  const toneValue = tone === "custom" ? customTone.trim() : tone;
  const canNext = step < questions.length ? !!answers[step]?.trim() : step === questions.length ? toneValue.length >= 2 : true;

  function loadCheck() {
    setCheckState("loading");
    const goal = questions!.map((q, i) => `${q.question} ${answers[i]}`).join(" | ");
    api<Check>("/api/assess", { body: { topic, goal, tone: toneValue } }).then(
      (c) => {
        setCheck(c);
        setCheckState("idle");
      },
      () => setCheckState("failed"),
    );
  }

  async function generate(skipCheck = false) {
    setGenerating(true);
    setStage(0);
    setError("");
    try {
      const goal = questions!.map((q, i) => `${q.question} ${answers[i]}`).join(" | ");
      const assessment = check && !skipCheck ? { id: check.id, answers: check.questions.map((_, i) => checkAnswers[i] ?? -1) } : undefined;
      const { slug } = await api<{ slug: string }>("/api/courses", { body: { topic, goal, priorKnowledge: prior, tone: toneValue, length, assessment } });
      router.push(`/courses/${slug}`);
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
        ) : step === questions.length + 2 ? (
          <div>
            <h2 className="font-display text-xl font-semibold">Quick check: what do you already know?</h2>
            <p className="mt-1 text-sm text-muted">
              Five questions, easy to hard. Your answers decide what the course skips and what it spends time on. Guessing hides gaps, so pick &quot;I don&apos;t know&quot; when you don&apos;t.
            </p>
            {checkState === "loading" && <Loading label="Writing your knowledge check" />}
            {checkState === "failed" && (
              <div className="mt-4">
                <ErrorNote message="The knowledge check could not be written. You can retry or build the course without it." onRetry={loadCheck} />
              </div>
            )}
            {check && (
              <ol className="mt-5 space-y-6">
                {check.questions.map((q, qi) => (
                  <li key={qi}>
                    <fieldset>
                      <legend className="text-sm font-medium">
                        {qi + 1}. {q.prompt}
                      </legend>
                      <div className="mt-2 grid gap-1.5">
                        {[...q.options, "I don't know"].map((o, oi) => {
                          const value = oi === q.options.length ? -1 : oi;
                          const checked = checkAnswers[qi] === value;
                          return (
                            <label
                              key={oi}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition ${checked ? "border-brand bg-brand-soft" : "border-line hover:border-brand"} ${value === -1 ? "text-muted" : ""}`}
                            >
                              <input
                                type="radio"
                                name={`check${qi}`}
                                checked={checked}
                                onChange={() => setCheckAnswers((a) => Object.assign([...a], { [qi]: value }))}
                                className="mt-1 accent-[var(--color-brand)]"
                              />
                              <span>{o}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ol>
            )}
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
        <ErrorNote message={error} onRetry={() => generate()} />
      </div>
      <div className="mt-4 flex justify-between">
        <button className={btn.ghost} onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}>
          ← Back
        </button>
        <span className="flex flex-wrap justify-end gap-2">
          {isLast && (
            <button className={btn.ghost} onClick={() => generate(true)}>
              Skip the check
            </button>
          )}
          <button
            className={btn.primary}
            disabled={isLast ? !check || checkAnswers.filter((a) => a !== undefined).length < check.questions.length : !canNext}
            onClick={() => {
              if (isLast) return void generate();
              if (step === total - 2 && !check && checkState !== "loading") loadCheck();
              setStep(step + 1);
            }}
          >
            {isLast ? "Build my course" : "Continue"}
          </button>
        </span>
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
