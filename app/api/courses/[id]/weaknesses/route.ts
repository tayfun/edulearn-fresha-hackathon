import { route } from "@/lib/http";
import { getWeaknesses } from "@/lib/review";

export const GET = route((_req, { id }) => getWeaknesses(id));
