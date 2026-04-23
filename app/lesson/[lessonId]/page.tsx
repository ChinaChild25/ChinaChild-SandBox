"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Eye } from "lucide-react"
import type { TeacherLessonBlock } from "@/lib/types"
import { BlockRenderer } from "@/components/lesson-builder/block-renderer"

export default function StudentLessonPage() {
  const params = useParams<{ lessonId: string }>()
  const lessonId = params.lessonId
  const [title, setTitle] = useState("Урок")
  const [blocks, setBlocks] = useState<TeacherLessonBlock[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadLesson()
  }, [lessonId])

  async function loadLesson() {
    setIsLoading(true)
    const res = await fetch(`/api/lessons/${lessonId}`, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as
      | { lesson?: { title: string; task_badge_color?: string | null }; blocks?: TeacherLessonBlock[]; error?: string }
      | null
    if (!res.ok || !json?.lesson) {
      setError(json?.error ?? "Не удалось загрузить урок")
      setIsLoading(false)
      return
    }
    setError(null)
    setTitle(json.lesson.title)
    setBlocks((json.blocks ?? []).sort((a, b) => a.order - b.order))
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-[var(--ds-page)] px-3 py-4 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 sm:gap-5">
        <header className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-surface)] px-4 py-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.18)] dark:border-white/[0.08] sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ds-sage)] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-ink">
                <Eye className="h-4 w-4" />
                Превью для ученика
              </div>
              <h1 className="mt-4 text-[clamp(1.8rem,4vw,3.35rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-ds-ink">
                {title}
              </h1>
              <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-ds-text-secondary sm:text-[16px]">
                Так урок будет выглядеть для ученика после публикации. Проверяйте порядок блоков, тексты и взаимодействия прямо здесь.
              </p>
              {error ? <p className="mt-3 text-[15px] text-[#c0394b] dark:text-[#ff8c9a]">{error}</p> : null}
            </div>

            <Link
              href={`/teacher/lessons/${lessonId}`}
              className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-black/[0.08] bg-[var(--ds-surface-muted)] px-4 text-[14px] font-medium text-ds-ink transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:border-white/[0.08]"
            >
              <ArrowLeft className="h-4 w-4" />
              Вернуться в редактор
            </Link>
          </div>
        </header>

        <main className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-surface)] px-3 py-4 shadow-[0_24px_70px_-50px_rgba(0,0,0,0.22)] dark:border-white/[0.08] sm:px-5 sm:py-5 lg:px-6">
          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center text-[18px] text-ds-text-secondary">Загрузка урока...</div>
          ) : (
            <BlockRenderer blocks={blocks} />
          )}
        </main>
      </div>
    </div>
  )
}
