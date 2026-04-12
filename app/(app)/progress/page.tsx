"use client"

import { ProgressPageContent } from "@/components/progress/progress-page-content"

export default function ProgressPage() {
  return (
    <ProgressPageContent
      settingsHref="/settings"
      title="Мои оценки"
      subtitle="История оценок и прогресс обучения"
    />
  )
}
