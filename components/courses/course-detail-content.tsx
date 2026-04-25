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
import { useTheme } from "next-themes"
import { courseCatalog, type CourseCatalog } from "@/lib/course-catalog"
import { courseAccentForTheme, courseBannerPalette, courseCoverSurfaceStyleForTheme, mutedCoverColorForDarkTheme } from "@/lib/teacher-custom-course-form"
import { useUiLocale } from "@/lib/ui-locale"

type CatalogLessonGroup = {
  id: string
  title: string
  lessons: Array<{ title: string; slug: string; index: number }>
}

const MODULE_SIZE = 3

const COPY = {
  ru: {
    back: "Назад к курсам",
    notFound: "Курс не найден",
    done: "пройдено",
    left: "осталось",
    firstTopic: "Начать с первой темы",
    materials: "Материалы и отчёты (PDF)",
    module: "Модуль",
    testVariants: "Тестовые варианты",
    diagnostics: "Диагностика",
  },
  en: {
    back: "Back to courses",
    notFound: "Course not found",
    done: "completed",
    left: "left",
    firstTopic: "Start with lesson one",
    materials: "Materials and reports (PDF)",
    module: "Module",
    testVariants: "Test variants",
    diagnostics: "Diagnostics",
  },
  zh: {
    back: "返回课程",
    notFound: "课程未找到",
    done: "已完成",
    left: "剩余",
    firstTopic: "从第一课开始",
    materials: "资料与报告（PDF）",
    module: "模块",
    testVariants: "测试练习",
    diagnostics: "诊断",
  },
} as const

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

