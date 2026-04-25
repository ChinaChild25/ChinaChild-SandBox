"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BookOpen, CheckCircle, ChevronRight } from "lucide-react"
import { useTheme } from "next-themes"
import { TeacherCourseCard } from "@/components/courses/teacher-course-card"
import { courseCatalog } from "@/lib/course-catalog"
import { useAuth } from "@/lib/auth-context"
import type { TeacherCustomCourse } from "@/lib/types"
import {
  courseBannerPalette,
  courseAccentForTheme,
  courseCardTextPaletteForTheme,
  courseCoverSurfaceStyleForTheme,
  mutedCoverColorForDarkTheme,
} from "@/lib/teacher-custom-course-form"

const courseVisual: Record<
  "hsk1" | "hsk2",
  { levelLine: string; titleLine: string; words: string; completed: number; progress: number; accentVar: string }
> = {
  hsk1: {
    levelLine: "HSK 1",
    titleLine: "Базовый курс",
    words: "150 слов",
    completed: 7,
    progress: 37,
    accentVar: "--ds-sage-strong"
  },
  hsk2: {
    levelLine: "HSK 2",
    titleLine: "Элементарный курс",
    words: "300 слов",
    completed: 0,
    progress: 0,
    accentVar: "--ds-pink-strong"
  }
}

const recentActivity = [
  {
    topic: "Тема №7 — Члены семьи",
    course: "HSK1",
    score: 92,
    date: "9 апр",
    slug: "hsk1-tema7"
  },
  {
    topic: "Тема №6 — Телефонные номера",
    course: "HSK1",
    score: 88,
    date: "7 апр",
    slug: "hsk1-tema6"
  },
  {
    topic: "Тема №5 — Возраст",
    course: "HSK1",
    score: 95,
    date: "5 апр",
    slug: "hsk1-tema5"
  }
] as const

const STUDENT_AUTHOR_COURSE_LABEL = "Авторский курс"

