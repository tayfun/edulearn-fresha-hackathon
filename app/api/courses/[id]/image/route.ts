import { ensureCourseImage } from "@/lib/courses";
import { route } from "@/lib/http";

export const maxDuration = 300;

/** Draws the course illustration if it does not exist yet. `image` is null when drawing failed. */
export const POST = route(async (_req, { id }) => ({ image: await ensureCourseImage(id) }));
