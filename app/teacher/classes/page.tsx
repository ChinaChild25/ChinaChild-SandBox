"use client"

import { ClassesPageContent } from "@/components/classes/classes-page-content"

export default function TeacherClassesPage() {
  return (
    <ClassesPageContent
      scheduleFallbackHref="/teacher/schedule"
      title="Занятия"
      subtitle="Расписание и материалы уроков так же, как видит ученик"
    />
  )
}