function groupCatalogLessons(course: CourseCatalog, moduleLabel: string, testsLabel: string, diagnosticsLabel: string) {
  const lessonEntries = course.lessons.map((lesson, index) => ({ ...lesson, index }))
  const regular = lessonEntries.filter((lesson) => {
    const flags = topicFlags(lesson.title, lesson.slug)
    return !flags.isDiagnostic && !flags.isTest
  })
  const tests = lessonEntries.filter((lesson) => topicFlags(lesson.title, lesson.slug).isTest)
  const diagnostics = lessonEntries.filter((lesson) => topicFlags(lesson.title, lesson.slug).isDiagnostic)

  const groups: CatalogLessonGroup[] = []

  for (let index = 0; index < regular.length; index += MODULE_SIZE) {
    const chunk = regular.slice(index, index + MODULE_SIZE)
    if (chunk.length === 0) continue
    groups.push({
      id: `module-${index / MODULE_SIZE + 1}`,
      title: `${moduleLabel} ${index / MODULE_SIZE + 1}`,
      lessons: chunk,
    })
  }

  if (tests.length > 0) {
    groups.push({
      id: "tests",
      title: testsLabel,
      lessons: tests,
    })
  }

  if (diagnostics.length > 0) {
    groups.push({
      id: "diagnostics",
      title: diagnosticsLabel,
      lessons: diagnostics,
    })
  }

  return groups
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
  const { locale } = useUiLocale()
  const { resolvedTheme } = useTheme()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
  const copy = COPY[locale]
  const course = courseCatalog.find((item) => item.id === courseId)

  if (!course || (course.id !== "hsk1" && course.id !== "hsk2")) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto max-w-[var(--ds-shell-max-width)]">
          <section className="rounded-[var(--ds-radius-xl)] bg-ds-panel-muted px-7 py-6">
            <h1 className="text-[length:var(--ds-text-4xl)] font-semibold tracking-[-0.03em] text-ds-ink">
              {copy.notFound}
            </h1>
            <Link
              href={coursesListHref}
              className="mt-4 inline-flex rounded-[var(--ds-radius-md)] bg-ds-ink px-4 py-2 text-ds-body-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a] dark:hover:opacity-95"
            >
              {copy.back}
            </Link>
          </section>
        </div>
      </div>
    )
  }

  const isHsk1 = course.id === "hsk1"
  const bgColor = isDark ? (mutedCoverColorForDarkTheme(course.coverColor) ?? course.coverColor) : course.coverColor
  const accentColor = courseAccentForTheme(course.accentColor, isDark)
  const bannerPalette = courseBannerPalette(bgColor)
  const bannerTextColor = bannerPalette.text
  const bannerMetaColor = bannerPalette.muted
  const bannerSupportColor = bannerPalette.secondary
  const titleLine = isHsk1 ? "HSK 1 — Базовый курс" : "HSK 2 — Элементарный курс"
  const subtitle = isHsk1 ? "Базовый курс · 150 слов" : "Элементарный курс · 300 слов"
  const levelShort = isHsk1 ? "HSK 1" : "HSK 2"

  const states = course.lessons.map((_, i) => lessonStates(course.id, i))
  const completedCount = states.filter((s) => s.done).length
  const progress = Math.round((completedCount / course.lessons.length) * 100)
  const lessonGroups = groupCatalogLessons(course, copy.module, copy.testVariants, copy.diagnostics)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <Link
          href={coursesListHref}
          className="mb-6 inline-flex items-center gap-1 text-ds-body-sm text-ds-text-tertiary transition-colors hover:text-ds-ink"
        >
          <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
          {copy.back}
        </Link>

        <section
          className="relative mb-8 overflow-hidden rounded-[var(--ds-radius-xl)] p-7"
          style={courseCoverSurfaceStyleForTheme(course.coverColor, isDark)}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-transparent dark:bg-black/45"
          />
          <div className="relative z-[1] mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[34px] font-bold leading-none" style={{ color: bannerTextColor }}>{levelShort}</p>
              <p className="text-ds-body-lg" style={{ color: bannerMetaColor }}>{subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-[36px] font-bold leading-none" style={{ color: bannerTextColor }}>{progress}%</p>
              <p className="text-ds-sm-plus" style={{ color: bannerSupportColor }}>выполнено</p>
            </div>
          </div>

          <div className="relative z-[1] h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: bannerPalette.progressTrack }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>

          <div className="relative z-[1] mt-4 flex gap-6">
            <div>
              <span className="font-semibold" style={{ color: bannerTextColor }}>{completedCount}</span>
              <span className="ml-1 text-ds-sm-plus" style={{ color: bannerSupportColor }}>{copy.done}</span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: bannerTextColor }}>{course.lessons.length - completedCount}</span>
              <span className="ml-1 text-ds-sm-plus" style={{ color: bannerSupportColor }}>{copy.left}</span>
            </div>
          </div>
        </section>

        <h2 className="sr-only">{titleLine}</h2>

        <div className="space-y-6">
          {lessonGroups.map((group) => (
            <section key={group.id} className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                {group.title}
              </p>
              <div className="flex flex-col gap-2">
                {group.lessons.map((lesson) => {
                  const i = lesson.index
                  const { done, active } = states[i]!
                  const locked = isRowLocked(i, states)
                  const { isDiagnostic, isTest } = topicFlags(lesson.title, lesson.slug)
                  const href = `/${lesson.slug}`

                  const rowClass = active
                    ? "cursor-pointer bg-ds-ink text-white dark:bg-white dark:text-[#1a1a1a]"
                    : done
                      ? "cursor-pointer bg-[var(--ds-neutral-row)] hover:bg-[var(--ds-neutral-row-hover)]"
                    : locked
                        ? "cursor-not-allowed bg-[var(--ds-neutral-row)]"
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
                        <p className={`text-ds-body leading-tight ${active ? "text-white dark:text-[#1a1a1a]" : locked ? "text-ds-text-secondary dark:text-neutral-500" : "text-ds-ink"}`}>
                          {lesson.title}
                        </p>
                        {isDiagnostic ? (
                          <p className={`mt-0.5 text-ds-sm ${active ? "text-white/70 dark:text-neutral-600" : locked ? "text-ds-text-tertiary dark:text-neutral-600" : "text-ds-text-tertiary"}`}>
                            Полный диагностический тест
                          </p>
                        ) : null}
                        {isTest && !isDiagnostic ? (
                          <p className={`mt-0.5 text-ds-sm ${active ? "text-white/70 dark:text-neutral-600" : locked ? "text-ds-text-tertiary dark:text-neutral-600" : "text-ds-text-tertiary"}`}>
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
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/${course.lessons[0]?.slug ?? "hsk1-tema1"}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-ds-ink px-4 py-3 text-ds-body-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a] dark:hover:opacity-95 sm:min-w-[200px]"
          >
            {copy.firstTopic}
          </Link>
          <Link
            href={progressHref}
            className="inline-flex flex-1 items-center justify-center rounded-[var(--ds-radius-md)] bg-white px-4 py-3 text-ds-body-sm font-medium text-ds-ink shadow-none transition-colors hover:bg-ds-surface-hover dark:bg-ds-surface dark:hover:bg-white/5 sm:min-w-[200px]"
          >
            {copy.materials}
          </Link>
        </div>
      </div>
    </div>
  )
}
