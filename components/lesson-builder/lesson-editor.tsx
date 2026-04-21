"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  CircleCheckBig,
  FileText,
  ImageIcon,
  Link2,
  type LucideIcon,
  Loader2,
  Menu,
  Minus,
  Music2,
  Palette,
  PencilLine,
  PlaySquare,
  Save,
  StickyNote,
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

declare global {
  interface Window {
    __dsPreviewVisibleProbeInstalled?: boolean
    __dsPreviewTrajectoryCaptureInstalled?: boolean
    __dsPreviewTrajectoryStart?: { optionId: string; xPct: number; yPct: number }
  }
}

type BlockCategoryId = "images" | "media" | "words_and_gaps" | "tests" | "right_answer" | "ordering" | "text_work" | "other"
type BlockOption = {
  id: string
  type: LessonBlockType
  label: string
  hint: string
  category: BlockCategoryId
}

const CATEGORY_LABEL: Record<BlockCategoryId, string> = {
  images: "Изображения",
  media: "Аудио и видео",
  words_and_gaps: "Слова и пропуски",
  tests: "Тесты",
  right_answer: "Выбор правильного ответа",
  ordering: "Расставить в правильном порядке",
  text_work: "Работа с текстом",
  other: "С прочим"
}

const blockTypeOptions: BlockOption[] = [
  { id: "images-stack", type: "image", label: "Изображение друг под другом", hint: "Несколько изображений в ленте.", category: "images" },
  { id: "images-carousel", type: "image", label: "Изображение в карусели", hint: "Переключаемые изображения.", category: "images" },
  { id: "images-gif", type: "image", label: "GIF анимация", hint: "Анимированное изображение.", category: "images" },

  { id: "media-video", type: "video", label: "Видео", hint: "Видео фрагмент по теме.", category: "media" },
  { id: "media-audio-playback", type: "audio", label: "Аудиозапись", hint: "Готовый аудиотрек для прослушивания.", category: "media" },
  { id: "media-audio-record", type: "audio", label: "Запись аудио", hint: "Записываемое голосовое задание.", category: "media" },

  { id: "fill-drag-word", type: "fill_gaps", label: "Перенести слово к пропуску", hint: "Заполнение пропусков словами из банка.", category: "words_and_gaps" },
  { id: "fill-type-word", type: "fill_gaps", label: "Внести слово в пропуск", hint: "Пропуски с ручным вводом слов.", category: "words_and_gaps" },
  { id: "fill-choose-form", type: "fill_gaps", label: "Выбрать форму слова к пропуску", hint: "Подбор корректной словоформы.", category: "words_and_gaps" },
  { id: "fill-image-drag", type: "fill_gaps", label: "Перенести слово к изображению", hint: "Связать слово и картинку.", category: "words_and_gaps" },
  { id: "fill-image-type", type: "fill_gaps", label: "Ввести слово к изображению", hint: "Подпись к картинке вручную.", category: "words_and_gaps" },
  { id: "fill-image-form", type: "fill_gaps", label: "Выбрать форму слова к изображению", hint: "Подбор словоформы к изображению.", category: "words_and_gaps" },

  { id: "quiz-no-timer", type: "quiz_single", label: "Тест без таймера", hint: "Обычный тест с одним ответом.", category: "tests" },
  { id: "quiz-timer", type: "quiz_single", label: "Тест с таймером", hint: "Тест с ограничением по времени.", category: "tests" },

  { id: "answer-true-false-unknown", type: "quiz_single", label: "Ложь, истина, не определено", hint: "3 варианта оценки утверждения.", category: "right_answer" },

  { id: "order-sentence", type: "matching", label: "Предложение из слов", hint: "Собрать правильное предложение.", category: "ordering" },
  { id: "order-columns", type: "matching", label: "Отсортировать слова по колонкам", hint: "Разнести слова по категориям.", category: "ordering" },
  { id: "order-text", type: "matching", label: "Расставить текст по порядку", hint: "Упорядочить фрагменты текста.", category: "ordering" },
  { id: "order-letters", type: "matching", label: "Составить слово из букв", hint: "Собрать слово из букв.", category: "ordering" },
  { id: "order-match-words", type: "matching", label: "Сопоставить слова", hint: "Соотнести элементы в пары.", category: "ordering" },

  { id: "text-article", type: "text", label: "Статья", hint: "Информационный текст для чтения.", category: "text_work" },
  { id: "text-essay", type: "text", label: "Сочинение", hint: "Авторский текст с акцентом на понимание.", category: "text_work" },
  { id: "text-default", type: "text", label: "Текст", hint: "Базовый текстовый блок урока.", category: "text_work" },

  { id: "other-wordset", type: "note", label: "Набор слов для изучения", hint: "Список слов/лексики для отработки.", category: "other" },
  { id: "other-note", type: "note", label: "Заметка", hint: "Инфоблок с важной подсказкой.", category: "other" },
  { id: "other-link", type: "link", label: "Ссылка", hint: "Переход на внешний материал.", category: "other" },
  { id: "other-divider", type: "divider", label: "Разделяющая линия", hint: "Визуально отделяет этапы урока.", category: "other" }
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
      "border-none bg-[rgb(232_135_135/0.22)] transition-colors"
  },
  {
    key: "yellow",
    label: "Жёлтый",
    rowHover: "hover:bg-[rgb(232_153_74/0.26)] dark:hover:bg-[rgb(232_153_74/0.22)]",
    rowSelected: "bg-[rgb(232_153_74/0.14)] dark:bg-[rgb(232_153_74/0.12)]",
    swatch:
      "border-0 bg-[rgb(232_153_74/0.22)] transition-colors group-hover:bg-[rgb(232_153_74/0.44)]"
  },
  {
    key: "green",
    label: "Зелёный",
    rowHover: "hover:bg-[rgb(163_201_104/0.26)] dark:hover:bg-[rgb(163_201_104/0.22)]",
    rowSelected: "bg-[rgb(163_201_104/0.14)] dark:bg-[rgb(163_201_104/0.12)]",
    swatch:
      "border-0 bg-[rgb(163_201_104/0.22)] transition-colors group-hover:bg-[rgb(163_201_104/0.44)]"
  },
  {
    key: "purple",
    label: "Фиолетовый",
    rowHover: "hover:bg-[rgb(201_157_240/0.26)] dark:hover:bg-[rgb(201_157_240/0.22)]",
    rowSelected: "bg-[rgb(201_157_240/0.14)] dark:bg-[rgb(201_157_240/0.12)]",
    swatch:
      "border-0 bg-[rgb(201_157_240/0.22)] transition-colors group-hover:bg-[rgb(201_157_240/0.44)]"
  },
  {
    key: "red",
    label: "Красный",
    rowHover: "hover:bg-[rgb(240_120_120/0.26)] dark:hover:bg-[rgb(240_120_120/0.22)]",
    rowSelected: "bg-[rgb(240_120_120/0.14)] dark:bg-[rgb(240_120_120/0.12)]",
    swatch: "border-0 bg-[var(--ds-pink)] transition-colors"
  }
] as const

