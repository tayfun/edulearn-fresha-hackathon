import { route } from "@/lib/http";
import { generateFlashcards, getFlashcards } from "@/lib/review";

export const maxDuration = 300;

export const GET = route((_req, { id }) => getFlashcards(id));
export const POST = route(async (_req, { id }) => {
  const created = await generateFlashcards(id);
  return { created, ...getFlashcards(id) };
});
