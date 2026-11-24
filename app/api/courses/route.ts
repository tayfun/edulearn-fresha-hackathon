import { z } from "zod";
import { createCourse, listCourses } from "@/lib/courses";
import { body, route } from "@/lib/http";
import { LENGTHS, LengthPreset } from "@/lib/logic";

export const maxDuration = 300;

export const GET = route(() => ({ courses: listCourses() }));

const Input = z.object({
  topic: z.string().trim().min(2).max(300),
  goal: z.string().trim().max(1500).default(""),
  priorKnowledge: z.string().trim().max(1000).default(""),
  tone: z.string().trim().min(2).max(300),
  length: z.enum(Object.keys(LENGTHS) as [LengthPreset, ...LengthPreset[]]),
});

export const POST = route(async (req) => ({ id: await createCourse(await body(req, Input)) }));
