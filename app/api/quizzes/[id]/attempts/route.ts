import { z } from "zod";
import { body, route } from "@/lib/http";
import { submitAttempt } from "@/lib/quiz";

export const maxDuration = 300;

export const POST = route(async (req, { id }) => {
  const { responses } = await body(req, z.object({ responses: z.record(z.string(), z.string()) }));
  return submitAttempt(id, responses);
});
