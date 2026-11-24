import OpenAI from "openai";
import { z } from "zod";

export const MODELS = {
  strong: process.env.LLM_MODEL_STRONG || "openai/gpt-oss-120b",
  fast: process.env.LLM_MODEL_FAST || "openai/gpt-oss-120b",
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
  schema: z.ZodType<T>;
  messages: Msg[];
  model?: keyof typeof MODELS;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const messages = [...opts.messages];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().chat.completions.create({
      model: MODELS[opts.model ?? "fast"],
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 8000,
      response_format: { type: "json_object" },
    });
    const text = res.choices[0]?.message?.content ?? "";
    try {
      return opts.schema.parse(extractJson(text));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
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

/** Stream plain text; yields content deltas. */
export async function* chatStream(opts: {
  messages: Msg[];
  model?: keyof typeof MODELS;
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const stream = await getClient().chat.completions.create({
    model: MODELS[opts.model ?? "fast"],
    messages: opts.messages,
    temperature: opts.temperature ?? 0.5,
    max_tokens: opts.maxTokens ?? 6000,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

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
