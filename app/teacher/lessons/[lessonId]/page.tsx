"use client"

import { useParams } from "next/navigation"
import { LessonEditor } from "@/components/lesson-builder/lesson-editor"

export default function TeacherLessonEditorPage() {
  const params = useParams<{ lessonId: string }>()
  return <LessonEditor lessonId={params.lessonId} />
}
