import { z } from "zod";
import { NotFound } from "./courses";
import { getDb } from "./db";

type Ctx = { params: Promise<Record<string, string>> };

/** Wrap a route handler: resolves ids (numeric, or a course slug) and turns thrown errors into JSON responses. */
export function route(fn: (req: Request, ids: Record<string, number>) => Promise<Response | unknown> | Response | unknown) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const raw = (await ctx.params) ?? {};
      const ids: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        const n = Number(v);
        if (Number.isInteger(n) && n > 0) {
          ids[k] = n;
          continue;
        }
        // Anything else is a course slug, e.g. /api/courses/black-holes-made-simple
        const course = getDb().prepare("SELECT id FROM courses WHERE slug = ?").get(decodeURIComponent(v)) as { id: number } | undefined;
        if (!course) throw new NotFound("Not found");
        ids[k] = course.id;
      }
      const out = await fn(req, ids);
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof NotFound) return Response.json({ error: err.message }, { status: 404 });
      if (err instanceof z.ZodError) return Response.json({ error: "Invalid request: " + err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") }, { status: 400 });
      console.error(err);
      const message = err instanceof Error ? err.message : "Something went wrong";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    /* empty body */
  }
  return schema.parse(json);
}
