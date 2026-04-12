"use client"

import { CoursesPageContent } from "@/components/courses/courses-page-content"

export default function CoursesPage() {
  return (
    <CoursesPageContent
      coursesBasePath="/courses"
      title="Мои курсы"
      subtitle="Выберите курс для продолжения обучения"
    />
  )
}
