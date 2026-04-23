"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, BookOpen } from "lucide-react"
import { CourseCardStatsRow } from "@/components/courses/course-card-stats-row"
import { courseCoverFromCourse } from "@/lib/teacher-custom-course-form"
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

  return (
    <Link
      href={linkHref}
      className={cn(
        "ds-course-card relative overflow-hidden text-inherit no-underline outline-offset-2",
        "focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)] dark:focus-visible:ring-white/35",
        showStudentProgress ? "flex min-h-[260px] flex-col sm:min-h-[296px] lg:min-h-[312px]" : "block"
      )}
      style={courseCoverFromCourse(course)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-[var(--ds-radius-xl)] bg-transparent dark:bg-black/50"
      />
      <div className={cn("relative z-[1]", showStudentProgress && "flex flex-1 flex-col")}>
        <div className="mb-5 flex items-start justify-between">
          <div className="min-w-0 pr-2">
            <p className="mb-1 text-[length:var(--ds-text-6xl)] font-bold leading-none text-ds-ink">
              {(course.title || "Новый курс").slice(0, 20)}
            </p>
            <p className="text-[length:var(--ds-text-body-lg)] text-ds-text-quaternary">{typeLine}</p>
          </div>
          <div className="ds-course-card__icon-wrap">
            <BookOpen className="h-[22px] w-[22px] text-ds-ink" aria-hidden />
          </div>
        </div>

        {description ? (
          <p className="mb-5 text-ds-body-sm leading-snug text-ds-text-quaternary">{description}</p>
        ) : null}

        <CourseCardStatsRow
          lessons={lessonsTotal}
          newWords={newWordsTotal}
          audio={audioTotal}
          layout={showStudentProgress ? "cluster" : "grid"}
        />

        {showStudentProgress ? (
          <div className="mb-4">
            <div className="mb-1.5 flex justify-between">
              <span className="text-[13px] text-[#555555] dark:text-ds-text-tertiary">Прогресс</span>
              <span className="text-[13px] font-semibold text-ds-ink">{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: "var(--ds-sage-strong)"
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "flex items-center justify-between gap-3 text-ds-body text-ds-ink",
            showStudentProgress && "mt-auto"
          )}
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/70 text-sm font-bold text-ds-ink dark:border-white/20 dark:bg-zinc-950/55">
                {initials}
              </div>
            )}
            <span className="truncate text-ds-body-sm font-medium text-ds-ink">{course.teacher_name ?? "Преподаватель"}</span>
          </div>
          <span className="flex shrink-0 items-center">
            <ArrowRight className="h-10 w-10 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="sr-only">Перейти к курсу</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
