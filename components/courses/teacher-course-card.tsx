"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { useTheme } from "next-themes"
import { CourseArtworkSlot } from "@/components/courses/course-artwork-slot"
import { CourseCardStatsRow } from "@/components/courses/course-card-stats-row"
import {
  courseAccentForTheme,
  courseAccentFromCourse,
  courseBannerPalette,
  courseCardTextPaletteForTheme,
  courseCoverFromCourseForTheme,
} from "@/lib/teacher-custom-course-form"
import type { TeacherCustomCourse } from "@/lib/types"
import { cn } from "@/lib/utils"

const DEFAULT_COURSE_TYPE_LABEL = "Собственный курс"

export function TeacherCourseCard({
  course,
  href,
  courseTypeLabel,
  lessonProgress
}: {
  course: TeacherCustomCourse
  /** По умолчанию `/teacher/courses/:id` */
  href?: string
  /** У ученика — «Авторский курс»; у преподавателя по умолчанию «Собственный курс». */
  courseTypeLabel?: string
  /** Кабинет ученика: прогресс по отмеченным пройденными урокам */
  lessonProgress?: { completed: number; total: number }
}) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
  const initials = (course.teacher_name ?? "T")
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const avatarUrl = (course.teacher_avatar_url ?? "").trim()
  const showAvatar = avatarUrl.length > 0 && !avatarFailed
  const description = (course.description ?? "").trim()
  const lessonsTotal = course.lesson_count ?? 0
  const newWordsTotal = course.new_words_count ?? 0
  const audioTotal = course.audio_count ?? 0

  const linkHref = href ?? `/teacher/courses/${course.id}`
  const typeLine = courseTypeLabel ?? DEFAULT_COURSE_TYPE_LABEL
  const showStudentProgress = lessonProgress != null
  const totalLessons = Math.max(0, lessonProgress?.total ?? 0)
  const rawDone = Math.max(0, lessonProgress?.completed ?? 0)
  const doneLessons = totalLessons > 0 ? Math.min(rawDone, totalLessons) : 0
  const progressPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0
  const bannerPalette = courseBannerPalette(course.cover_color)
  const bannerAccent = courseAccentForTheme(courseAccentFromCourse(course), isDark)
  const textPalette = courseCardTextPaletteForTheme(course.cover_color, isDark)
  const textColor = textPalette.text
  const metaColor = textPalette.meta
  const helperColor = textPalette.helper
  const teacherCardBg = textPalette.iconBg

  return (
    <Link
      href={linkHref}
      className={cn(
        "ds-course-card relative overflow-hidden text-inherit no-underline outline-offset-2",
        "focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)] dark:focus-visible:ring-white/35",
        showStudentProgress ? "flex min-h-[260px] flex-col sm:min-h-[296px] lg:min-h-[312px]" : "block"
      )}
      style={courseCoverFromCourseForTheme(course, isDark)}
    >
      <div className={cn("relative z-[1]", showStudentProgress && "flex flex-1 flex-col")}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0 pr-2">
            <p className="mb-1 text-[length:var(--ds-text-6xl)] font-bold leading-none" style={{ color: textColor }}>
              {(course.title || "Новый курс").slice(0, 20)}
            </p>
            <p className="text-[length:var(--ds-text-body-lg)]" style={{ color: metaColor }}>
              {typeLine}
            </p>
          </div>
          <div
            className="hidden h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[24px] sm:flex"
            style={{ backgroundColor: bannerPalette.artworkSlotBg }}
          >
            <CourseArtworkSlot
              cover={course}
              accentColor={bannerAccent}
              className="h-full w-full rounded-[24px]"
              iconClassName="h-[58%] w-[58%] opacity-80"
            />
          </div>
        </div>

        {description ? (
          <p className="mb-5 text-ds-body-sm leading-snug" style={{ color: helperColor }}>
            {description}
          </p>
        ) : null}

        <CourseCardStatsRow
          lessons={lessonsTotal}
          newWords={newWordsTotal}
          audio={audioTotal}
          layout={showStudentProgress ? "cluster" : "grid"}
          valueColor={textColor}
          labelColor={helperColor}
        />

        {showStudentProgress ? (
          <div className="mb-4">
            <div className="mb-1.5 flex justify-between">
              <span className="text-[13px]" style={{ color: helperColor }}>Прогресс</span>
              <span className="text-[13px] font-semibold" style={{ color: textColor }}>{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: bannerPalette.progressTrack }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: bannerAccent
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "flex items-center justify-between gap-3 text-ds-body",
            showStudentProgress && "mt-auto"
          )}
              style={{ color: textColor }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {showAvatar ? (
              <img
                src={avatarUrl}
                alt={course.teacher_name ?? "Преподаватель"}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  border: bannerPalette.tone === "dark" ? "1px solid rgb(255 255 255 / 0.2)" : "1px solid rgb(0 0 0 / 0.08)",
                  backgroundColor: teacherCardBg,
                  color: textColor,
                }}
              >
                {initials}
              </div>
            )}
            <span className="truncate text-ds-body-sm font-medium" style={{ color: textColor }}>
              {course.teacher_name ?? "Преподаватель"}
            </span>
          </div>
          <span className="flex shrink-0 items-center">
            <ArrowRight className="h-10 w-10 shrink-0" style={{ color: textColor }} strokeWidth={2.25} aria-hidden />
            <span className="sr-only">Перейти к курсу</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
