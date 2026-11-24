import { z } from "zod";
import { NotFound } from "@/lib/courses";
import { body, route } from "@/lib/http";
import { reviewFlashcard } from "@/lib/review";

export const POST = route(async (req, { id }) => {
  const { knewIt } = await body(req, z.object({ knewIt: z.boolean() }));
  const next = reviewFlashcard(id, knewIt);
  if (!next) throw new NotFound("Flashcard not found");
  return next;
});
