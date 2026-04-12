"use client"

import { CoursesPageContent } from "@/components/courses/courses-page-content"

export default function TeacherCoursesPage() {
  return (
    <CoursesPageContent
      coursesBasePath="/teacher/courses"
      title="Курсы HSK"
      subtitle="Те же программы HSK 1 и HSK 2, по которым вы ведёте занятия"
      activitySectionTitle="Активность группы (демо)"
    />
  )
}
