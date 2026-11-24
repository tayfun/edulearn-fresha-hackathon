import { z } from "zod";
import { createAssessment } from "@/lib/agent";
import { body, route } from "@/lib/http";

export const maxDuration = 300;

/** Agent step 1: a short diagnostic for the topic. Correct answers are not sent to the browser. */
export const POST = route(async (req) =>
  createAssessment(await body(req, z.object({ topic: z.string().trim().min(2).max(300), goal: z.string().trim().max(1500).default(""), tone: z.string().trim().min(2).max(300) }))),
);
