import { route } from "@/lib/http";
import { getAttempt } from "@/lib/quiz";

export const GET = route((_req, { id }) => getAttempt(id));
