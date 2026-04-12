"use client"

import { ClassesPageContent } from "@/components/classes/classes-page-content"

export default function ClassesPage() {
  return (
    <ClassesPageContent
      scheduleFallbackHref="/schedule"
      title="Занятия"
      subtitle="Все ваши занятия в одном месте"
    />
  )
}
