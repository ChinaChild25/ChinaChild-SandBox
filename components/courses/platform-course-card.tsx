"use client"

import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { useTheme } from "next-themes"
import { CourseCardStatsRow } from "@/components/courses/course-card-stats-row"
import type { CourseCatalog } from "@/lib/course-catalog"
import {
  courseAccentForTheme,
  courseCardTextPaletteForTheme,
  courseCoverSurfaceStyleForTheme,
} from "@/lib/teacher-custom-course-form"
import { cn } from "@/lib/utils"

const platformSubtitle: Record<"hsk1" | "hsk2", string> = {
  hsk1: "Базовый курс",
  hsk2: "Элементарный курс"
}

export function PlatformCourseCard({ course }: { course: CourseCatalog }) {
  const { resolvedTheme } = useTheme()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
  const subtitle = platformSubtitle[course.id]
  const textPalette = courseCardTextPaletteForTheme(course.coverColor, isDark)
  const accentColor = courseAccentForTheme(course.accentColor, isDark)

  return (
    <Link
      href={`/teacher/courses/${course.id}`}
      className={cn(
        "ds-course-card relative block overflow-hidden text-inherit no-underline outline-offset-2",
        "focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)] dark:focus-visible:ring-white/35"
      )}
      style={courseCoverSurfaceStyleForTheme(course.coverColor, isDark)}
    >
      <div className="relative z-[1]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-1 text-[length:var(--ds-text-6xl)] font-bold leading-none" style={{ color: textPalette.text }}>
              {course.name.replace("HSK", "HSK ")}
            </p>
            <p className="text-[length:var(--ds-text-body-lg)]" style={{ color: textPalette.meta }}>{subtitle}</p>
          </div>
          <div className="ds-course-card__icon-wrap" style={{ backgroundColor: textPalette.iconBg }}>
            <BookOpen className="h-[22px] w-[22px]" style={{ color: textPalette.text }} />
          </div>
        </div>

        <p className="mb-5 text-ds-body-sm leading-snug" style={{ color: textPalette.helper }}>{course.description}</p>

        <CourseCardStatsRow
          lessons={course.lessons.length}
          newWords={course.newWordsCount}
          audio={course.audioCount}
          valueColor={textPalette.text}
          labelColor={textPalette.helper}
        />

        <div className="flex items-center justify-end" style={{ color: accentColor }}>
          <ArrowRight className="h-10 w-10 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="sr-only">Перейти к курсу</span>
        </div>
      </div>
    </Link>
  )
}