export function CoursesPageContent({
  coursesBasePath,
  title,
  subtitle,
  activitySectionTitle
}: {
  coursesBasePath: "/courses" | "/teacher/courses"
  title: string
  subtitle: string
  activitySectionTitle?: string
}) {
  const { user, usesSupabase, authReady } = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
  const [assignedCourses, setAssignedCourses] = useState<TeacherCustomCourse[]>([])
  const [assignedLoading, setAssignedLoading] = useState(false)

  useEffect(() => {
    if (!authReady || !usesSupabase || user?.role !== "student" || coursesBasePath !== "/courses") {
      setAssignedCourses([])
      return
    }
    let cancelled = false
    setAssignedLoading(true)
    void (async () => {
      try {
        const res = await fetch("/api/student/assigned-courses", { cache: "no-store" })
        const json = (await res.json().catch(() => null)) as { courses?: TeacherCustomCourse[] } | null
        if (!cancelled) {
          setAssignedCourses(res.ok && json?.courses ? json.courses : [])
        }
      } finally {
        if (!cancelled) setAssignedLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authReady, usesSupabase, user?.role, coursesBasePath])

  const showAssigned = coursesBasePath === "/courses" && user?.role === "student" && usesSupabase

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-8">
          <h1 className="text-[length:var(--ds-text-8xl)] font-bold leading-none text-ds-text-primary">{title}</h1>
          <p className="mt-1 text-ds-body text-ds-text-secondary">{subtitle}</p>
        </header>

        {showAssigned ? (
          <section className="mb-10">
            <h2 className="mb-4 text-[20px] font-semibold text-ds-ink">Курсы от преподавателя</h2>
            {assignedLoading ? (
              <p className="text-sm text-ds-text-secondary">Загрузка…</p>
            ) : assignedCourses.length === 0 ? (
              <p className="text-sm text-ds-text-secondary">
                Здесь появятся курсы, которые преподаватель назначит вам в настройках курса.
              </p>
            ) : (
              <div className="ds-course-grid items-stretch">
                {assignedCourses.map((c) => (
                  <TeacherCourseCard
                    key={c.id}
                    course={c}
                    href={`${coursesBasePath}/${c.id}`}
                    courseTypeLabel={STUDENT_AUTHOR_COURSE_LABEL}
                    lessonProgress={{
                      completed: c.completed_lesson_count ?? 0,
                      total: c.lesson_count ?? 0
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="ds-course-grid">
          {courseCatalog.map((item) => {
            const ui = courseVisual[item.id]
            const baseCover = item.coverColor
            const bgStyle = courseCoverSurfaceStyleForTheme(baseCover, isDark)
            const totalTopics = item.lessons.length
            const progressColor = courseAccentForTheme(item.accentColor, isDark)
            const textPalette = courseCardTextPaletteForTheme(baseCover, isDark)
            const textColor = textPalette.text
            const metaColor = textPalette.meta
            const helperColor = textPalette.helper
            const coverForPalette = isDark ? (mutedCoverColorForDarkTheme(baseCover) ?? baseCover) : baseCover
            const bannerPalette = courseBannerPalette(coverForPalette)

            return (
              <Link
                key={item.id}
                href={`${coursesBasePath}/${item.id}`}
                className="ds-course-card relative overflow-hidden block text-inherit no-underline outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)]"
                style={bgStyle}
              >
                <div className="relative z-[1] mb-5 flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-[length:var(--ds-text-6xl)] font-bold leading-none" style={{ color: textColor }}>
                      {ui.levelLine}
                    </p>
                    <p className="text-[length:var(--ds-text-body-lg)]" style={{ color: metaColor }}>
                      {ui.titleLine}
                    </p>
                  </div>
                  <div className="ds-course-card__icon-wrap" style={{ backgroundColor: textPalette.iconBg }}>
                    <BookOpen className="h-[22px] w-[22px]" style={{ color: textColor }} aria-hidden />
                  </div>
                </div>

                <p className="relative z-[1] mb-5 text-ds-body-sm leading-snug" style={{ color: helperColor }}>
                  {item.description}
                </p>

                <div className="relative z-[1] mb-5 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none" style={{ color: textColor }}>
                      {ui.completed}
                    </p>
                    <p className="text-ds-sm" style={{ color: helperColor }}>пройдено</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none" style={{ color: textColor }}>
                      {totalTopics}
                    </p>
                    <p className="text-ds-sm" style={{ color: helperColor }}>тем всего</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none" style={{ color: textColor }}>
                      {ui.words}
                    </p>
                    <p className="text-ds-sm" style={{ color: helperColor }}>словарный запас</p>
                  </div>
                </div>

                <div className="relative z-[1] mb-4">
                  <div className="mb-1.5 flex justify-between">
                    <span className="text-[13px]" style={{ color: helperColor }}>Прогресс</span>
                    <span className="text-[13px] font-semibold" style={{ color: textColor }}>{ui.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: bannerPalette.progressTrack }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ui.progress}%`,
                        backgroundColor: progressColor
                      }}
                    />
                  </div>
                </div>

                <div className="relative z-[1] flex items-center justify-end gap-1 text-ds-body" style={{ color: textColor }}>
                  <span>Перейти к курсу</span>
                  <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
                </div>
              </Link>
            )
          })}
        </div>

        <section className="mt-2">
          <h2 className="mb-4 text-[20px] font-semibold text-ds-ink">
            {activitySectionTitle ?? "Последняя активность"}
          </h2>
          <div className="flex flex-col gap-3">
            {recentActivity.map((row) => (
              <Link
                key={row.slug}
                href={`/${row.slug}`}
                className="flex items-center gap-4 rounded-2xl bg-[#f8f8f8] p-4 no-underline transition-colors hover:bg-[#f0f0f0] dark:bg-ds-surface-muted dark:hover:bg-ds-surface-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-sage">
                  <CheckCircle className="h-[18px] w-[18px] text-ds-sage-strong" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-ds-ink">{row.topic}</p>
                  <p className="text-[13px] text-ds-text-tertiary">
                    {row.course} · {row.date}
                  </p>
                </div>
                <p className="text-[18px] font-bold text-ds-sage-strong">{row.score}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
