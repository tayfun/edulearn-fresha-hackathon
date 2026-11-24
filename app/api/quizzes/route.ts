import { z } from "zod";
import { body, route } from "@/lib/http";
import { createQuiz } from "@/lib/quiz";

export const maxDuration = 300;

const Input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lesson"), lessonId: z.number().int().positive(), fresh: z.boolean().optional() }),
  z.object({ kind: z.literal("practice"), courseId: z.number().int().positive() }),
]);

export const POST = route(async (req) => ({ id: await createQuiz(await body(req, Input)) }));
