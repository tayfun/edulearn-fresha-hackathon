"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorNote, Loading, useLoad } from "@/components/ui";

/** Old lesson addresses (/lessons/17) forward to /courses/<course>/<lesson number>. */
export default function OldLessonLink() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useLoad<{ course: { slug: string }; index: number }>(`/api/lessons/${id}`);
  useEffect(() => {
    if (data) router.replace(`/courses/${data.course.slug}/${data.index}`);
  }, [data, router]);
  return error ? <ErrorNote message={error} /> : <Loading label="Opening the lesson" />;
}
