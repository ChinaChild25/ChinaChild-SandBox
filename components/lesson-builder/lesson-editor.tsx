"use client"

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  CircleCheckBig,
  FileText,
  ImageIcon,
  type LucideIcon,
  Loader2,
  Menu,
  Music2,
  Palette,
  PencilLine,
  PlaySquare,
  Save,
  Shuffle
} from "lucide-react"
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
  {
    key: "blue",
    label: "Синий",
    rowHover: "hover:bg-[rgb(125_176_232/0.26)] dark:hover:bg-[rgb(125_176_232/0.22)]",
    rowSelected: "bg-[rgb(125_176_232/0.14)] dark:bg-[rgb(125_176_232/0.12)]",
    swatch:
      "border-none bg-[rgb(125_176_232/0.22)] transition-colors group-hover:bg-[rgb(125_176_232/0.44)]"
  },
  {
    key: "pink",
    label: "Розовый",
    rowHover: "hover:bg-[rgb(232_135_135/0.26)] dark:hover:bg-[rgb(232_135_135/0.22)]",
    rowSelected: "bg-[rgb(232_135_135/0.14)] dark:bg-[rgb(232_135_135/0.12)]",
    swatch:
      "border border-[rgb(232_135_135/0.35)] bg-[rgb(232_135_135/0.22)] transition-colors group-hover:border-transparent group-hover:bg-[rgb(232_135_135/0.44)]"
  },
  {
    key: "yellow",
    label: "Жёлтый",
    rowHover: "hover:bg-[rgb(232_153_74/0.26)] dark:hover:bg-[rgb(232_153_74/0.22)]",
    rowSelected: "bg-[rgb(232_153_74/0.14)] dark:bg-[rgb(232_153_74/0.12)]",
    swatch:
      "border border-[rgb(232_153_74/0.35)] bg-[rgb(232_153_74/0.22)] transition-colors group-hover:border-transparent group-hover:bg-[rgb(232_153_74/0.44)]"
  },
  {
    key: "green",
    label: "Зелёный",
    rowHover: "hover:bg-[rgb(163_201_104/0.26)] dark:hover:bg-[rgb(163_201_104/0.22)]",
    rowSelected: "bg-[rgb(163_201_104/0.14)] dark:bg-[rgb(163_201_104/0.12)]",
    swatch:
      "border border-[rgb(163_201_104/0.35)] bg-[rgb(163_201_104/0.22)] transition-colors group-hover:border-transparent group-hover:bg-[rgb(163_201_104/0.44)]"
  },
  {
    key: "purple",
    label: "Фиолетовый",
    rowHover: "hover:bg-[rgb(201_157_240/0.26)] dark:hover:bg-[rgb(201_157_240/0.22)]",
    rowSelected: "bg-[rgb(201_157_240/0.14)] dark:bg-[rgb(201_157_240/0.12)]",
    swatch:
      "border border-[rgb(201_157_240/0.35)] bg-[rgb(201_157_240/0.22)] transition-colors group-hover:border-transparent group-hover:bg-[rgb(201_157_240/0.44)]"
  },
  {
    key: "red",
    label: "Красный",
    rowHover: "hover:bg-[rgb(240_120_120/0.26)] dark:hover:bg-[rgb(240_120_120/0.22)]",
    rowSelected: "bg-[rgb(240_120_120/0.14)] dark:bg-[rgb(240_120_120/0.12)]",
    swatch:
      "border border-[rgb(240_120_120/0.35)] bg-[rgb(240_120_120/0.22)] transition-colors group-hover:border-transparent group-hover:bg-[rgb(240_120_120/0.44)]"
  }
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

const LG_MEDIA_QUERY = "(min-width: 1024px)"

/** Верхняя «линия стыковки» тулбара (px): совпадает с отрицательным rootMargin IO. */
function toolbarDockOffsetPx(): number {
  if (typeof window === "undefined") return 48
  if (window.matchMedia(LG_MEDIA_QUERY).matches) return 40
  const spacer = document.querySelector<HTMLElement>(".ds-mobile-top-chrome-spacer")
  const h = spacer?.offsetHeight ?? 0
  if (h > 0) return Math.round(h + 8)
  return 88
}

