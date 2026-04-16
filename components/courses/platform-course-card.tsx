"use client"

import Link from "next/link"
import { BookOpen, ChevronRight } from "lucide-react"
import type { CourseCatalog } from "@/lib/course-catalog"

const platformVisual: Record<
  "hsk1" | "hsk2",
  { subtitle: string; words: string; progress: number; completed: number; bg: string; accent: string }
> = {
  hsk1: {
    subtitle: "Базовый курс",
    words: "150 слов",
    progress: 37,
    completed: 7,
    bg: "var(--ds-sage)",
    accent: "var(--ds-sage-strong)"
  },
  hsk2: {
    subtitle: "Элементарный курс",
    words: "300 слов",
    progress: 0,
    completed: 0,
    bg: "var(--ds-pink)",
    accent: "var(--ds-pink-strong)"
  }
}

export function PlatformCourseCard({ course }: { course: CourseCatalog }) {
  const ui = platformVisual[course.id]
  return (
    <Link
      href={`/teacher/courses/${course.id}`}
      className="ds-course-card block text-inherit no-underline outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)]"
      style={{ backgroundColor: ui.bg }}
    >
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

      <div className="mb-5 flex items-center gap-6">
        <div className="text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{ui.completed}</p>
          <p className="text-ds-sm text-ds-text-secondary">пройдено</p>
        </div>
        <div className="text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{course.lessons.length}</p>
          <p className="text-ds-sm text-ds-text-secondary">уроков</p>
        </div>
        <div className="text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{ui.words}</p>
          <p className="text-ds-sm text-ds-text-secondary">словарь</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex justify-between">
          <span className="text-[13px] text-[#555555] dark:text-ds-text-tertiary">Прогресс</span>
          <span className="text-[13px] font-semibold text-ds-ink">{ui.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/60">
          <div className="h-full rounded-full transition-all" style={{ width: `${ui.progress}%`, backgroundColor: ui.accent }} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-ds-body text-ds-ink">
        <span>Перейти к курсу</span>
        <ChevronRight className="h-[18px] w-[18px]" />
      </div>
    </Link>
  )
}
