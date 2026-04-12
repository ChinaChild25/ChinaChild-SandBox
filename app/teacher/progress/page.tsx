"use client"

import { ProgressPageContent } from "@/components/progress/progress-page-content"

export default function TeacherProgressPage() {
  return (
    <ProgressPageContent
      settingsHref="/teacher/settings"
      title="Оценки и работы"
      subtitle="Сводка по демо-группе (как в журнале ученика)"
    />
  )
}
