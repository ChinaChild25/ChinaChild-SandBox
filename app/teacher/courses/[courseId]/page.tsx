"use client"

import { useParams } from "next/navigation"
import { TeacherCourseBuilderContent } from "@/components/courses/teacher-course-builder-content"

export default function TeacherCourseDetailsPage() {
  const params = useParams<{ courseId: string }>()
  return <TeacherCourseBuilderContent courseId={params.courseId} />
}
