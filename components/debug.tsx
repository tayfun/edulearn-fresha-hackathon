"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Dots } from "./ui";

type TraceEvent = {
  id: number; at: number; kind: "llm" | "search" | "db"; label: string; status: "running" | "ok" | "error";
  ms?: number; summary?: string; detail?: Record<string, string | number>;
};

const KEY = "edulearn-debug";
const CHANGE = "edulearn-debug-change";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}
function readEnabled() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function writeEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable: the toggle still works for this page view */
  }
  window.dispatchEvent(new Event(CHANGE));
}

const KIND = {
  llm: { tag: "MODEL", cls: "bg-violet-500/20 text-violet-200" },
  search: { tag: "SEARCH", cls: "bg-sky-500/20 text-sky-200" },
  db: { tag: "DB", cls: "bg-emerald-500/20 text-emerald-200" },
} as const;

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour12: false });
const duration = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

function Panel() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [models, setModels] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    let live = true;
    const poll = () =>
      fetch("/api/debug")
        .then((r) => r.json())
        .then((d: { events: TraceEvent[]; models: Record<string, string> }) => {
          if (!live) return;
          setEvents(d.events);
          setModels(d.models);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    poll();
    const timer = setInterval(poll, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  // Keep the page content clear of the panel.
  useEffect(() => {
    document.body.style.paddingBottom = collapsed ? "2.75rem" : "42vh";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [collapsed]);

  // Follow new activity unless the reader has scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  const running = events.filter((e) => e.status === "running").length;

  return (
    <section aria-label="Debug activity" className="fixed inset-x-0 bottom-0 z-30 border-t border-black bg-[#17140f] font-mono text-xs text-stone-200 shadow-2xl">
      <div className="flex h-11 items-center gap-3 px-4">
        <span className="font-semibold text-white">Debug</span>
        <span className="flex min-w-0 items-center gap-2 truncate text-stone-400">
          {running > 0 ? (
            <>
              <Dots /> {running} running
            </>
          ) : (
            `${events.length} event${events.length === 1 ? "" : "s"}`
          )}
          {failed && <span className="text-red-300">· cannot reach the server</span>}
          {models.fast && <span className="hidden truncate sm:inline">· model {models.fast}</span>}
        </span>
        <span className="ml-auto flex shrink-0 gap-1">
          <button className="rounded px-2 py-1 text-stone-300 hover:bg-white/10" onClick={() => fetch("/api/debug", { method: "DELETE" }).then(() => setEvents([]))}>
            Clear
          </button>
          <button className="rounded px-2 py-1 text-stone-300 hover:bg-white/10" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button className="rounded px-2 py-1 text-stone-300 hover:bg-white/10" onClick={() => writeEnabled(false)}>
            Close
          </button>
        </span>
      </div>
      {!collapsed && (
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="h-[calc(42vh-2.75rem)] overflow-y-auto border-t border-white/10 px-2 py-1"
        >
          {events.length === 0 && (
            <p className="px-2 py-3 text-stone-400">Nothing yet. Build a course, open a lesson or take a quiz and every model call, web search and database write will show up here.</p>
          )}
          {events.map((e) => (
            <details key={e.id} className="group rounded px-2 py-1 hover:bg-white/5">
              <summary className="flex cursor-pointer list-none items-baseline gap-2">
                <span className="shrink-0 text-stone-500">{time(e.at)}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND[e.kind].cls}`}>{KIND[e.kind].tag}</span>
                <span className="min-w-0 flex-1">
                  <span className={e.status === "error" ? "text-red-300" : "text-white"}>{e.label}</span>
                  {e.summary && <span className="text-stone-400"> — {e.summary}</span>}
                </span>
                <span className={`shrink-0 ${e.status === "error" ? "text-red-300" : e.status === "running" ? "text-amber-300" : "text-stone-400"}`}>
                  {e.status === "running" ? <Dots /> : e.status === "error" ? `failed${e.ms !== undefined ? ` · ${duration(e.ms)}` : ""}` : duration(e.ms ?? 0)}
                </span>
              </summary>
              {e.detail &&
                Object.entries(e.detail).map(([k, v]) => (
                  <div key={k} className="mt-1 ml-[4.5rem]">
                    <div className="text-[10px] uppercase tracking-wide text-stone-500">{k.replace(/_/g, " ")}</div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-stone-300">{String(v)}</pre>
                  </div>
                ))}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

/** Header switch plus the activity panel it opens. The choice is remembered in this browser. */
export function DebugToggle() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => false);
  return (
    <>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => writeEnabled(!enabled)}
        title="Show what the app is doing behind the scenes"
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${enabled ? "border-brand bg-brand-soft text-brand-dark" : "border-line text-muted hover:text-ink"}`}
      >
        <span className={`h-2 w-2 rounded-full ${enabled ? "bg-brand" : "bg-line"}`} aria-hidden />
        Debug
      </button>
      {enabled && createPortal(<Panel />, document.body)}
    </>
  );
}
