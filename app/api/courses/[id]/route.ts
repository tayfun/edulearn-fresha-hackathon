import { deleteCourse, getCourseDetail } from "@/lib/courses";
import { route } from "@/lib/http";
import { touchSession } from "@/lib/session";

export const GET = route((_req, { id }) => {
  const detail = getCourseDetail(id);
  touchSession(id);
  return detail;
});
export const DELETE = route((_req, { id }) => deleteCourse(id));
