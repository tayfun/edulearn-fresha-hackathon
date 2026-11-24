import { route } from "@/lib/http";
import { generateRecommendations, getWeaknesses } from "@/lib/review";

export const maxDuration = 300;

export const POST = route(async (_req, { id }) => {
  await generateRecommendations(id);
  return getWeaknesses(id);
});
