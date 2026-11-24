import { route } from "@/lib/http";
import { getQuiz } from "@/lib/quiz";

export const GET = route((_req, { id }) => getQuiz(id));
