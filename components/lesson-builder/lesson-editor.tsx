"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, CircleCheckBig, FileText, ImageIcon, type LucideIcon, Loader2, Music2, Palette, PencilLine, PlaySquare, Save, Shuffle } from "lucide-react"
import type { LessonBlockType, TeacherLessonBlock } from "@/lib/types"
import { BlockEditors, createDefaultBlockData } from "@/components/lesson-builder/block-editors"
import { BlockRenderer } from "@/components/lesson-builder/block-renderer"
import { blockTypeAccentClass } from "@/components/lesson-builder/block-theme"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const blockTypeOptions: Array<{ type: LessonBlockType; label: string; hint: string }> = [
  { type: "text", label: "Текст", hint: "Теория и пояснения для ученика." },
  { type: "matching", label: "Сопоставление", hint: "Пары слов или фраз." },
  { type: "fill_gaps", label: "Пропуски", hint: "Текст с пропусками `[]`." },
  { type: "quiz_single", label: "Тест", hint: "Один верный вариант ответа." },
  { type: "image", label: "Картинка", hint: "Ссылка на изображение и подпись." },
  { type: "video", label: "Видео", hint: "YouTube, Vimeo или прямая ссылка на файл." },
  { type: "audio", label: "Аудио", hint: "Запись или ссылка и подпись." }
]

const badgeColorOptions = [
  { key: "blue", label: "Синий", rgb: "125 176 232" },
  { key: "pink", label: "Розовый", rgb: "232 135 135" },
  { key: "yellow", label: "Жёлтый", rgb: "232 153 74" },
  { key: "green", label: "Зелёный", rgb: "163 201 104" },
  { key: "purple", label: "Фиолетовый", rgb: "201 157 240" },
  { key: "red", label: "Красный", rgb: "240 120 120" }
] as const

const blockTypeIcon: Record<LessonBlockType, LucideIcon> = {
  text: FileText,
  matching: Shuffle,
  fill_gaps: PencilLine,
  quiz_single: CircleCheckBig,
  image: ImageIcon,
  video: PlaySquare,
  audio: Music2
}

