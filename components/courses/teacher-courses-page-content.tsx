"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { TeacherCustomCourse } from "@/lib/types"
import { courseCatalog } from "@/lib/course-catalog"
import { CreateCourseCard } from "@/components/courses/create-course-card"
import { CreateCourseModal } from "@/components/courses/create-course-modal"
import { PlatformCourseCard } from "@/components/courses/platform-course-card"
import { TeacherCourseCard } from "@/components/courses/teacher-course-card"

export function TeacherCoursesPageContent() {
  const router = useRouter()
  const [customCourses, setCustomCourses] = useState<TeacherCustomCourse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    void fetchCourses()
  }, [])

  async function fetchCourses() {
    setIsLoading(true)
    setError(null)
    const res = await fetch("/api/teacher/courses", { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as
      | { custom?: TeacherCustomCourse[]; error?: string }
      | null
    if (!res.ok) {
      setError(json?.error ?? "Не удалось загрузить курсы")
      setIsLoading(false)
      return
    }
    setCustomCourses(json?.custom ?? [])
    setIsLoading(false)
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-8">
          <h1 className="text-[length:var(--ds-text-8xl)] font-bold leading-none text-ds-text-primary">Мои курсы</h1>
          <p className="mt-1 text-ds-body text-ds-text-secondary">
            Платформенные курсы HSK и ваши авторские курсы в едином каталоге.
          </p>
        </header>

        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <div className="ds-course-grid items-stretch">
          {courseCatalog.map((course) => (
            <PlatformCourseCard key={course.id} course={course} />
          ))}

          {customCourses.map((course) => (
            <TeacherCourseCard key={course.id} course={course} />
          ))}

          <CreateCourseCard onClick={() => setIsModalOpen(true)} />

          {isLoading ? (
            <div className="rounded-[var(--ds-radius-xl)] bg-ds-surface-muted p-6 text-sm text-ds-text-secondary">
              Загрузка курсов...
            </div>
          ) : null}
        </div>
      </div>

      <CreateCourseModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCreated={(course) => router.push(`/teacher/courses/${course.id}`)}
      />
    </div>
  )
}
