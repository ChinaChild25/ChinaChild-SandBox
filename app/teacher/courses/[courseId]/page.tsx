"use client"

import { useParams } from "next/navigation"
import { CourseDetailContent } from "@/components/courses/course-detail-content"

export default function TeacherCourseDetailsPage() {
  const params = useParams<{ courseId: string }>()
  return (
    <CourseDetailContent
      courseId={params.courseId}
      coursesListHref="/teacher/courses"
      progressHref="/teacher/progress"
    />
  )
}
