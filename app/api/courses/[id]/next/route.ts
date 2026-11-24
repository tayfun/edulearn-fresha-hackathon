import { decideNextActivity } from "@/lib/agent";
import { route } from "@/lib/http";

export const maxDuration = 300;

/** Agent step 8: what the learner should do next, with the reason. */
export const GET = route((_req, { id }) => decideNextActivity(id));
