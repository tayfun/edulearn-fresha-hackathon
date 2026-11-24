import { route } from "@/lib/http";
import { deleteFlashcard } from "@/lib/review";

export const DELETE = route((_req, { id }) => deleteFlashcard(id));
