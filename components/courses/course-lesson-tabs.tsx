"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"

import type { TeacherLesson } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Props = {
  lessons: TeacherLesson[]
  /** Текущий открытый урок в редакторе; на странице курса — `null`. */
  activeLessonId: string | null
  onRequestDelete: (lessonId: string) => void
}

export function CourseLessonTabs({ lessons, activeLessonId, onRequestDelete }: Props) {
  const orderedLessons = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), [lessons])

  return (
    <nav className="flex flex-col gap-2" aria-label="Уроки курса">
      {orderedLessons.map((lesson, index) => {
        const isActive = activeLessonId !== null && lesson.id === activeLessonId
        return (
          <div
            key={lesson.id}
            className={cn(
              "relative z-0 flex items-center gap-2 rounded-[20px] p-4",
              "bg-white dark:bg-ds-surface-pill",
              "transition-[transform,box-shadow] duration-200 ease-out",
              "hover:z-10 hover:-translate-y-0.5",
              "hover:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_36px_-4px_rgba(0,0,0,0.55)]",
              isActive && "shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
            )}
          >
            <Link
              href={`/teacher/lessons/${lesson.id}`}
              className={cn(
                "flex min-w-0 flex-1 cursor-pointer items-center gap-4 no-underline transition-colors",
                "text-ds-body leading-tight text-ds-ink",
                isActive && "font-semibold"
              )}
            >
              <span className="truncate text-[22px]">
                {index + 1}. {lesson.title}
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-ds-text-tertiary hover:text-red-400"
              aria-label={`Удалить урок «${lesson.title}»`}
              onClick={(e) => {
                e.preventDefault()
                onRequestDelete(lesson.id)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      })}
    </nav>
  )
}
