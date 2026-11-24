// In-memory activity log behind the debug panel: every model call, web search
// and database write the server makes on the learner's behalf.

export type TraceKind = "llm" | "search" | "db";
export type TraceEvent = {
  id: number;
  at: number;
  kind: TraceKind;
  label: string;
  status: "running" | "ok" | "error";
  ms?: number;
  summary?: string;
  detail?: Record<string, unknown>;
};

const MAX_EVENTS = 300;
const store = globalThis as unknown as { __edulearnTrace?: { events: TraceEvent[]; nextId: number } };
const state = (store.__edulearnTrace ??= { events: [], nextId: 1 });

const clip = (v: unknown, max = 6000) => {
  const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more characters)` : s;
};

function toConsole(e: TraceEvent) {
  if (process.env.EDULEARN_DEBUG !== "1" || e.status === "running") return;
  console.log(`[edulearn] ${e.kind.padEnd(6)} ${e.status.padEnd(5)} ${e.ms !== undefined ? `${e.ms}ms `.padStart(9) : ""}${e.label}${e.summary ? ` — ${e.summary}` : ""}`);
}

/** Record the start of an operation; call the returned function when it finishes. */
export function traceStart(kind: TraceKind, label: string, detail?: Record<string, unknown>) {
  const event: TraceEvent = { id: state.nextId++, at: Date.now(), kind, label, status: "running", detail: detail && clipAll(detail) };
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  return (status: "ok" | "error", summary?: string, more?: Record<string, unknown>) => {
    event.status = status;
    event.ms = Date.now() - event.at;
    event.summary = summary;
    if (more) event.detail = { ...event.detail, ...clipAll(more) };
    toConsole(event);
  };
}

/** Record something that already happened. */
export function traceNote(kind: TraceKind, label: string, summary?: string, detail?: Record<string, unknown>) {
  traceStart(kind, label, detail)("ok", summary);
}

function clipAll(detail: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, typeof v === "number" ? v : clip(v)]));
}

export function getTrace() {
  return state.events;
}

export function clearTrace() {
  state.events.length = 0;
}
