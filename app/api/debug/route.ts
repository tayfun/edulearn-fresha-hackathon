import { route } from "@/lib/http";
import { MODELS } from "@/lib/llm";
import { clearTrace, getTrace } from "@/lib/trace";

/** Activity log for the debug panel. */
export const GET = route(() => ({ events: getTrace(), models: MODELS }));
export const DELETE = route(() => clearTrace());
