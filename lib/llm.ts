import OpenAI from "openai";
import { z } from "zod";
import { traceStart } from "./trace";

export const MODELS = {
  strong: process.env.LLM_MODEL_STRONG || "openai/gpt-oss-120b",
  fast: process.env.LLM_MODEL_FAST || "openai/gpt-oss-120b",
  /** Draws the course illustration; a reasoning model draws noticeably better line art. */
  image: process.env.LLM_MODEL_IMAGE || "moonshotai/Kimi-K3.1-Pro",
  lesson: process.env.LLM_MODEL_LESSON || process.env.LLM_MODEL_FAST || "openai/gpt-oss-120b",
};

let client: OpenAI | null = null;
function getClient() {
  if (!process.env.NEBIUS_API_KEY) throw new Error("NEBIUS_API_KEY is not set");
  client ??= new OpenAI({
    apiKey: process.env.NEBIUS_API_KEY,
    baseURL: process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1/",
    timeout: 180_000,
  });
  return client;
}

export type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Pull the first JSON object out of a model reply (handles code fences and stray prose). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Ask for a JSON object and validate it. On a parse or schema failure the
 * error is fed back to the model once before giving up.
 */
export async function chatJson<T>(opts: {
  /** Shown in the debug panel. */
  label: string;
  schema: z.ZodType<T>;
  messages: Msg[];
  model?: keyof typeof MODELS;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const messages = [...opts.messages];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = MODELS[opts.model ?? "fast"];
    const done = traceStart("llm", attempt === 0 ? opts.label : `${opts.label} (retry after invalid reply)`, { model, prompt: promptText(messages) });
    let text = "";
    let usage = "";
    try {
      const res = await getClient().chat.completions.create({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 8000,
        response_format: { type: "json_object" },
      });
      text = res.choices[0]?.message?.content ?? "";
      usage = res.usage ? `${res.usage.prompt_tokens} tokens in, ${res.usage.completion_tokens} out` : "";
    } catch (err) {
      done("error", err instanceof Error ? err.message : String(err));
      throw err;
    }
    try {
      const parsed = opts.schema.parse(extractJson(text));
      done("ok", [model, usage, "valid JSON"].filter(Boolean).join(" · "), { response: text });
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      done("error", `${model} · reply failed validation: ${lastError.slice(0, 200)}`, { response: text });
      messages.push(
        { role: "assistant", content: text },
        {
          role: "user",
          content: `That reply was not valid for the required JSON shape: ${lastError.slice(0, 1500)}\nReply again with only the corrected JSON object.`,
        },
      );
    }
  }
  throw new Error(`The model did not return valid JSON: ${lastError.slice(0, 300)}`);
}

/** One plain-text completion. */
export async function chatText(opts: { label: string; messages: Msg[]; model?: keyof typeof MODELS; temperature?: number; maxTokens?: number }): Promise<string> {
  const model = MODELS[opts.model ?? "fast"];
  const done = traceStart("llm", opts.label, { model, prompt: promptText(opts.messages) });
  try {
    const res = await getClient().chat.completions.create({ model, messages: opts.messages, temperature: opts.temperature ?? 0.6, max_tokens: opts.maxTokens ?? 6000 });
    const text = res.choices[0]?.message?.content ?? "";
    done("ok", `${model} · ${res.usage ? `${res.usage.prompt_tokens} tokens in, ${res.usage.completion_tokens} out` : `${text.length} characters`}`, { response: text });
    return text;
  } catch (err) {
    done("error", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/** Stream plain text; yields content deltas. */
export async function* chatStream(opts: {
  /** Shown in the debug panel. */
  label: string;
  messages: Msg[];
  model?: keyof typeof MODELS;
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const model = MODELS[opts.model ?? "fast"];
  const done = traceStart("llm", opts.label, { model, prompt: promptText(opts.messages) });
  let full = "";
  let finished = false;
  try {
    const stream = await getClient().chat.completions.create({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 6000,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        full += delta;
        yield delta;
      }
    }
    finished = true;
    done("ok", `${model} · streamed ${full.length} characters`, { response: full });
  } catch (err) {
    finished = true;
    done("error", err instanceof Error ? err.message : String(err), { response: full });
    throw err;
  } finally {
    // The reader went away (page closed) before the stream ended.
    if (!finished) done("error", `${model} · stopped early after ${full.length} characters`, { response: full });
  }
}

const promptText = (messages: Msg[]) => messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");

/** Turn a text generator into a streamed HTTP response, calling onDone with the full text. */
export function streamResponse(gen: AsyncGenerator<string>, onDone?: (full: string) => void) {
  const encoder = new TextEncoder();
  let full = "";
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of gen) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
        if (full.trim()) onDone?.(full);
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
