"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { TeacherLessonBlock } from "@/lib/types"
import { BlockRenderer } from "@/components/lesson-builder/block-renderer"

export default function StudentLessonPage() {
  const params = useParams<{ lessonId: string }>()
  const [title, setTitle] = useState("Урок")
  const [taskBadgeColor, setTaskBadgeColor] = useState<string>("blue")
  const [blocks, setBlocks] = useState<TeacherLessonBlock[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadLesson()
  }, [params.lessonId])

  async function loadLesson() {
    const res = await fetch(`/api/lessons/${params.lessonId}`, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as
      | { lesson?: { title: string; task_badge_color?: string | null }; blocks?: TeacherLessonBlock[]; error?: string }
      | null
    if (!res.ok || !json?.lesson) {
      setError(json?.error ?? "Не удалось загрузить урок")
      return
    }
    setTitle(json.lesson.title)
    setTaskBadgeColor(json.lesson.task_badge_color || "blue")
    setBlocks((json.blocks ?? []).sort((a, b) => a.order - b.order))
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-ds-ink">{title}</h1>
          {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
        </header>
        <BlockRenderer blocks={blocks} taskBadgeColor={taskBadgeColor} />
      </div>
    </div>
  )
}
