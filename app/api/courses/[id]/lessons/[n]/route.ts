import { getLessonDetail, lessonIdByNumber } from "@/lib/courses";
import { route } from "@/lib/http";

/** A lesson addressed the way its page is: by course and its number within the course. */
export const GET = route((_req, { id, n }) => getLessonDetail(lessonIdByNumber(id, n)));