export function LessonEditor({ lessonId }: { lessonId: string }) {
  const [title, setTitle] = useState("")
  const [courseId, setCourseId] = useState("")
  const [taskBadgeColor, setTaskBadgeColor] = useState<string>("blue")
  const [blocks, setBlocks] = useState<TeacherLessonBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBadgeColorOpen, setIsBadgeColorOpen] = useState(false)
  const saveInFlightRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const blocksRef = useRef<TeacherLessonBlock[]>([])
  const lastSavedSnapshotRef = useRef("")
  const blocksScrollAnchorRef = useRef<HTMLDivElement>(null)
  const [toolbarDocked, setToolbarDocked] = useState(false)

  const orderedBlocks = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks])

  const updateToolbarDocked = useCallback(() => {
    const scrollRoot = document.querySelector<HTMLElement>("main.ds-figma-shell-main-scroll")
    const anchor = blocksScrollAnchorRef.current
    if (!scrollRoot || !anchor) return
    const rootRect = scrollRoot.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    const offset = 56
    setToolbarDocked(anchorRect.top <= rootRect.top + offset)
  }, [])

  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>("main.ds-figma-shell-main-scroll")
    if (!scrollRoot) return
    scrollRoot.addEventListener("scroll", updateToolbarDocked, { passive: true })
    window.addEventListener("resize", updateToolbarDocked)
    updateToolbarDocked()
    return () => {
      scrollRoot.removeEventListener("scroll", updateToolbarDocked)
      window.removeEventListener("resize", updateToolbarDocked)
    }
  }, [updateToolbarDocked, isLoading, orderedBlocks.length])

  useLayoutEffect(() => {
    if (isLoading) return
    updateToolbarDocked()
  }, [isLoading, orderedBlocks.length, updateToolbarDocked])

  function snapshotForSave(nextBlocks: TeacherLessonBlock[]): string {
    return JSON.stringify(
      nextBlocks.map((block, index) => ({
        type: block.type,
        order: index,
        data: block.data ?? {}
      }))
    )
  }

  useEffect(() => {
    blocksRef.current = orderedBlocks
  }, [orderedBlocks])

  useEffect(() => {
    void loadLesson()
  }, [lessonId])

  useEffect(() => {
    if (isLoading) return
    const snapshot = snapshotForSave(orderedBlocks)
    if (snapshot === lastSavedSnapshotRef.current) return
    const timer = window.setTimeout(() => {
      void saveBlocks("autosave", orderedBlocks)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [orderedBlocks, isLoading])

  async function loadLesson() {
    setIsLoading(true)
    setError(null)
    const [lessonRes, blocksRes] = await Promise.all([
      fetch(`/api/teacher/lessons/${lessonId}`, { cache: "no-store" }),
      fetch(`/api/teacher/lessons/${lessonId}/blocks`, { cache: "no-store" })
    ])

    const lessonJson = (await lessonRes.json().catch(() => null)) as
      | { lesson?: { id: string; title: string; course_id: string; task_badge_color?: string | null }; error?: string }
      | null
    const blocksJson = (await blocksRes.json().catch(() => null)) as
      | { blocks?: TeacherLessonBlock[]; error?: string }
      | null

    if (!lessonRes.ok || !lessonJson?.lesson) {
      setError(lessonJson?.error ?? "Не удалось загрузить урок")
      setIsLoading(false)
      return
    }
    if (!blocksRes.ok) {
      setError(blocksJson?.error ?? "Не удалось загрузить блоки")
      setIsLoading(false)
      return
    }

    setTitle(lessonJson.lesson.title)
    setCourseId(lessonJson.lesson.course_id)
    setTaskBadgeColor(lessonJson.lesson.task_badge_color || "blue")
    const serverBlocks = (blocksJson?.blocks ?? []).sort((a, b) => a.order - b.order)
    setBlocks(serverBlocks)
    lastSavedSnapshotRef.current = snapshotForSave(serverBlocks)
    setIsLoading(false)
  }

  async function saveTitle(nextTitle: string) {
    const safeTitle = nextTitle.trim()
    if (!safeTitle) return
    await fetch(`/api/teacher/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: safeTitle })
    })
  }

  async function saveTaskBadgeColor(next: string) {
    const safe = next.trim()
    if (!safe) return
    await fetch(`/api/teacher/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskBadgeColor: safe })
    })
  }

  async function saveBlocks(source: "manual" | "autosave" | "pending" = "manual", candidateBlocks?: TeacherLessonBlock[]) {
    const nextBlocks = candidateBlocks ?? blocksRef.current
    const nextSnapshot = snapshotForSave(nextBlocks)
    if (nextSnapshot === lastSavedSnapshotRef.current && source !== "manual") return
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true
      return
    }
    if (isLoading) return
    saveInFlightRef.current = true
    setIsSaving(true)
    const res = await fetch(`/api/teacher/lessons/${lessonId}/blocks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: nextBlocks.map((block, index) => ({
          type: block.type,
          order: index,
          data: block.data
        }))
      })
    })
    const json = (await res.json().catch(() => null)) as { blocks?: TeacherLessonBlock[]; error?: string } | null
    if (!res.ok) {
      setError(json?.error ?? "Не удалось сохранить блоки")
      saveInFlightRef.current = false
      setIsSaving(false)
      return
    }
    lastSavedSnapshotRef.current = nextSnapshot
    saveInFlightRef.current = false
    setIsSaving(false)
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false
      void saveBlocks("pending", blocksRef.current)
    }
  }

  function addBlock(type: LessonBlockType) {
    setBlocks((prev) => {
      const next = [
        ...prev,
        {
          id: `tmp-${crypto.randomUUID()}`,
          lesson_id: lessonId,
          type,
          order: prev.length,
          data: createDefaultBlockData(type)
        }
      ]
      return next
    })
  }

  function updateBlockData(id: string, data: Record<string, unknown>) {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, data } : block)))
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id).map((block, index) => ({ ...block, order: index })))
  }

  function moveBlock(id: string, delta: -1 | 1) {
    setBlocks((prev) => {
      const currentIndex = prev.findIndex((block) => block.id === id)
      if (currentIndex < 0) return prev
      const nextIndex = currentIndex + delta
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(currentIndex, 1)
      if (!moved) return prev
      copy.splice(nextIndex, 0, moved)
      return copy.map((item, index) => ({ ...item, order: index }))
    })
  }

  function renderSaveToolbarButton() {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-ds-text-tertiary hover:bg-ds-surface-hover hover:text-ds-ink"
            onClick={() => void saveBlocks("manual", orderedBlocks)}
            disabled={isSaving}
            aria-label={isSaving ? "Сохранение…" : "Сохранить урок"}
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{isSaving ? "Сохранение…" : "Сохранить"}</TooltipContent>
      </Tooltip>
    )
  }

  function renderBadgePicker(compact: boolean) {
    return (
      <Popover open={isBadgeColorOpen} onOpenChange={setIsBadgeColorOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-border/70 transition-colors hover:bg-muted",
              compact
                ? "h-9 w-9 shrink-0 bg-background/80 dark:bg-ds-surface/80"
                : "gap-2 bg-background px-3 py-1.5 text-xs font-medium"
            )}
            aria-label="Цвет бейджа оглавления заданий"
          >
            <Palette className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} />
            {!compact ? <span>{badgeColorOptions.find((x) => x.key === taskBadgeColor)?.label ?? "Синий"}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-3 gap-2">
            {badgeColorOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTaskBadgeColor(item.key)
                  void saveTaskBadgeColor(item.key)
                  setIsBadgeColorOpen(false)
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                  taskBadgeColor === item.key ? "border-border bg-muted" : "border-border/70 hover:bg-muted/50"
                )}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-full border"
                  style={{
                    backgroundColor: `rgb(${item.rgb} / 0.22)`,
                    borderColor: `rgb(${item.rgb} / 0.35)`
                  }}
                />
                {item.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  function renderBlockTypePickers(compact: boolean) {
    return blockTypeOptions.map((item) => (
      <Tooltip key={item.type}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn("group", blockTypeAccentClass[item.type], compact && "text-[13px]")}
            onClick={() => addBlock(item.type)}
          >
            {(() => {
              const Icon = blockTypeIcon[item.type]
              return (
                <span className="mr-1.5 inline-flex items-center">
                  <Icon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110" />
                </span>
              )
            })()}
            {item.label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{item.hint}</TooltipContent>
      </Tooltip>
    ))
  }

  if (isLoading) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] text-sm text-ds-text-secondary">Загрузка урока...</div>
      </div>
    )
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-6">
        <Link href={courseId ? `/teacher/courses/${courseId}` : "/teacher/courses"} className="inline-flex items-center gap-1 text-sm text-ds-text-tertiary hover:text-ds-ink">
          <ChevronLeft className="h-4 w-4" />
          Назад к курсу
        </Link>

        <div
          className={cn(
            "sticky top-0 z-40 mb-4 transition-[margin,box-shadow,backdrop-filter,background-color,border-color] duration-300 ease-out",
            toolbarDocked &&
              "border-b border-white/55 bg-white/60 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/55 dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:bg-white/45 dark:supports-[backdrop-filter]:bg-zinc-950/40"
          )}
        >
          {toolbarDocked ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-0">
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:gap-2">{renderBlockTypePickers(true)}</div>
              <div className="flex shrink-0 items-center gap-1.5">
                {renderBadgePicker(true)}
                {renderSaveToolbarButton()}
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--ds-radius-xl)] border border-black/[0.07] bg-zinc-200/60 p-2 dark:border-white/10 dark:bg-zinc-800/40 sm:p-3">
              <div className="space-y-4 rounded-[var(--ds-radius-xl)] border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ds-surface sm:p-5">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <PencilLine className="h-5 w-5 shrink-0 text-ds-text-tertiary" aria-hidden />
                    <CardTitle className="min-w-0">Редактор урока</CardTitle>
                  </div>
                  {renderSaveToolbarButton()}
                </div>

                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void saveTitle(title)}
                  placeholder="Название урока"
                  className="h-12 min-h-12"
                />

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Цвет бейджа оглавления заданий</p>
                  {renderBadgePicker(false)}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-4 dark:border-white/10">
                  {renderBlockTypePickers(false)}
                </div>
              </div>
            </div>
          )}
        </div>

        <Card className="gap-0 border-0 bg-ds-surface-muted py-0">
          <CardContent className="space-y-5 py-6">
            <div ref={blocksScrollAnchorRef} className="h-px w-full shrink-0 scroll-mt-24" aria-hidden />
            <BlockEditors
              blocks={orderedBlocks}
              onChange={updateBlockData}
              onDelete={removeBlock}
              onMoveUp={(id) => moveBlock(id, -1)}
              onMoveDown={(id) => moveBlock(id, 1)}
            />
          </CardContent>
        </Card>

        <Card className="border-0 bg-ds-surface-muted">
          <CardHeader>
            <CardTitle>Предпросмотр для ученика</CardTitle>
          </CardHeader>
          <CardContent>
            <BlockRenderer blocks={orderedBlocks} taskBadgeColor={taskBadgeColor} />
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  )
}
