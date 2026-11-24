import { z } from "zod";
import { intakeQuestions } from "@/lib/courses";
import { body, route } from "@/lib/http";

export const POST = route(async (req) => {
  const { topic } = await body(req, z.object({ topic: z.string().trim().min(2).max(300) }));
  return { questions: await intakeQuestions(topic) };
});
