import { getLessonRow, lessonContentStream, saveLessonContent } from "@/lib/courses";
import { route } from "@/lib/http";
import { streamResponse } from "@/lib/llm";

export const maxDuration = 300;

/** Streams the lesson text. Content is generated once and then served from the database. */
export const POST = route((_req, { id }) => {
  const lesson = getLessonRow(id);
  if (lesson.content) return new Response(lesson.content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return streamResponse(lessonContentStream(id), (full) => saveLessonContent(id, full));
});
