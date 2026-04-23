"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react"
import type { TeacherCourseModule, TeacherLesson } from "@/lib/types"
import { courseCoverFromCourse } from "@/lib/teacher-custom-course-form"

type CourseRow = {
  id: string
  title: string
  description: string | null
  level: string | null
  cover_color: string | null
  cover_style: string | null
  cover_image_url: string | null
  cover_image_position: string | null
}

export function StudentAssignedCourseContent({
  courseId,
  coursesListHref
}: {
  courseId: string | undefined
  coursesListHref: "/courses" | "/teacher/courses"
}) {
  const [course, setCourse] = useState<CourseRow | null>(null)
  const [lessons, setLessons] = useState<TeacherLesson[]>([])
  const [modules, setModules] = useState<TeacherCourseModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) {
      setLoading(false)
      setError("Курс не указан")
      return
    }
    void load()
  }, [courseId])

  async function load() {
    if (!courseId) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/student/courses/${courseId}`, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as
      | {
          course?: CourseRow
          lessons?: TeacherLesson[]
          modules?: TeacherCourseModule[]
          error?: string
        }
      | null
    if (!res.ok || !json?.course) {
      setError(json?.error ?? "Не удалось загрузить курс")
      setCourse(null)
      setLessons([])
      setModules([])
      setLoading(false)
      return
    }
    setCourse(json.course)
    setLessons((json.lessons ?? []).slice().sort((a, b) => a.order - b.order))
    setModules((json.modules ?? []).slice().sort((a, b) => a.order - b.order))
    setLoading(false)
  }

  const lessonsByModule = useMemo(() => {
    const unassigned = lessons.filter((l) => !l.module_id)
    const byMod = new Map<string | null, TeacherLesson[]>()
    byMod.set(null, unassigned)
    for (const m of modules) {
      byMod.set(
        m.id,
        lessons.filter((l) => l.module_id === m.id).sort((a, b) => a.order - b.order)
      )
    }
    return byMod
  }, [lessons, modules])

  if (loading) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] text-sm text-ds-text-secondary">Загрузка курса…</div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto max-w-[var(--ds-shell-max-width)]">
          <section className="rounded-[var(--ds-radius-xl)] bg-ds-panel-muted px-7 py-6">
            <h1 className="text-[length:var(--ds-text-4xl)] font-semibold tracking-[-0.03em] text-ds-ink">
              {error ?? "Курс не найден"}
            </h1>
            <Link
              href={coursesListHref}
              className="mt-4 inline-flex rounded-[var(--ds-radius-md)] bg-ds-ink px-4 py-2 text-ds-body-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a] dark:hover:opacity-95"
            >
              Вернуться к курсам
            </Link>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-6">
        <Link
          href={coursesListHref}
          className="inline-flex items-center gap-1 text-sm text-ds-text-tertiary hover:text-ds-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Назад к курсам
        </Link>

        <header
          className="relative min-h-[200px] overflow-hidden rounded-[var(--ds-radius-xl)] p-6 text-inherit"
          style={courseCoverFromCourse(course)}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-[var(--ds-radius-xl)] bg-transparent dark:bg-black/50"
          />
          <div className="relative z-10 flex min-h-[168px] flex-col justify-between">
            <div>
              <h1 className="line-clamp-3 text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-ds-ink">
                {(course.title || "Курс").slice(0, 20)}
              </h1>
              {course.level ? (
                <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-ds-text-secondary">{course.level}</p>
              ) : null}
              <p className="mt-2 line-clamp-4 text-sm leading-snug text-ds-text-secondary">
                {course.description?.trim() ? course.description : "Материалы подготовил преподаватель."}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-[var(--ds-radius-xl)] border border-black/[0.06] bg-[var(--input-background)] p-5 dark:border-white/10">
          <h2 className="text-xl font-semibold text-ds-ink">Уроки</h2>
          <p className="mt-1 text-sm text-ds-text-secondary">Откройте урок, чтобы пройти задания.</p>
          <div className="mt-4 space-y-6">
            {modules.map((mod) => {
              const modLessons = lessonsByModule.get(mod.id) ?? []
              if (modLessons.length === 0) return null
              return (
                <div key={mod.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ds-text-tertiary">{mod.title}</p>
                  <ul className="space-y-2">
                    {modLessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/lesson/${lesson.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-ds-surface px-4 py-3 text-inherit no-underline transition-colors hover:bg-ds-surface-hover dark:border-white/10"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <PlayCircle className="h-5 w-5 shrink-0 text-ds-sage-strong" aria-hidden />
                            <span className="truncate font-medium text-ds-ink">{lesson.title}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ds-text-tertiary" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {(lessonsByModule.get(null) ?? []).length > 0 ? (
              <div>
                {modules.length > 0 ? (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ds-text-tertiary">Без раздела</p>
                ) : null}
                <ul className="space-y-2">
                  {(lessonsByModule.get(null) ?? []).map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-ds-surface px-4 py-3 text-inherit no-underline transition-colors hover:bg-ds-surface-hover dark:border-white/10"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PlayCircle className="h-5 w-5 shrink-0 text-ds-sage-strong" aria-hidden />
                          <span className="truncate font-medium text-ds-ink">{lesson.title}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ds-text-tertiary" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lessons.length === 0 ? (
              <p className="text-sm text-ds-text-secondary">Уроки ещё не добавлены.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
