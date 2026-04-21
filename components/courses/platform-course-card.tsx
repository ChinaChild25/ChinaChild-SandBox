"use client"

import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { CourseCardStatsRow } from "@/components/courses/course-card-stats-row"
import type { CourseCatalog } from "@/lib/course-catalog"
import { cn } from "@/lib/utils"

const platformVisual: Record<"hsk1" | "hsk2", { subtitle: string; bg: string }> = {
  hsk1: {
    subtitle: "Базовый курс",
    bg: "var(--ds-sage)"
  },
  hsk2: {
    subtitle: "Элементарный курс",
    bg: "var(--ds-pink)"
  }
}

export function PlatformCourseCard({ course }: { course: CourseCatalog }) {
  const ui = platformVisual[course.id]
  return (
    <Link
      href={`/teacher/courses/${course.id}`}
      className={cn(
        "ds-course-card relative block overflow-hidden text-inherit no-underline outline-offset-2",
        "focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)] dark:focus-visible:ring-white/35"
      )}
      style={{ backgroundColor: ui.bg }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-[var(--ds-radius-xl)] bg-transparent dark:bg-black/50"
      />
      <div className="relative z-[1]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-1 text-[length:var(--ds-text-6xl)] font-bold leading-none text-ds-ink">{course.name.replace("HSK", "HSK ")}</p>
            <p className="text-[length:var(--ds-text-body-lg)] text-ds-text-quaternary">{ui.subtitle}</p>
          </div>
          <div className="ds-course-card__icon-wrap">
            <BookOpen className="h-[22px] w-[22px] text-ds-ink" />
          </div>
        </div>

        <p className="mb-5 text-ds-body-sm leading-snug text-ds-text-quaternary">{course.description}</p>

        <CourseCardStatsRow
          lessons={course.lessons.length}
          newWords={course.newWordsCount}
          audio={course.audioCount}
        />

        <div className="flex items-center justify-end text-ds-ink">
          <ArrowRight className="h-10 w-10 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="sr-only">Перейти к курсу</span>
        </div>
      </div>
    </Link>
  )
}
