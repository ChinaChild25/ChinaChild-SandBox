"use client"

import { useParams } from "next/navigation"
import { CourseDetailContent } from "@/components/courses/course-detail-content"
import { StudentAssignedCourseContent } from "@/components/courses/student-assigned-course-content"

function isCatalogCourseId(id: string | undefined): id is "hsk1" | "hsk2" {
  return id === "hsk1" || id === "hsk2"
}

export default function CourseDetailsPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId

  if (!isCatalogCourseId(courseId)) {
    return <StudentAssignedCourseContent courseId={courseId} coursesListHref="/courses" />
  }

  return (
    <CourseDetailContent courseId={courseId} coursesListHref="/courses" progressHref="/progress" />
  )
}