/** Порог по viewport: нижняя граница якоря выше этой линии → компактный режим (линия не зависит от класса скрытия chrome). */
function dockThresholdLineY(mainEl: HTMLElement): number {
  const mr = mainEl.getBoundingClientRect()
  if (typeof window === "undefined") return mr.top + 48
  if (window.matchMedia(LG_MEDIA_QUERY).matches) {
    return mr.top + 12
  }
  const bar = document.querySelector<HTMLElement>(".ds-mobile-top-chrome__bar")
  const br = bar?.getBoundingClientRect()
  if (br && br.height > 0.5) return br.bottom + 4
  return mr.top + toolbarDockOffsetPx()
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
  const columnRef = useRef<HTMLDivElement>(null)
  const toolbarShellRef = useRef<HTMLDivElement>(null)
  const [toolbarDocked, setToolbarDocked] = useState(false)
  const [editorOverflowOpen, setEditorOverflowOpen] = useState(false)
  const [dockBarFrame, setDockBarFrame] = useState<{ top: number; left: number; width: number } | null>(null)
  const [dockedSpacerHeight, setDockedSpacerHeight] = useState(56)

  const orderedBlocks = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks])

  /**
   * Скролл идёт в main.ds-figma-shell-main-scroll; якорь перед блоками в координатах viewport.
   * Считаем компактность и позицию fixed-бара в одном rAF — одинаково на desktop и mobile.
   */
  useEffect(() => {
    if (isLoading) return

    let raf = 0
    let bootAttempts = 0
    let pendingBootRaf = 0

    const resolveMain = () => {
      const anchor = blocksScrollAnchorRef.current
      const col = columnRef.current
      return (
        anchor?.closest<HTMLElement>("main.ds-figma-shell-main-scroll") ??
        col?.closest<HTMLElement>("main.ds-figma-shell-main-scroll") ??
        null
      )
    }

    const tick = () => {
      raf = 0
      const main = resolveMain()
      const anchor = blocksScrollAnchorRef.current
      const col = columnRef.current
      if (!main || !anchor || !col) return

      const mr = main.getBoundingClientRect()
      const ar = anchor.getBoundingClientRect()
      const line = dockThresholdLineY(main)
      /** Только линия порога: якорь целиком выше линии → компакт (без сравнения с mr.bottom — оно ломало кейсы с overflow/клипом). */
      const docked = ar.bottom < line - 0.5

      const isLg = window.matchMedia(LG_MEDIA_QUERY).matches
      if (docked && !isLg) main.classList.add("ds-lesson-editor-toolbar-docked")
      else main.classList.remove("ds-lesson-editor-toolbar-docked")

      setToolbarDocked((prev) => (prev === docked ? prev : docked))

      if (docked) {
        const c = col.getBoundingClientRect()
        let top: number
        if (isLg) {
          top = mr.top
        } else if (main.classList.contains("ds-lesson-editor-toolbar-docked")) {
          top = mr.top + 10
        } else {
          const bar = document.querySelector<HTMLElement>(".ds-mobile-top-chrome__bar")
          const br = bar?.getBoundingClientRect()
          top = (br && br.height > 0.5 ? br.bottom : mr.top + toolbarDockOffsetPx()) + 4
        }
        setDockBarFrame((prev) => {
          const next = { top, left: c.left, width: c.width }
          if (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width) return prev
          return next
        })
      } else {
        setDockBarFrame((prev) => (prev === null ? prev : null))
      }
    }

    const schedule = () => {
      if (raf) return
      raf = window.requestAnimationFrame(tick)
    }

    let unsub: (() => void) | undefined
    let disposed = false

    const bindWhenReady = () => {
      if (disposed) return
      const main = resolveMain()
      if (!main) {
        bootAttempts += 1
        if (bootAttempts < 120) {
          if (pendingBootRaf) window.cancelAnimationFrame(pendingBootRaf)
          pendingBootRaf = window.requestAnimationFrame(bindWhenReady)
        }
        return
      }
      if (disposed) return

      tick()
      requestAnimationFrame(tick)

      main.addEventListener("scroll", schedule, { passive: true })
      window.addEventListener("scroll", schedule, { passive: true, capture: true })
      window.addEventListener("resize", schedule, { passive: true })

      unsub = () => {
        if (raf) window.cancelAnimationFrame(raf)
        main.removeEventListener("scroll", schedule)
        window.removeEventListener("scroll", schedule, true)
        window.removeEventListener("resize", schedule)
        main.classList.remove("ds-lesson-editor-toolbar-docked")
      }
    }

    bindWhenReady()
    return () => {
      disposed = true
      if (pendingBootRaf) window.cancelAnimationFrame(pendingBootRaf)
      unsub?.()
    }
  }, [isLoading, orderedBlocks.length])

  useLayoutEffect(() => {
    if (!toolbarDocked || isLoading) return
    const el = toolbarShellRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      if (h > 0) setDockedSpacerHeight(h)
    })
    ro.observe(el)
    const h = Math.ceil(el.getBoundingClientRect().height)
    if (h > 0) setDockedSpacerHeight(h)
    return () => ro.disconnect()
  }, [toolbarDocked, isLoading])

  useEffect(() => {
    if (!toolbarDocked) setEditorOverflowOpen(false)
  }, [toolbarDocked])

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
            className="h-10 w-10 shrink-0 text-ds-text-tertiary hover:bg-ds-surface-hover hover:text-ds-ink"
            onClick={() => void saveBlocks("manual", orderedBlocks)}
            disabled={isSaving}
            aria-label={isSaving ? "Сохранение…" : "Сохранить урок"}
          >
            {isSaving ? <Loader2 className="h-8 w-8 animate-spin" /> : <Save className="h-8 w-8" strokeWidth={2} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent variant="inverse" side="bottom">
          {isSaving ? "Сохранение…" : "Сохранить урок"}
        </TooltipContent>
      </Tooltip>
    )
  }

  function renderBadgePicker(compact: boolean, compactTriggerTitle?: string) {
    const badgeTooltip = compactTriggerTitle ?? "Цвет бейджа оглавления заданий"

    const triggerButton = (
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center transition-colors outline-none",
          compact
            ? "h-10 w-10 shrink-0 rounded-[var(--ds-radius-md)] border-0 bg-transparent text-ds-text-tertiary hover:bg-ds-surface-hover hover:text-ds-ink"
            : "gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        )}
        aria-label="Цвет бейджа оглавления заданий"
      >
        <Palette className={compact ? "h-5 w-5" : "h-3.5 w-3.5"} />
        {!compact ? <span>{badgeColorOptions.find((x) => x.key === taskBadgeColor)?.label ?? "Синий"}</span> : null}
      </button>
    )

    return (
      <Popover open={isBadgeColorOpen} onOpenChange={setIsBadgeColorOpen}>
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent variant="inverse" side="bottom" sideOffset={6}>
              {badgeTooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        )}
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
                  "group inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/15 dark:focus-visible:ring-white/20",
                  item.rowHover,
                  taskBadgeColor === item.key ? item.rowSelected : null
                )}
              >
                <span aria-hidden className={cn("h-4 w-4 shrink-0 rounded-full", item.swatch)} />
                {item.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  function renderBlockTypePickers(compact: boolean, onAfterPick?: () => void, nativeHints?: boolean) {
    return blockTypeOptions.map((item) => {
      const buttonEl = (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          title={nativeHints ? item.hint : undefined}
          className={cn("group", blockTypeAccentClass[item.type], compact && "text-[13px]")}
          onClick={() => {
            addBlock(item.type)
            onAfterPick?.()
          }}
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
      )
      if (nativeHints) {
        return (
          <Fragment key={item.type}>
            {buttonEl}
          </Fragment>
        )
      }
      return (
        <Tooltip key={item.type}>
          <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
          <TooltipContent variant="inverse">{item.hint}</TooltipContent>
        </Tooltip>
      )
    })
  }

  function renderBlockIconPickers(onAfterPick?: () => void) {
    return blockTypeOptions.map((item) => (
      <Tooltip key={item.type}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("h-9 w-9 shrink-0 rounded-xl", blockTypeAccentClass[item.type])}
            onClick={() => {
              addBlock(item.type)
              onAfterPick?.()
            }}
            aria-label={`Добавить блок: ${item.label}`}
          >
            {(() => {
              const Icon = blockTypeIcon[item.type]
              return <Icon className="h-4 w-4" />
            })()}
          </Button>
        </TooltipTrigger>
        <TooltipContent variant="inverse" side="top">
          {item.hint}
        </TooltipContent>
      </Tooltip>
    ))
  }

  if (isLoading) {
    return (
      <div className="ds-figma-page ds-lesson-editor-page">
        <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] text-sm text-ds-text-secondary">Загрузка урока...</div>
      </div>
    )
  }

  return (
    <div className="ds-figma-page ds-lesson-editor-page">
      <div ref={columnRef} className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-6">
        <Link href={courseId ? `/teacher/courses/${courseId}` : "/teacher/courses"} className="inline-flex items-center gap-1 text-sm text-ds-text-tertiary hover:text-ds-ink">
          <ChevronLeft className="h-4 w-4" />
          Назад к курсу
        </Link>

        {toolbarDocked ? <div className="shrink-0" style={{ height: dockedSpacerHeight }} aria-hidden /> : null}

        <div
          ref={toolbarShellRef}
          className={cn(
            "mb-4 transition-[margin,box-shadow,backdrop-filter,background-color] duration-300 ease-out",
            toolbarDocked && "fixed z-[40] py-1 sm:py-1.5"
          )}
          style={
            toolbarDocked && dockBarFrame
              ? { top: dockBarFrame.top, left: dockBarFrame.left, width: dockBarFrame.width }
              : undefined
          }
        >
          {toolbarDocked ? (
            <div
              className={cn(
                "w-full overflow-hidden rounded-[28px] border px-2 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.14)] backdrop-blur-2xl sm:px-3 sm:py-2.5 dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.45)]",
                "border-white/55 bg-white/60 supports-[backdrop-filter]:bg-white/45 dark:border-white/10 dark:bg-zinc-950/55 dark:supports-[backdrop-filter]:bg-zinc-950/40"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex min-h-10 min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-0.5 py-0.5",
                    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  )}
                >
                  {renderBlockIconPickers()}
                </div>
                <div className="hidden h-8 w-px shrink-0 bg-black/10 lg:block dark:bg-white/10" aria-hidden />
                <div className="hidden shrink-0 lg:block">{renderBadgePicker(true)}</div>
                {renderSaveToolbarButton()}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-[14px] border-black/10 bg-white/70 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-zinc-900/60"
                  aria-label="Все инструменты редактора урока"
                  aria-expanded={editorOverflowOpen}
                  aria-controls="lesson-editor-toolbar-overflow"
                  onClick={() => setEditorOverflowOpen((o) => !o)}
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                </Button>
              </div>
              {editorOverflowOpen ? (
                <div
                  id="lesson-editor-toolbar-overflow"
                  className="mt-2.5 max-h-[min(50svh,320px)] overflow-y-auto overscroll-y-contain border-t border-black/[0.08] pt-2.5 dark:border-white/10"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
                      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        {renderBlockTypePickers(false, () => setEditorOverflowOpen(false), true)}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 self-start lg:hidden">
                        {renderBadgePicker(
                          true,
                          "Цвет бейджа заданий в оглавлении урока — как отображается метка в списке заданий."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 rounded-[var(--ds-radius-xl)] border-0 bg-[var(--tw-gradient-to)] p-4 shadow-none dark:bg-ds-surface sm:p-5">
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
          )}
        </div>

        <div className="w-full min-w-0 space-y-5">
          <div ref={blocksScrollAnchorRef} className="h-px w-full shrink-0 scroll-mt-24" aria-hidden />
          <BlockEditors
            blocks={orderedBlocks}
            onChange={updateBlockData}
            onDelete={removeBlock}
            onMoveUp={(id) => moveBlock(id, -1)}
            onMoveDown={(id) => moveBlock(id, 1)}
          />
        </div>

        <Card className="border-0 bg-[var(--input-background)] shadow-none">
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
