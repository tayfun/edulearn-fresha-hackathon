"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** JSON fetch that throws the server's error message. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

/** POST and read a streamed text reply, reporting the text so far on every chunk. */
export async function streamText(url: string, body: unknown, onText: (full: string) => void): Promise<string> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  return full;
}

/** Load data on mount; returns state plus a reload function. */
export function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    if (!url) return Promise.resolve();
    return api<T>(url).then(
      (d) => {
        setData(d);
        setError("");
      },
      (e) => setError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, [url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, setData, error, reload };
}

const btnBase = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
export const btn = {
  primary: `${btnBase} bg-brand font-semibold text-on-brand hover:bg-brand-dark`,
  secondary: `${btnBase} border border-line bg-card text-ink hover:border-brand hover:text-brand-dark`,
  ghost: `${btnBase} text-muted hover:text-ink hover:bg-white/5`,
};

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function ProgressBar({ value, tone = "brand", label }: { value: number; tone?: "brand" | "warn" | "bad" | "good"; label?: string }) {
  const color = { brand: "bg-brand", warn: "bg-warn", bad: "bg-bad", good: "bg-good" }[tone];
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Dots() {
  return (
    <span className="dots inline-flex gap-1" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 justify-center text-muted" role="status">
      <Dots /> <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Markdown({ children, small = false }: { children: string; small?: boolean }) {
  return (
    <div className={`prose ${small ? "prose-sm" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-ink hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="text-ink">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function masteryTone(m: number | null): "bad" | "warn" | "good" {
  if (m === null || m < 0.4) return "bad";
  return m < 0.6 ? "warn" : "good";
}

export function ResourceList({ resources }: { resources: { id: number; title: string; url: string; snippet?: string }[] }) {
  if (!resources.length) return null;
  return (
    <ul className="space-y-2">
      {resources.map((r) => (
        <li key={r.id} className="text-sm">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-dark hover:underline">
            {r.title} ↗
          </a>
          <div className="truncate text-xs text-muted">{new URL(r.url).hostname.replace(/^www\./, "")}</div>
        </li>
      ))}
    </ul>
  );
}