const blockTypeIcon: Record<LessonBlockType, LucideIcon> = {
  text: FileText,
  matching: Shuffle,
  fill_gaps: PencilLine,
  quiz_single: CircleCheckBig,
  image: ImageIcon,
  video: PlaySquare,
  audio: Music2,
  note: StickyNote,
  link: Link2,
  divider: Minus
}

function BlockTypePreview({ optionId }: { optionId: string }) {
  const optionShellClass = `ds-preview-option-${optionId}`
  const shellClass = cn(
    "ds-preview-shell relative h-[12rem] overflow-hidden rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] p-4 text-[14px] leading-snug text-ds-ink shadow-none",
    optionShellClass
  )
  const solidBtnClass =
    "inline-flex h-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-black px-3 text-[13px] font-semibold text-white dark:bg-white dark:text-black"
  const softFieldClass = "rounded-[var(--ds-radius-md)] bg-white/85 px-3 py-2 text-[13px] text-ds-text-secondary"
  const softChipClass = "rounded-[var(--ds-radius-sm)] bg-black/[0.05] px-2.5 py-1 text-[13px] text-ds-ink"
  const chips = (arr: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {arr.map((w) => (
        <span key={w} className={softChipClass}>
          {w}
        </span>
      ))}
    </div>
  )
  const optionIdsWithoutCursor = new Set<string>([
    "images-carousel",
    "images-gif",
    "media-video",
    "media-audio-playback",
    "media-audio-record",
    "text-article",
    "text-essay",
    "text-default",
    "other-wordset",
    "other-note",
    "other-divider"
  ])
  const cursor = (variant: string) => {
    if (optionIdsWithoutCursor.has(optionId)) return null
    const variantClassMap: Record<string, string> = {
      click: "ds-preview-cursor--click",
      drag: "ds-preview-cursor--drag",
      match: "ds-preview-cursor--match",
      order: "ds-preview-cursor--order",
      audio: "ds-preview-cursor--audio",
      "ds-preview-cursor--drag-word": "ds-preview-cursor--drag-word",
      "ds-preview-cursor--select": "ds-preview-cursor--select",
      "ds-preview-cursor--checkbox": "ds-preview-cursor--checkbox",
      "ds-preview-cursor--order-word": "ds-preview-cursor--order-word",
      "ds-preview-cursor--match-word": "ds-preview-cursor--match-word",
      "ds-preview-cursor--image-drag": "ds-preview-cursor--image-drag",
      "ds-preview-cursor--image-type": "ds-preview-cursor--image-type",
      "ds-preview-cursor--image-form": "ds-preview-cursor--image-form",
      "ds-preview-cursor--answer-tfu": "ds-preview-cursor--answer-tfu",
      "ds-preview-cursor--order-columns": "ds-preview-cursor--order-columns",
      "ds-preview-cursor--order-text": "ds-preview-cursor--order-text",
      "ds-preview-cursor--order-letters": "ds-preview-cursor--order-letters"
    }
    const resolvedClass = variantClassMap[variant] ?? "ds-preview-cursor--click"
    return <span className={`ds-preview-cursor ${resolvedClass}`} data-preview-cursor={resolvedClass} aria-hidden />
  }

  useLayoutEffect(() => {
    const shells = Array.from(document.querySelectorAll<HTMLElement>(`.${optionShellClass}`))
    const visibleShells = shells
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 240 && rect.height > 140 && rect.bottom > 0 && rect.top < window.innerHeight)
    const shell = (visibleShells[0]?.el ?? shells[shells.length - 1]) ?? null
    if (!shell) return
    const cursorEl = shell.querySelector<HTMLElement>("[data-preview-cursor]")
    const trackedSelectors = [
      ".ds-preview-checkbox",
      ".ds-preview-drop-slot",
      ".ds-preview-select-field",
      ".ds-preview-order-slot",
      ".ds-preview-link-line",
      ".ds-preview-choice-row--selected .ds-preview-checkbox",
      ".ds-preview-image-drop-target",
      ".ds-preview-image-type-target",
      ".ds-preview-image-form-target",
      ".ds-preview-answer-target",
      ".ds-preview-column-target",
      ".ds-preview-order-text-target",
      ".ds-preview-letter-slot"
    ]
    const targetRects = trackedSelectors
      .map((selector) => {
        const el = shell.querySelector<HTMLElement>(selector)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { selector, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
      })
      .filter(Boolean)
    const targetQueryCounts = {
      imageDrop: shell.querySelectorAll(".ds-preview-image-drop-target").length,
      imageType: shell.querySelectorAll(".ds-preview-image-type-target").length,
      imageForm: shell.querySelectorAll(".ds-preview-image-form-target").length,
      answer: shell.querySelectorAll(".ds-preview-answer-target").length,
      columns: shell.querySelectorAll(".ds-preview-column-target").length,
      orderText: shell.querySelectorAll(".ds-preview-order-text-target").length,
      letterSlot: shell.querySelectorAll(".ds-preview-letter-slot").length
    }
    const shellRect = shell.getBoundingClientRect()
    const cursorRect = cursorEl?.getBoundingClientRect()
    const cursorStyle = cursorEl ? window.getComputedStyle(cursorEl) : null
    // #region agent log
    fetch("http://127.0.0.1:7499/ingest/f73dd0bc-9f26-43e4-9b01-58403a9c7eee", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e3e11d" },
      body: JSON.stringify({
        sessionId: "e3e11d",
        runId: "pre-fix",
        hypothesisId: "H1-H5",
        location: "components/lesson-builder/lesson-editor.tsx:BlockTypePreview.useLayoutEffect",
        message: "Preview cursor alignment snapshot",
        data: {
          optionId,
          shellCandidateCount: shells.length,
          visibleShellCount: visibleShells.length,
          cursorEnabled: Boolean(cursorEl),
          cursorClass: cursorEl?.dataset.previewCursor ?? null,
          cursorAnimationName: cursorStyle?.animationName ?? null,
          cursorX: cursorRect ? Math.round(cursorRect.left) : null,
          cursorY: cursorRect ? Math.round(cursorRect.top) : null,
          cursorW: cursorRect ? Math.round(cursorRect.width) : null,
          cursorH: cursorRect ? Math.round(cursorRect.height) : null,
          shellX: Math.round(shellRect.left),
          shellY: Math.round(shellRect.top),
          shellW: Math.round(shellRect.width),
          shellH: Math.round(shellRect.height),
          dpr: window.devicePixelRatio,
          targets: targetRects,
          targetQueryCounts
        },
        timestamp: Date.now()
      })
    }).catch(() => {})
    // #endregion
  }, [optionId, optionShellClass])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.__dsPreviewVisibleProbeInstalled) return
    window.__dsPreviewVisibleProbeInstalled = true
    let rafId = 0
    const probe = () => {
      const visibleShells = Array.from(document.querySelectorAll<HTMLElement>(".ds-preview-shell"))
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 240 && rect.height > 140 && rect.bottom > 0 && rect.top < window.innerHeight)
      visibleShells.forEach(({ el, rect }) => {
        const cursorEl = el.querySelector<HTMLElement>("[data-preview-cursor]")
        if (!cursorEl) return
        const optionClass = Array.from(el.classList).find((cls) => cls.startsWith("ds-preview-option-")) ?? null
        const optionId = optionClass ? optionClass.replace("ds-preview-option-", "") : null
        const cursorRect = cursorEl.getBoundingClientRect()
        const targets = [".ds-preview-checkbox", ".ds-preview-drop-slot", ".ds-preview-select-field", ".ds-preview-order-slot", ".ds-preview-link-line"]
          .map((selector) => {
            const t = el.querySelector<HTMLElement>(selector)
            if (!t) return null
            const tr = t.getBoundingClientRect()
            return { selector, x: Math.round(tr.left), y: Math.round(tr.top), w: Math.round(tr.width), h: Math.round(tr.height) }
          })
          .filter(Boolean)
        const targetQueryCounts = {
          imageDrop: el.querySelectorAll(".ds-preview-image-drop-target").length,
          imageType: el.querySelectorAll(".ds-preview-image-type-target").length,
          imageForm: el.querySelectorAll(".ds-preview-image-form-target").length,
          answer: el.querySelectorAll(".ds-preview-answer-target").length,
          columns: el.querySelectorAll(".ds-preview-column-target").length,
          orderText: el.querySelectorAll(".ds-preview-order-text-target").length,
          letterSlot: el.querySelectorAll(".ds-preview-letter-slot").length
        }
        const animatedProbeSelectors = [
          ".ds-preview-chip-drag",
          ".ds-preview-drop-answer",
          ".ds-preview-drop-placeholder",
          ".ds-preview-drop-slot",
          ".ds-preview-choice-row--selected .ds-preview-checkbox",
          ".ds-preview-select-value",
          ".ds-preview-select-menu",
          ".ds-preview-order-token",
          ".ds-preview-order-slot",
          ".ds-preview-link-line"
        ]
        const animatedProbes = animatedProbeSelectors
          .map((selector) => {
            const node = el.querySelector<HTMLElement>(selector)
            if (!node) return null
            const cs = window.getComputedStyle(node)
            return {
              selector,
              animationName: cs.animationName,
              animationDuration: cs.animationDuration,
              opacity: cs.opacity,
              transform: cs.transform,
              backgroundColor: cs.backgroundColor
            }
          })
          .filter(Boolean)
        const dragGeometry =
          optionId === "fill-drag-word"
            ? (() => {
                const chip = el.querySelector<HTMLElement>(".ds-preview-chip-drag")
                const slot = el.querySelector<HTMLElement>(".ds-preview-drop-slot")
                if (!chip || !slot) return null
                const chipRect = chip.getBoundingClientRect()
                const slotRect = slot.getBoundingClientRect()
                const cs = window.getComputedStyle(chip)
                return {
                  chipCenterX: Math.round(chipRect.left + chipRect.width / 2),
                  chipCenterY: Math.round(chipRect.top + chipRect.height / 2),
                  slotCenterX: Math.round(slotRect.left + slotRect.width / 2),
                  slotCenterY: Math.round(slotRect.top + slotRect.height / 2),
                  requiredDeltaX: Math.round(slotRect.left + slotRect.width / 2 - (chipRect.left + chipRect.width / 2)),
                  requiredDeltaY: Math.round(slotRect.top + slotRect.height / 2 - (chipRect.top + chipRect.height / 2)),
                  chipTransform: cs.transform
                }
              })()
            : null
        // #region agent log
        fetch("http://127.0.0.1:7499/ingest/f73dd0bc-9f26-43e4-9b01-58403a9c7eee", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e3e11d" },
          body: JSON.stringify({
            sessionId: "e3e11d",
            runId: "pre-fix",
            hypothesisId: "H6",
            location: "components/lesson-builder/lesson-editor.tsx:visible-shell-probe",
            message: "Visible preview shell probe",
            data: {
              optionId,
              shellClass: el.className,
              shellX: Math.round(rect.left),
              shellY: Math.round(rect.top),
              shellW: Math.round(rect.width),
              shellH: Math.round(rect.height),
              cursorClass: cursorEl.dataset.previewCursor ?? null,
              cursorX: Math.round(cursorRect.left),
              cursorY: Math.round(cursorRect.top),
              cursorW: Math.round(cursorRect.width),
              cursorH: Math.round(cursorRect.height),
              targets,
              targetQueryCounts,
              animatedProbes,
              dragGeometry
            },
            timestamp: Date.now()
          })
        }).catch(() => {})
        // #endregion
      })
    }
    let remaining = 6
    const tick = () => {
      probe()
      remaining -= 1
      if (remaining > 0) rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      window.__dsPreviewVisibleProbeInstalled = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.__dsPreviewTrajectoryCaptureInstalled) return
    window.__dsPreviewTrajectoryCaptureInstalled = true
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const shell = target?.closest<HTMLElement>(".ds-preview-shell")
      if (!shell) return
      const modPressed = event.altKey || event.shiftKey
      // #region agent log
      fetch("http://127.0.0.1:7499/ingest/f73dd0bc-9f26-43e4-9b01-58403a9c7eee", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e3e11d" },
        body: JSON.stringify({
          sessionId: "e3e11d",
          runId: "pre-fix",
          hypothesisId: "H8",
          location: "components/lesson-builder/lesson-editor.tsx:trajectory-capture",
          message: "Preview click observed",
          data: { altKey: event.altKey, shiftKey: event.shiftKey, modPressed },
          timestamp: Date.now()
        })
      }).catch(() => {})
      // #endregion
      if (!modPressed) return
      const optionClass = Array.from(shell.classList).find((cls) => cls.startsWith("ds-preview-option-"))
      if (!optionClass) return
      const optionId = optionClass.replace("ds-preview-option-", "")
      const rect = shell.getBoundingClientRect()
      const xPct = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
      const yPct = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
      const pending = window.__dsPreviewTrajectoryStart
      if (!pending || pending.optionId !== optionId) {
        window.__dsPreviewTrajectoryStart = { optionId, xPct, yPct }
        // #region agent log
        fetch("http://127.0.0.1:7499/ingest/f73dd0bc-9f26-43e4-9b01-58403a9c7eee", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e3e11d" },
          body: JSON.stringify({
            sessionId: "e3e11d",
            runId: "pre-fix",
            hypothesisId: "H7",
            location: "components/lesson-builder/lesson-editor.tsx:trajectory-capture",
            message: "Trajectory START captured",
            data: { optionId, xPct: Number(xPct.toFixed(2)), yPct: Number(yPct.toFixed(2)) },
            timestamp: Date.now()
          })
        }).catch(() => {})
        // #endregion
      } else {
        // #region agent log
        fetch("http://127.0.0.1:7499/ingest/f73dd0bc-9f26-43e4-9b01-58403a9c7eee", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e3e11d" },
          body: JSON.stringify({
            sessionId: "e3e11d",
            runId: "pre-fix",
            hypothesisId: "H7",
            location: "components/lesson-builder/lesson-editor.tsx:trajectory-capture",
            message: "Trajectory END captured",
            data: {
              optionId,
              startXPct: Number(pending.xPct.toFixed(2)),
              startYPct: Number(pending.yPct.toFixed(2)),
              endXPct: Number(xPct.toFixed(2)),
              endYPct: Number(yPct.toFixed(2))
            },
            timestamp: Date.now()
          })
        }).catch(() => {})
        // #endregion
        window.__dsPreviewTrajectoryStart = undefined
      }
    }
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.__dsPreviewTrajectoryCaptureInstalled = false
      window.__dsPreviewTrajectoryStart = undefined
    }
  }, [])

  switch (optionId) {
    case "text-article":
      return (
        <div className={shellClass}>
          <p className="text-[16px] font-semibold">Статья: «Путешествие в Пекин»</p>
          <p className="mt-2 line-clamp-4 text-ds-text-secondary">
            Прошлым летом мы поехали в Пекин, посетили 天安门, попробовали местную кухню и узнали больше о культуре Китая.
          </p>
          <p className="mt-2 text-[13px] text-ds-text-secondary">Длинный учебный текст для чтения.</p>
        </div>
      )
    case "text-essay":
      return (
        <div className={shellClass}>
          <p className="text-[16px] font-semibold">Сочинение: «Мой любимый город»</p>
          <div className="mt-2 rounded-[var(--ds-radius-md)] bg-white/85 p-3 text-ds-text-secondary">
            Напишите 5-6 предложений о вашем городе, используя слова: 城市, 公园, 地铁.
          </div>
          <p className="mt-2 text-[13px] text-ds-text-secondary">Авторский формат текста/ответа.</p>
        </div>
      )
    case "text-default":
      return (
        <div className={shellClass}>
          <p className="text-[16px] font-semibold">Текст: «Сегодняшний день»</p>
          <p className="mt-2 line-clamp-5 text-ds-text-secondary">
            我今天七点起床，八点去学校。После уроков я встретился с друзьями, сделал домашнее задание и пошёл в парк.
          </p>
        </div>
      )
    case "fill-drag-word":
      return (
        <div className={shellClass}>
          <div className="flex flex-wrap gap-1.5">
            <span className={`${softChipClass} ds-preview-chip-source`}>学校</span>
            <span className={`${softChipClass} ds-preview-chip-drag`}>学生</span>
            <span className={softChipClass}>电脑</span>
            <span className={softChipClass}>时间</span>
            <span className={softChipClass}>老师</span>
          </div>
          <p className="mt-2 text-ds-text-secondary">
            我是 <span className={softChipClass}>学生</span>。我在{" "}
            <span className={`${softChipClass} ds-preview-drop-slot`}>
              <span className="ds-preview-drop-placeholder">_____</span>
              <span className="ds-preview-drop-answer">学校</span>
            </span>{" "}
            学习。
          </p>
          {cursor("ds-preview-cursor--drag-word")}
        </div>
      )
    case "fill-type-word":
      return (
        <div className={shellClass}>
          <p className="text-ds-text-secondary">
            Сегодня я иду в <span className={softFieldClass}>学校</span>, потом делаю <span className={softFieldClass}>_____</span>.
          </p>
          <p className="mt-2 text-[13px] text-ds-text-secondary">Введите слово вручную.</p>
          {cursor("click")}
        </div>
      )
    case "fill-choose-form":
      return (
        <div className={shellClass}>
          <p className="text-ds-text-secondary">
            Он{" "}
            <span className={`${softFieldClass} ds-preview-select-field`}>
              <span className="ds-preview-select-value">учится ▾</span>
              <span className="ds-preview-select-menu">учится</span>
            </span>{" "}
            в университете.
          </p>
          <p className="mt-2 text-ds-text-secondary">
            她 <span className={softFieldClass}>学习 ▾</span> 汉语 每天。
          </p>
          {cursor("ds-preview-cursor--select")}
        </div>
      )
    case "fill-image-drag":
      return (
        <div className={shellClass}>
          {chips(["猫", "狗", "女孩", "男人"])}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`aspect-square rounded-[var(--ds-radius-md)] bg-white/85 ${i === 0 ? "ds-preview-image-drop-target" : ""}`} />
            ))}
          </div>
          {cursor("ds-preview-cursor--image-drag")}
        </div>
      )
    case "fill-image-type":
      return (
        <div className={shellClass}>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[var(--ds-radius-md)] bg-white/85" />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-8 rounded-[var(--ds-radius-sm)] bg-white/85 ${i === 0 ? "ds-preview-image-type-target" : ""}`} />
            ))}
          </div>
          {cursor("ds-preview-cursor--image-type")}
        </div>
      )
    case "fill-image-form":
      return (
        <div className={shellClass}>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[var(--ds-radius-md)] bg-white/85" />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-8 rounded-[var(--ds-radius-sm)] bg-white/85 px-2 pt-2 text-[12px] text-ds-text-secondary ${i === 0 ? "ds-preview-image-form-target" : ""}`}>
                ▾
              </div>
            ))}
          </div>
          {cursor("ds-preview-cursor--image-form")}
        </div>
      )
    case "quiz-no-timer":
      return (
        <div className={shellClass}>
          <p className="text-[16px] font-semibold">Тест без таймера</p>
          <p className="mt-2 text-ds-text-secondary">Они сейчас идут в кино.</p>
          <div className="mt-2 space-y-1.5 text-ds-text-secondary">
            <p className="ds-preview-choice-row ds-preview-choice-row--selected">
              <span className="ds-preview-checkbox" />
              <span>идут</span>
            </p>
            <p className="ds-preview-choice-row">
              <span className="ds-preview-checkbox" />
              <span>идти</span>
            </p>
            <p className="ds-preview-choice-row">
              <span className="ds-preview-checkbox" />
              <span>шли</span>
            </p>
          </div>
          {cursor("ds-preview-cursor--checkbox")}
        </div>
      )
    case "quiz-timer":
      return (
        <div className={shellClass}>
          <div className={softFieldClass}>Тест начался · 00:30</div>
          <p className="mt-2 text-[16px] font-semibold">Выберите правильный ответ</p>
          <div className="mt-2 space-y-1.5 text-ds-text-secondary">
            <p>☑ 我是学生</p>
            <p>☐ 我学生是</p>
            <p>☐ 学生我是</p>
          </div>
          {cursor("click")}
        </div>
      )
    case "answer-true-false-unknown":
      return (
        <div className={shellClass}>
          <p className="text-ds-text-secondary">Утверждение: «Земля — это планета».</p>
          <div className="mt-2 flex gap-1.5">
            <span className={`${softChipClass} ds-preview-answer-target bg-emerald-100 text-emerald-900`}>Истина</span>
            <span className={softChipClass}>Ложь</span>
            <span className={softChipClass}>Не опр.</span>
          </div>
          {cursor("ds-preview-cursor--answer-tfu")}
        </div>
      )
    case "order-sentence":
      return (
        <div className={shellClass}>
          <div className="flex flex-wrap gap-1.5">
            <span className={softChipClass}>昨天</span>
            <span className={softChipClass}>我</span>
            <span className={`${softChipClass} ds-preview-order-token`}>去</span>
            <span className={softChipClass}>公园</span>
            <span className={softChipClass}>了</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`h-8 rounded-[var(--ds-radius-sm)] bg-white/85 ${i === 2 ? "ds-preview-order-slot" : ""}`} />
            ))}
          </div>
          <span className={`mt-2 ${solidBtnClass}`}>Проверить</span>
          {cursor("ds-preview-cursor--order-word")}
        </div>
      )
    case "order-columns":
      return (
        <div className={shellClass}>
          {chips(["苹果", "猫", "香蕉", "狗"])}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className={`${softFieldClass} ds-preview-column-target ring-1 ring-emerald-300`}>Животные</div>
            <div className={softFieldClass}>Фрукты</div>
          </div>
          {cursor("ds-preview-cursor--order-columns")}
        </div>
      )
    case "order-text":
      return (
        <div className={shellClass}>
          <div className="space-y-1.5">
            {["Сначала он пьёт чай.", "Потом он читает книгу.", "После этого делает домашнее задание."].map((s, i) => (
              <div key={s} className={`${softFieldClass} ${i === 1 ? "ds-preview-order-text-target" : ""}`}>
                {s}
              </div>
            ))}
          </div>
          <span className={`mt-2 ${solidBtnClass}`}>Проверить</span>
          {cursor("ds-preview-cursor--order-text")}
        </div>
      )
    case "order-letters":
      return (
        <div className={shellClass}>
          <p className="text-[15px] font-medium">Соберите слово: «Лето»</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-8 rounded-[var(--ds-radius-sm)] bg-white/85 ${i === 0 ? "ds-preview-letter-slot" : ""}`} />
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {["л", "е", "т", "о"].map((l) => (
              <span key={l} className={softChipClass}>
                {l}
              </span>
            ))}
          </div>
          {cursor("ds-preview-cursor--order-letters")}
        </div>
      )
    case "order-match-words":
      return (
        <div className={shellClass}>
          <div className="grid grid-cols-2 gap-1.5">
            {[["你好", "Здравствуйте"], ["谢谢", "Спасибо"], ["再见", "До свидания"], ["学生", "Студент"]].map(([l, r]) => (
              <div key={`${l}-${r}`} className="contents">
                <span className={`${softFieldClass} ring-1 ring-emerald-300`}>{l}</span>
                <span className={`${softFieldClass} ring-1 ring-emerald-300`}>{r}</span>
              </div>
            ))}
          </div>
          <span className="ds-preview-link-line" aria-hidden />
          {cursor("ds-preview-cursor--match-word")}
        </div>
      )
    case "media-video":
      return (
        <div className={shellClass}>
          <div className="relative aspect-[3/2] rounded-[var(--ds-radius-md)] bg-white/85">
            <span className="absolute inset-0 flex items-center justify-center text-2xl">▶</span>
          </div>
          <p className="mt-2 text-[13px] text-ds-text-secondary">Видео-объяснение темы</p>
          {cursor("click")}
        </div>
      )
    case "media-audio-playback":
      return (
        <div className={shellClass}>
          <div className="rounded-[var(--ds-radius-md)] bg-white/85 p-3">
            <div className="flex items-center justify-between text-[13px]">
              <p className="font-semibold">Аудио</p>
              <p className="text-ds-text-secondary">00:15 / 00:30</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-ds-ink">▮▮</span>
              <div className="h-2 flex-1 rounded-full bg-black/10">
                <div className="h-full w-[56%] rounded-full bg-black/65 dark:bg-white/70" />
              </div>
            </div>
            <div className="mt-2 flex items-end gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="w-1 rounded-full bg-black/55" style={{ height: `${6 + (i % 4) * 2}px` }} />
              ))}
            </div>
          </div>
          {cursor("audio")}
        </div>
      )
    case "media-audio-record":
      return (
        <div className={shellClass}>
          <div className="rounded-[var(--ds-radius-md)] bg-white/85 p-3">
            <div className="flex items-center justify-between text-[13px]">
              <p className="font-semibold">Идёт запись…</p>
              <p className="text-ds-text-secondary">00:15 / 00:30</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-ds-ink">▮▮</span>
              <div className="h-2 flex-1 rounded-full bg-black/10">
                <div className="h-full w-[48%] rounded-full bg-black/65 dark:bg-white/70" />
              </div>
            </div>
          </div>
          {cursor("audio")}
        </div>
      )
    case "images-stack":
      return (
        <div className={shellClass}>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="aspect-square rounded-[var(--ds-radius-sm)] bg-white/85" />
            <div className="aspect-square rounded-[var(--ds-radius-sm)] bg-white/85" />
            <div className="aspect-square rounded-[var(--ds-radius-sm)] bg-white/85" />
          </div>
          <p className="mt-2 text-[13px] text-ds-text-secondary">Изображения 1:1</p>
          {cursor("click")}
        </div>
      )
    case "images-carousel":
      return (
        <div className={shellClass}>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="aspect-[3/2] rounded-[var(--ds-radius-sm)] bg-white/85" />
            <div className="aspect-[3/2] rounded-[var(--ds-radius-sm)] bg-white/85" />
            <div className="aspect-[3/2] rounded-[var(--ds-radius-sm)] bg-white/85" />
          </div>
          <p className="mt-2 text-[13px] text-ds-text-secondary">Карусель изображений 3:2</p>
          {cursor("click")}
        </div>
      )
    case "images-gif":
      return (
        <div className={shellClass}>
          <div className="relative aspect-square rounded-[var(--ds-radius-md)] bg-white/85">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[var(--ds-radius-sm)] bg-black px-3 py-1 text-[20px] font-bold text-white">
              GIF
            </span>
          </div>
          <p className="mt-2 text-[13px] text-ds-text-secondary">GIF-анимация</p>
          {cursor("click")}
        </div>
      )
    case "other-wordset":
      return (
        <div className={shellClass}>
          <p className="text-[15px] font-semibold">Набор слов для изучения</p>
          <div className="mt-2 space-y-1.5 text-ds-text-secondary">
            <p>项目 — проект</p>
            <p>系统 — система</p>
            <p>学生 — студент</p>
          </div>
          {cursor("click")}
        </div>
      )
    case "other-note":
      return (
        <div className={shellClass}>
          <div className="rounded-[var(--ds-radius-md)] bg-white/85 p-3">
            <p className="font-semibold">Заметка перед началом</p>
            <p className="mt-1 line-clamp-4 text-ds-text-secondary">Внимательно прочитайте инструкцию и убедитесь, что поняли формат упражнения.</p>
          </div>
          {cursor("click")}
        </div>
      )
    case "other-link":
      return (
        <div className={shellClass}>
          <p className="line-clamp-3 text-ds-text-secondary">Перейдите по ссылке, чтобы изучить дополнительные материалы к уроку.</p>
          <span className={`mt-2 ${solidBtnClass}`}>Открыть ссылку</span>
          {cursor("click")}
        </div>
      )
    case "other-divider":
      return (
        <div className={shellClass}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">1.1</span>
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-ds-text-secondary">Упражнение 1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">2.1</span>
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-ds-text-secondary">Упражнение 2</span>
            </div>
          </div>
          {cursor("click")}
        </div>
      )
    default:
      return (
        <div className={shellClass}>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-ds-text-secondary">Раздел урока</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>
        </div>
      )
  }
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
  /** После добавления блока — прокрутить к последнему каркасу редактора. */
  const pendingScrollToBlockIdRef = useRef<string | null>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const toolbarShellRef = useRef<HTMLDivElement>(null)
  const [toolbarDocked, setToolbarDocked] = useState(false)
  const [editorOverflowOpen, setEditorOverflowOpen] = useState(false)
  const [dockBarFrame, setDockBarFrame] = useState<{ top: number; left: number; width: number } | null>(null)
  const [dockedSpacerHeight, setDockedSpacerHeight] = useState(56)

  const orderedBlocks = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks])
  const groupedBlockOptions = useMemo(() => {
    const byCategory: Record<BlockCategoryId, BlockOption[]> = {
      images: [],
      media: [],
      words_and_gaps: [],
      tests: [],
      right_answer: [],
      ordering: [],
      text_work: [],
      other: []
    }
    for (const option of blockTypeOptions) byCategory[option.category].push(option)
    return byCategory
  }, [])
  const lastBlockId = orderedBlocks.length ? orderedBlocks[orderedBlocks.length - 1]!.id : null

  useLayoutEffect(() => {
    const targetId = pendingScrollToBlockIdRef.current
    if (!targetId) return
    pendingScrollToBlockIdRef.current = null
    const primary = document.querySelector<HTMLElement>(`[data-lesson-block-editor="${targetId}"]`)
    const el =
      primary ??
      (lastBlockId ? document.querySelector<HTMLElement>(`[data-lesson-block-editor="${lastBlockId}"]`) : null)
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })
    })
  }, [lastBlockId, orderedBlocks.length])

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

  function createBlockDataFromOption(option: BlockOption): Record<string, unknown> {
    const base = createDefaultBlockData(option.type) as { segments?: Record<string, unknown>[] }
    const first = base.segments?.[0] ?? {}

    if (option.id === "text-article") {
      return { segments: [{ ...first, content: "The Magic of Traveling\n\nTraveling opens the door to endless discovery..." }] }
    }
    if (option.id === "text-essay") {
      return { segments: [{ ...first, content: "My Unforgettable Journey\n\nLast summer, I went on a trip that changed the way I see the world..." }] }
    }
    if (option.id === "fill-type-word") {
      return { segments: [{ ...first, text: "Hello! I am a [] at a modern [].", answers: ["student", "school"] }], exercise_mode: "type_word" }
    }
    if (option.id === "fill-choose-form") {
      return { segments: [{ ...first, text: "She [] to school every day.", answers: ["goes"] }], exercise_mode: "choose_form" }
    }
    if (option.id === "fill-image-drag" || option.id === "fill-image-type" || option.id === "fill-image-form") {
      return {
        segments: [{ ...first, text: "Match words to images: [] [] [] []", answers: ["man", "dog", "girl", "cat"] }],
        exercise_mode: option.id
      }
    }
    if (option.id === "quiz-timer") {
      return { segments: [{ ...first, question: "They are going to the cinema at the moment.", options: ["are going", "going", "go"], correct: 0 }], timer_enabled: true }
    }
    if (option.id === "quiz-true-false-unknown") {
      return { segments: [{ ...first, question: "The Earth is a planet in space.", options: ["Истина", "Ложь", "Неопределённо"], correct: 0 }], exercise_mode: "true_false_unknown" }
    }
    if (option.id === "order-columns") {
      return { segments: [{ ...first, pairs: [{ left: "Cat", right: "Animals" }, { left: "Apple", right: "Fruits" }, { left: "Dog", right: "Animals" }, { left: "Banana", right: "Fruits" }] }], exercise_mode: "columns" }
    }
    if (option.id === "order-letters") {
      return { segments: [{ ...first, pairs: [{ left: "Warm Season", right: "SUMMER" }] }], exercise_mode: "letters" }
    }
    if (option.id === "other-wordset") {
      return { segments: [{ ...first, title: "Набор слов для изучения", content: "Project — Проекто\nSystem — Система\nStudent — Студент" }], exercise_mode: "wordset" }
    }
    if (option.id === "other-divider") {
      return { segments: [{ ...first, label: "Следующий этап" }] }
    }
    return base
  }

  function addBlock(option: BlockOption) {
    const id = `tmp-${crypto.randomUUID()}`
    pendingScrollToBlockIdRef.current = id
    setBlocks((prev) => {
      const next = [
        ...prev,
        {
          id,
          lesson_id: lessonId,
          type: option.type,
          order: prev.length,
          data: {
            ...createBlockDataFromOption(option),
            exercise_variant_id: option.id,
            exercise_variant_label: option.label
          }
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
            {isSaving ? <Loader2 className="h-9 w-9 animate-spin" /> : <Save className="h-9 w-9" strokeWidth={2} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isSaving ? "Сохранение…" : "Сохранить урок"}
        </TooltipContent>
      </Tooltip>
    )
  }

  function renderBadgePicker(triggerTitle?: string) {
    const badgeTooltip = triggerTitle ?? "Цвет бейджа оглавления заданий"

    const triggerButton = (
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] border-0 bg-transparent text-ds-text-tertiary outline-none transition-colors hover:bg-ds-surface-hover hover:text-ds-ink"
        aria-label="Цвет бейджа оглавления заданий"
      >
        <Palette className="h-5 w-5" />
      </button>
    )

    return (
      <Popover open={isBadgeColorOpen} onOpenChange={setIsBadgeColorOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {badgeTooltip}
          </TooltipContent>
        </Tooltip>
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

  function renderBlockTypePickers(options: BlockOption[], compact: boolean, onAfterPick?: () => void) {
    return options.map((item) => {
      const buttonEl = (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          title={item.hint}
          className={cn("group rounded-[100px]", blockTypeAccentClass[item.type], compact && "text-[13px]")}
          onClick={() => {
            addBlock(item)
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
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={10}
            className="!w-[25rem] !max-w-[min(92vw,25rem)] !rounded-[18px] !border !border-black/[0.08] !bg-white !px-3 !py-3 !text-ds-ink !shadow-[0_22px_50px_-24px_rgba(0,0,0,0.35)]"
          >
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ds-text-tertiary">
                  {CATEGORY_LABEL[item.category]}
                </p>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-ds-text-secondary">{item.hint}</p>
              </div>
              <BlockTypePreview optionId={item.id} />
            </div>
          </TooltipContent>
        </Tooltip>
      )
    })
  }

  function renderBlockIconPickers(onAfterPick?: () => void) {
    return blockTypeOptions.map((item) => (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn("shrink-0 rounded-[10px]", blockTypeAccentClass[item.type])}
            onClick={() => {
              addBlock(item)
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
        <TooltipContent
          side="top"
          sideOffset={10}
          className="!w-[25rem] !max-w-[min(92vw,25rem)] !rounded-[18px] !border !border-black/[0.08] !bg-white !px-3 !py-3 !text-ds-ink !shadow-[0_22px_50px_-24px_rgba(0,0,0,0.35)]"
        >
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ds-text-tertiary">
                {CATEGORY_LABEL[item.category]}
              </p>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-xs text-ds-text-secondary">{item.hint}</p>
            </div>
            <BlockTypePreview optionId={item.id} />
          </div>
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
                <div className="hidden shrink-0 lg:block">{renderBadgePicker()}</div>
                {renderSaveToolbarButton()}
                <button
                  type="button"
                  className="ds-mobile-top-chrome__menu-btn"
                  aria-label="Все инструменты редактора урока"
                  aria-expanded={editorOverflowOpen}
                  aria-controls="lesson-editor-toolbar-overflow"
                  onClick={() => setEditorOverflowOpen((o) => !o)}
                >
                  <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
              </div>
              {editorOverflowOpen ? (
                <div
                  id="lesson-editor-toolbar-overflow"
                  className="mt-2.5 max-h-[min(50svh,320px)] overflow-y-auto overscroll-y-contain border-t border-black/[0.08] pt-2.5 dark:border-white/10"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
                      <div className="min-w-0 flex-1 space-y-3">
                        {(Object.keys(CATEGORY_LABEL) as BlockCategoryId[]).map((categoryId) => {
                          const options = groupedBlockOptions[categoryId]
                          if (!options?.length) return null
                          return (
                            <div key={categoryId} className="space-y-1.5">
                              <p className="text-xs font-semibold uppercase tracking-wide text-ds-text-tertiary">
                                {CATEGORY_LABEL[categoryId]}
                              </p>
                              <div className="flex min-w-0 flex-wrap gap-1.5">
                                {renderBlockTypePickers(options, false, () => setEditorOverflowOpen(false))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 self-start lg:hidden">
                        {renderBadgePicker(
                          "Цвет бейджа заданий в оглавлении урока — как отображается метка в списке заданий."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 rounded-[var(--ds-radius-xl)] border-2 border-[rgba(204,204,204,1)] [border-image:none] bg-[var(--tw-gradient-to)] p-4 shadow-none dark:bg-ds-surface sm:p-5">
              <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <PencilLine className="h-5 w-5 shrink-0 text-ds-text-tertiary" aria-hidden />
                  <CardTitle className="min-w-0">Редактор урока</CardTitle>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {renderBadgePicker()}
                  {renderSaveToolbarButton()}
                </div>
              </div>

              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveTitle(title)}
                placeholder="Название урока"
                className="ds-lesson-editor-title-field h-12 min-h-12"
              />

              <div className="space-y-3 border-t border-black/[0.06] pt-4 dark:border-white/10">
                {(Object.keys(CATEGORY_LABEL) as BlockCategoryId[]).map((categoryId) => {
                  const options = groupedBlockOptions[categoryId]
                  if (!options?.length) return null
                  return (
                    <div key={categoryId} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ds-text-tertiary">
                        {CATEGORY_LABEL[categoryId]}
                      </p>
                      <div className="flex flex-wrap gap-2">{renderBlockTypePickers(options, false)}</div>
                    </div>
                  )
                })}
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
            <CardTitle className="text-[rgb(153,153,153)]">Предпросмотр для ученика</CardTitle>
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
