"use client"

import Link from "next/link"
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  PlayCircle
} from "lucide-react"
import { courseCatalog, type CourseCatalog } from "@/lib/course-catalog"

function topicFlags(title: string, slug: string) {
  const isDiagnostic = slug === "hsk-1" || title.toLowerCase().includes("диагностическ")
  const isTest = title.includes("Варианты") || title.includes("варианты")
  return { isDiagnostic, isTest }
}

function lessonStates(courseId: CourseCatalog["id"], index: number) {
  if (courseId === "hsk1") {
    const done = index < 7
    const active = index === 7
    return { done, active }
  }
  const done = false
  const active = index === 0
  return { done, active }
}

function isRowLocked(i: number, topics: { done: boolean; active: boolean }[]): boolean {
  const topic = topics[i]
  if (!topic) return true
  if (topic.done || topic.active) return false
  if (i === 0) return false
  const prev = topics[i - 1]
  return !prev.done && !prev.active
}

export function CourseDetailContent({
  courseId,
  coursesListHref,
  progressHref
}: {
  courseId: string | undefined
  coursesListHref: "/courses" | "/teacher/courses"
  progressHref: "/progress" | "/teacher/progress"
}) {
  const course = courseCatalog.find((item) => item.id === courseId)

  if (!course || (course.id !== "hsk1" && course.id !== "hsk2")) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto max-w-[var(--ds-shell-max-width)]">
          <section className="rounded-[var(--ds-radius-xl)] bg-ds-panel-muted px-7 py-6">
            <h1 className="text-[length:var(--ds-text-4xl)] font-semibold tracking-[-0.03em] text-ds-ink">
              Курс не найден
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

  const isHsk1 = course.id === "hsk1"
  const bgColor = isHsk1 ? "var(--ds-sage)" : "var(--ds-pink)"
  const accentColor = isHsk1 ? "var(--ds-sage-strong)" : "var(--ds-pink-strong)"
  const titleLine = isHsk1 ? "HSK 1 — Базовый курс" : "HSK 2 — Элементарный курс"
  const subtitle = isHsk1 ? "Базовый курс · 150 слов" : "Элементарный курс · 300 слов"
  const levelShort = isHsk1 ? "HSK 1" : "HSK 2"

  const states = course.lessons.map((_, i) => lessonStates(course.id, i))
  const completedCount = states.filter((s) => s.done).length
  const progress = Math.round((completedCount / course.lessons.length) * 100)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <Link
          href={coursesListHref}
          className="mb-6 inline-flex items-center gap-1 text-ds-body-sm text-ds-text-tertiary transition-colors hover:text-ds-ink"
        >
          <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
          Назад к курсам
        </Link>

        <section className="mb-8 rounded-[var(--ds-radius-xl)] p-7" style={{ backgroundColor: bgColor }}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[34px] font-bold leading-none text-ds-ink">{levelShort}</p>
              <p className="text-ds-body-lg text-ds-text-muted">{subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-[36px] font-bold leading-none text-ds-ink">{progress}%</p>
              <p className="text-ds-sm-plus text-ds-text-secondary">выполнено</p>
            </div>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-[rgb(255_255_255/0.6)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>

          <div className="mt-4 flex gap-6">
            <div>
              <span className="font-semibold text-ds-ink">{completedCount}</span>
              <span className="ml-1 text-ds-sm-plus text-ds-text-secondary">пройдено</span>
            </div>
            <div>
              <span className="font-semibold text-ds-ink">{course.lessons.length - completedCount}</span>
              <span className="ml-1 text-ds-sm-plus text-ds-text-secondary">осталось</span>
            </div>
          </div>
        </section>

        <h2 className="sr-only">{titleLine}</h2>

        <div className="flex flex-col gap-2">
          {course.lessons.map((lesson, i) => {
            const { done, active } = states[i]!
            const locked = isRowLocked(i, states)
            const { isDiagnostic, isTest } = topicFlags(lesson.title, lesson.slug)
            const href = `/${lesson.slug}`

            const rowClass = active
              ? "cursor-pointer bg-ds-ink text-white dark:bg-white dark:text-[#1a1a1a]"
              : done
                ? "cursor-pointer bg-[var(--ds-neutral-row)] hover:bg-[var(--ds-neutral-row-hover)]"
                : locked
                  ? "cursor-not-allowed bg-[var(--ds-neutral-row)] opacity-50"
                  : "cursor-pointer bg-[var(--ds-neutral-row)] hover:bg-[var(--ds-neutral-row-hover)]"

            const inner = (
              <>
                <div className="shrink-0">
                  {done ? (
                    <CheckCircle className="h-[22px] w-[22px] text-ds-sage-strong" aria-hidden />
                  ) : isDiagnostic ? (
                    <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-current">
                      <span className="text-[11px] font-bold">!</span>
                    </div>
                  ) : isTest ? (
                    <FileText
                      className={`h-[22px] w-[22px] ${active ? "text-white dark:text-[#1a1a1a]" : "text-ds-text-tertiary"}`}
                      aria-hidden
                    />
                  ) : locked ? (
                    <Lock className="h-[18px] w-[18px] text-ds-chevron" aria-hidden />
                  ) : (
                    <PlayCircle
                      className={`h-[22px] w-[22px] ${active ? "text-white dark:text-[#1a1a1a]" : "text-ds-text-tertiary"}`}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-ds-body leading-tight ${active ? "text-white dark:text-[#1a1a1a]" : "text-ds-ink"}`}
                  >
                    {lesson.title}
                  </p>
                  {isDiagnostic ? (
                    <p
                      className={`mt-0.5 text-ds-sm ${active ? "text-white/70 dark:text-neutral-600" : "text-ds-text-tertiary"}`}
                    >
                      Полный диагностический тест
                    </p>
                  ) : null}
                  {isTest && !isDiagnostic ? (
                    <p
                      className={`mt-0.5 text-ds-sm ${active ? "text-white/70 dark:text-neutral-600" : "text-ds-text-tertiary"}`}
                    >
                      Вариант теста
                    </p>
                  ) : null}
                </div>
                {!locked ? (
                  <ChevronRight
                    className={`h-5 w-5 shrink-0 ${active ? "text-white dark:text-[#1a1a1a]" : "text-ds-chevron"}`}
                    aria-hidden
                  />
                ) : null}
              </>
            )

            if (locked) {
              return (
                <div
                  key={lesson.slug}
                  className={`flex items-center gap-4 rounded-[var(--ds-radius-md)] p-4 ${rowClass}`}
                >
                  {inner}
                </div>
              )
            }

            return (
              <Link
                key={lesson.slug}
                href={href}
                className={`flex items-center gap-4 rounded-[var(--ds-radius-md)] p-4 no-underline transition-colors ${rowClass}`}
              >
                {inner}
              </Link>
            )
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/${course.lessons[0]?.slug ?? "hsk1-tema1"}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-ds-ink px-4 py-3 text-ds-body-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a] dark:hover:opacity-95 sm:min-w-[200px]"
          >
            Начать с первой темы
          </Link>
          <Link
            href={progressHref}
            className="inline-flex flex-1 items-center justify-center rounded-[var(--ds-radius-md)] bg-white px-4 py-3 text-ds-body-sm font-medium text-ds-ink shadow-none transition-colors hover:bg-ds-surface-hover dark:bg-ds-surface dark:hover:bg-white/5 sm:min-w-[200px]"
          >
            Материалы и отчёты (PDF)
          </Link>
        </div>
      </div>
    </div>
  )
}
