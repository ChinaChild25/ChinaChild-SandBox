"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, CheckCircle, ChevronLeft, ChevronRight, Headphones, ImageIcon, PlayCircle, Sparkles } from "lucide-react"
import { useTheme } from "next-themes"
import { CourseArtworkSlot } from "@/components/courses/course-artwork-slot"
import type { TeacherCourseModule, TeacherCustomCourse, TeacherLesson } from "@/lib/types"
import {
  courseAccentForTheme,
  courseAccentFromCourse,
  courseBannerPalette,
  courseCoverFromCourseForTheme,
  mutedCoverColorForDarkTheme,
} from "@/lib/teacher-custom-course-form"
import { useUiLocale } from "@/lib/ui-locale"
import { cn } from "@/lib/utils"

type CourseDetailRow = TeacherCustomCourse & {
  completed_lesson_ids?: string[]
}

type CourseDetailResponse = {
  course?: CourseDetailRow
  lessons?: TeacherLesson[]
  modules?: TeacherCourseModule[]
  error?: string
}

type LocaleCopy = {
  back: string
  loading: string
  openLesson: string
  authorCourse: string
  teacherRole: string
  lessons: string
  progressDone: string
  progressLeft: string
  progressDoneLine: string
  progressLeftLine: string
  result: string
  words: string
  audio: string
  moduleFallback: string
  withoutModule: string
  noLessons: string
  courseNotFound: string
}

const COPY: Record<"ru" | "en" | "zh", LocaleCopy> = {
  ru: {
    back: "Назад к курсам",
    loading: "Загрузка курса…",
    openLesson: "Откройте урок, чтобы перейти к заданиям.",
    authorCourse: "Авторский курс",
    teacherRole: "Преподаватель курса",
    lessons: "уроков",
    progressDone: "выполнено",
    progressLeft: "осталось",
    progressDoneLine: "пройдено",
    progressLeftLine: "впереди",
    result: "Результат",
    words: "слов",
    audio: "аудио",
    moduleFallback: "Модуль",
    withoutModule: "Без раздела",
    noLessons: "Уроки ещё не добавлены.",
    courseNotFound: "Курс не найден",
  },
  en: {
    back: "Back to courses",
    loading: "Loading course…",
    openLesson: "Open a lesson to continue with the activities.",
    authorCourse: "Teacher course",
    teacherRole: "Course teacher",
    lessons: "lessons",
    progressDone: "completed",
    progressLeft: "left",
    progressDoneLine: "done",
    progressLeftLine: "remaining",
    result: "Score",
    words: "words",
    audio: "audio",
    moduleFallback: "Module",
    withoutModule: "Unassigned",
    noLessons: "No lessons have been added yet.",
    courseNotFound: "Course not found",
  },
  zh: {
    back: "返回课程",
    loading: "课程加载中…",
    openLesson: "打开课程进入任务。",
    authorCourse: "教师自定义课程",
    teacherRole: "授课老师",
    lessons: "课时",
    progressDone: "已完成",
    progressLeft: "剩余",
    progressDoneLine: "完成",
    progressLeftLine: "待学",
    result: "结果",
    words: "词",
    audio: "音频",
    moduleFallback: "模块",
    withoutModule: "未分组",
    noLessons: "暂时还没有课程内容。",
    courseNotFound: "课程未找到",
  },
}

function pluralizeRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function initialsFromName(name: string | null | undefined) {
  return (name ?? "П")
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatLessonCount(value: number, locale: "ru" | "en" | "zh", copy: LocaleCopy) {
  if (locale === "ru") return `${value} ${pluralizeRu(value, "урок", "урока", "уроков")}`
  return `${value} ${copy.lessons}`
}

function scoreTier(score: number): "high" | "mid" | "low" {
  if (score >= 90) return "high"
  if (score >= 75) return "mid"
  return "low"
}

function scoreBarColor(tier: "high" | "mid" | "low") {
  if (tier === "high") return "var(--ds-sage-strong)"
  if (tier === "mid") return "#e6a817"
  return "var(--ds-pink-strong)"
}

function scoreBubbleBg(tier: "high" | "mid" | "low") {
  if (tier === "high") return "color-mix(in srgb, var(--ds-sage-strong) 20%, transparent)"
  if (tier === "mid") return "color-mix(in srgb, #e6a817 20%, transparent)"
  return "color-mix(in srgb, var(--ds-pink-strong) 20%, transparent)"
}

function courseSubtitle(course: CourseDetailRow, locale: "ru" | "en" | "zh", copy: LocaleCopy) {
  const left = course.level?.trim() || copy.authorCourse
  const lessonCount = course.lesson_count ?? 0
  return `${left} · ${formatLessonCount(lessonCount, locale, copy)}`
}

type LessonGroup = {
  id: string
  title: string
  lessons: TeacherLesson[]
}

function buildLessonGroups(
  modules: TeacherCourseModule[],
  lessons: TeacherLesson[],
  fallbackLabel: string,
  unassignedLabel: string
) {
  const groups: LessonGroup[] = []
  for (const module of modules) {
    const groupedLessons = lessons.filter((lesson) => lesson.module_id === module.id)
    if (groupedLessons.length === 0) continue
    groups.push({
      id: module.id,
      title: module.title?.trim() || `${fallbackLabel} ${groups.length + 1}`,
      lessons: groupedLessons,
    })
  }

  const unassigned = lessons.filter((lesson) => !lesson.module_id)
  if (unassigned.length > 0) {
    groups.push({
      id: "unassigned",
      title: modules.length > 0 ? unassignedLabel : `${fallbackLabel} 1`,
      lessons: unassigned,
    })
  }

  return groups
}

function sortLessonsByModules(modules: TeacherCourseModule[], lessons: TeacherLesson[]) {
  const moduleOrder = new Map(modules.map((module, index) => [module.id, index]))
  return [...lessons].sort((left, right) => {
    const leftModule = left.module_id ? (moduleOrder.get(left.module_id) ?? Number.MAX_SAFE_INTEGER - 1) : Number.MAX_SAFE_INTEGER
    const rightModule = right.module_id ? (moduleOrder.get(right.module_id) ?? Number.MAX_SAFE_INTEGER - 1) : Number.MAX_SAFE_INTEGER
    if (leftModule !== rightModule) return leftModule - rightModule
    if (left.order !== right.order) return left.order - right.order
    return left.title.localeCompare(right.title, "ru")
  })
}

export function StudentAssignedCourseContent({
  courseId,
  coursesListHref
}: {
  courseId: string | undefined
  coursesListHref: "/courses" | "/teacher/courses"
}) {
  const { locale } = useUiLocale()
  const { resolvedTheme } = useTheme()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
  const copy = COPY[locale]
  const [course, setCourse] = useState<CourseDetailRow | null>(null)
  const [lessons, setLessons] = useState<TeacherLesson[]>([])
  const [modules, setModules] = useState<TeacherCourseModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avatarFailed, setAvatarFailed] = useState(false)

  const load = useCallback(async () => {
    if (!courseId) {
      setLoading(false)
      setError("Курс не указан")
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/student/courses/${courseId}`, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as CourseDetailResponse | null
    if (!res.ok || !json?.course) {
      setError(json?.error ?? copy.courseNotFound)
      setCourse(null)
      setLessons([])
      setModules([])
      setLoading(false)
      return
    }
    setCourse(json.course)
    setLessons(sortLessonsByModules(json.modules ?? [], json.lessons ?? []))
    setModules((json.modules ?? []).slice().sort((a, b) => a.order - b.order))
    setLoading(false)
  }, [copy.courseNotFound, courseId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!courseId) return

    const refresh = () => {
      void load()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load()
      }
    }

    window.addEventListener("focus", refresh)
    window.addEventListener("pageshow", refresh)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("pageshow", refresh)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [courseId, load])

  const completedIds = useMemo(() => new Set(course?.completed_lesson_ids ?? []), [course?.completed_lesson_ids])
  const lessonScoreMap = useMemo(() => course?.lesson_score_percent_by_id ?? {}, [course?.lesson_score_percent_by_id])
  const lessonGroups = useMemo(
    () => buildLessonGroups(modules, lessons, copy.moduleFallback, copy.withoutModule),
    [copy.moduleFallback, copy.withoutModule, lessons, modules]
  )

  const firstIncompleteId = useMemo(
    () => lessons.find((lesson) => !completedIds.has(lesson.id))?.id ?? null,
    [completedIds, lessons]
  )

  if (loading) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] text-sm text-ds-text-secondary">{copy.loading}</div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto max-w-[var(--ds-shell-max-width)]">
          <section className="rounded-[var(--ds-radius-xl)] bg-ds-panel-muted px-7 py-6">
            <h1 className="text-[length:var(--ds-text-4xl)] font-semibold tracking-[-0.03em] text-ds-ink">
              {error ?? copy.courseNotFound}
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

  const totalLessons = course.lesson_count ?? lessons.length
  const completedLessons = course.completed_lesson_count ?? completedIds.size
  const remainingLessons = Math.max(totalLessons - completedLessons, 0)
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const avatarUrl = (course.teacher_avatar_url ?? "").trim()
  const showAvatar = avatarUrl.length > 0 && !avatarFailed
  const description =
    course.description?.trim() || (locale === "ru" ? "Материалы собраны преподавателем под ваш учебный ритм." : course.description ?? "")
  const effectiveCoverColor = isDark ? (mutedCoverColorForDarkTheme(course.cover_color) ?? course.cover_color) : course.cover_color
  const bannerPalette = courseBannerPalette(effectiveCoverColor)
  const bannerAccent = courseAccentForTheme(courseAccentFromCourse(course), isDark)
  const bannerProgressTrack = isDark ? "rgb(255 255 255 / 0.3)" : "rgb(255 255 255 / 0.74)"
  const chipClass = "backdrop-blur-sm"
  const teacherCardClass = "backdrop-blur-sm"

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-8 pb-10 sm:pb-14">
        <Link
          href={coursesListHref}
          className="inline-flex items-center gap-1 text-ds-body-sm text-ds-text-tertiary transition-colors hover:text-ds-ink"
        >
          <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
          {copy.back}
        </Link>

        <section
          className="relative overflow-hidden rounded-[var(--ds-radius-xl)] p-6 sm:p-7"
          style={courseCoverFromCourseForTheme(course, isDark)}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-transparent dark:bg-black/45"
          />
          <div className="relative z-[1] grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="min-w-0">
              <div className="mb-4 flex items-start justify-between gap-4 xl:hidden">
                <div className="min-w-0">
                  <p className="text-ds-body-lg" style={{ color: bannerPalette.muted }}>
                    {courseSubtitle(course, locale, copy)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[36px] font-bold leading-none" style={{ color: bannerPalette.text }}>
                    {progress}%
                  </p>
                  <p className="text-ds-sm-plus" style={{ color: bannerPalette.secondary }}>
                    {copy.progressDone}
                  </p>
                </div>
              </div>

              <h1
                className="text-[clamp(2.4rem,6vw,4rem)] font-bold leading-[0.94] tracking-[-0.05em]"
                style={{ color: bannerPalette.text }}
              >
                {course.title || copy.authorCourse}
              </h1>
              <p className="mt-3 text-ds-body-lg" style={{ color: bannerPalette.muted }}>
                {courseSubtitle(course, locale, copy)}
              </p>
              <p className="mt-4 max-w-[60ch] text-ds-body leading-8" style={{ color: bannerPalette.secondary }}>
                {description}
              </p>

              <div className="mt-6">
                <div
                  className={cn("inline-flex max-w-full items-center gap-3 rounded-[var(--ds-radius-lg)] px-3 py-3", teacherCardClass)}
                  style={{ backgroundColor: bannerPalette.teacherCardBg, color: bannerPalette.text }}
                >
                  {showAvatar ? (
                    <img
                      src={avatarUrl}
                      alt={course.teacher_name ?? copy.teacherRole}
                      className="h-12 w-12 rounded-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor: bannerPalette.tone === "dark" ? "rgb(255 255 255 / 0.18)" : "rgb(23 23 23 / 0.9)",
                        color: bannerPalette.tone === "dark" ? bannerPalette.text : "#FFFFFF",
                      }}
                    >
                      {initialsFromName(course.teacher_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-ds-body font-medium" style={{ color: bannerPalette.text }}>
                      {course.teacher_name ?? copy.teacherRole}
                    </p>
                    <p className="text-ds-sm" style={{ color: bannerPalette.secondary }}>
                      {copy.teacherRole}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div
                  className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-ds-body-sm", chipClass)}
                  style={{ backgroundColor: bannerPalette.chipBg, color: bannerPalette.text }}
                >
                  <BookOpen className="h-4 w-4" style={{ color: bannerAccent }} aria-hidden />
                  <span>{formatLessonCount(totalLessons, locale, copy)}</span>
                </div>
                <div
                  className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-ds-body-sm", chipClass)}
                  style={{ backgroundColor: bannerPalette.chipBg, color: bannerPalette.text }}
                >
                  <Sparkles className="h-4 w-4" style={{ color: bannerAccent }} aria-hidden />
                  <span>
                    {course.new_words_count ?? 0} {copy.words}
                  </span>
                </div>
                <div
                  className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-ds-body-sm", chipClass)}
                  style={{ backgroundColor: bannerPalette.chipBg, color: bannerPalette.text }}
                >
                  <Headphones className="h-4 w-4" style={{ color: bannerAccent }} aria-hidden />
                  <span>
                    {course.audio_count ?? 0} {copy.audio}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="hidden justify-end xl:flex">
                <div className="text-right">
                  <p className="text-[56px] font-bold leading-none" style={{ color: bannerPalette.text }}>
                    {progress}%
                  </p>
                  <p className="mt-1 text-ds-sm-plus" style={{ color: bannerPalette.secondary }}>
                    {copy.progressDone}
                  </p>
                </div>
              </div>

              <div className="hidden min-h-[220px] items-center justify-end xl:flex">
                <div
                  className="h-[220px] w-[280px] overflow-hidden rounded-[32px]"
                  style={{ backgroundColor: bannerPalette.artworkSlotBg }}
                >
                  <CourseArtworkSlot
                    cover={course}
                    accentColor={bannerAccent}
                    className="h-full w-full rounded-[32px]"
                    iconClassName="h-[58%] w-[58%] opacity-80"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full" style={{ backgroundColor: bannerProgressTrack }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: bannerAccent,
                boxShadow: isDark ? "0 0 0 1px rgb(255 255 255 / 0.08) inset" : "0 0 0 1px rgb(23 23 23 / 0.08) inset",
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <div
              className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-ds-sm-plus", chipClass)}
              style={{ backgroundColor: bannerPalette.chipBg, color: bannerPalette.text }}
            >
              <span className="font-semibold" style={{ color: bannerPalette.text }}>
                {completedLessons}
              </span>
              <span style={{ color: bannerPalette.muted }}>
                {copy.progressDoneLine}
              </span>
            </div>
            <div
              className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-ds-sm-plus", chipClass)}
              style={{ backgroundColor: bannerPalette.chipBg, color: bannerPalette.text }}
            >
              <span className="font-semibold" style={{ color: bannerPalette.text }}>
                {remainingLessons}
              </span>
              <span style={{ color: bannerPalette.muted }}>
                {copy.progressLeftLine}
              </span>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          {lessonGroups.map((group, groupIndex) => (
            <section key={group.id} className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                {group.title || `${copy.moduleFallback} ${groupIndex + 1}`}
              </p>
              <div className="space-y-2">
                {group.lessons.map((lesson) => {
                  const done = completedIds.has(lesson.id)
                  const active = !done && lesson.id === firstIncompleteId
                  const scorePercent = typeof lessonScoreMap[lesson.id] === "number" ? lessonScoreMap[lesson.id] : null
                  const scoreTierValue = scorePercent !== null ? scoreTier(scorePercent) : null
                  const scoreColor = scoreTierValue ? scoreBarColor(scoreTierValue) : "var(--ds-sage-strong)"
                  const scoreBubble = scoreTierValue ? scoreBubbleBg(scoreTierValue) : "color-mix(in srgb, var(--ds-sage-strong) 16%, transparent)"
                  const rowClass = active
                    ? "cursor-pointer bg-ds-ink text-white dark:bg-white dark:text-[#1a1a1a]"
                    : done
                      ? "cursor-pointer bg-[var(--ds-neutral-row)] hover:bg-[var(--ds-neutral-row-hover)]"
                      : "cursor-pointer bg-[var(--ds-neutral-row)] hover:bg-[var(--ds-neutral-row-hover)]"

                  return (
                    <Link
                      key={lesson.id}
                      href={`/lesson/${lesson.id}`}
                      className={cn(
                        "flex items-center gap-4 rounded-[var(--ds-radius-md)] p-4 no-underline transition-colors",
                        rowClass
                      )}
                    >
                      <div className="shrink-0">
                        {done && scorePercent !== null ? (
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{ backgroundColor: scoreBubble }}
                          >
                            <span className="text-[20px] font-bold leading-none tabular-nums" style={{ color: scoreColor }}>
                              {scorePercent}
                            </span>
                          </div>
                        ) : done ? (
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{ backgroundColor: "color-mix(in srgb, var(--ds-sage-strong) 18%, transparent)" }}
                          >
                            <CheckCircle className="h-6 w-6 text-ds-sage-strong" aria-hidden />
                          </div>
                        ) : (
                          <PlayCircle
                            className={cn(
                              "h-[24px] w-[24px]",
                              active ? "text-white dark:text-[#1a1a1a]" : "text-ds-text-tertiary"
                            )}
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[18px] font-medium leading-tight", active ? "text-white dark:text-[#1a1a1a]" : "text-ds-ink")}>
                          {lesson.title}
                        </p>
                        {done && scorePercent !== null ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-ds-text-secondary">
                            <span>{copy.result}</span>
                            <span className="font-semibold text-ds-ink">{scorePercent}/100</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {done && scorePercent !== null ? (
                          <div className="hidden min-w-[96px] text-right sm:block">
                            <div
                              className="ml-auto h-2 w-20 overflow-hidden rounded-full"
                              style={{ backgroundColor: "var(--ds-neutral-chrome)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${scorePercent}%`, backgroundColor: scoreColor }}
                              />
                            </div>
                          </div>
                        ) : null}
                        <ChevronRight
                          className={cn(
                            "h-5 w-5 shrink-0",
                            active ? "text-white dark:text-[#1a1a1a]" : "text-ds-chevron"
                          )}
                          aria-hidden
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}

          {lessons.length === 0 ? <p className="text-sm text-ds-text-secondary">{copy.noLessons}</p> : null}
        </div>
      </div>
    </div>
  )
}
