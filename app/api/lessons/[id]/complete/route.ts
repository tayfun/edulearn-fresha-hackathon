import { z } from "zod";
import { setLessonCompleted } from "@/lib/courses";
import { body, route } from "@/lib/http";

export const POST = route(async (req, { id }) => {
  const { completed } = await body(req, z.object({ completed: z.boolean().default(true) }));
  setLessonCompleted(id, completed);
});
