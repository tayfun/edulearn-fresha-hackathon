import { z } from "zod";
import { saveTutorReply, tutorStream } from "@/lib/courses";
import { body, route } from "@/lib/http";
import { streamResponse } from "@/lib/llm";

export const maxDuration = 300;

export const POST = route(async (req, { id }) => {
  const { message } = await body(req, z.object({ message: z.string().trim().min(1).max(2000) }));
  return streamResponse(tutorStream(id, message), (full) => saveTutorReply(id, full));
});
