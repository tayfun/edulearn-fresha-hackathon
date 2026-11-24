import { getLessonDetail } from "@/lib/courses";
import { route } from "@/lib/http";

export const GET = route((_req, { id }) => getLessonDetail(id));
