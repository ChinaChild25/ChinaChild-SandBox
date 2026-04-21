"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export const HSK_LESSON_SECTION_KEYS = [
  "intro",
  "audio",
  "vocab",
  "pinyin",
  "speech",
  "writing",
  "game",
  "practice",
  "finish",
] as const

export type HskLessonSectionKey = (typeof HSK_LESSON_SECTION_KEYS)[number]

const TAB_LABELS: Record<HskLessonSectionKey, string> = {
  intro: "Введение",
  audio: "Аудио",
  vocab: "Словарь",
  pinyin: "Пиньинь",
  speech: "Речь",
  writing: "Письмо",
  game: "Игра",
  practice: "Практика",
  finish: "Финал",
}

type Props = {
  courseHref: string
  /** Compact label in the top bar, e.g. "HSK1" */
  courseNavLabel: string
  activeKey: HskLessonSectionKey
  onSelect: (key: HskLessonSectionKey) => void
  onPrev: () => void
  onNext: () => void
  children: ReactNode
}

export function lessonSectionIndex(key: HskLessonSectionKey): number {
  return HSK_LESSON_SECTION_KEYS.indexOf(key)
}

export function lessonSectionKeyAt(index: number): HskLessonSectionKey {
  const i = Math.min(Math.max(index, 0), HSK_LESSON_SECTION_KEYS.length - 1)
  return HSK_LESSON_SECTION_KEYS[i]!
}

export function LessonHskChrome({
  courseHref,
  courseNavLabel,
  activeKey,
  onSelect,
  onPrev,
  onNext,
  children,
}: Props) {
  const activeIndex = lessonSectionIndex(activeKey)
  const progressPct =
    HSK_LESSON_SECTION_KEYS.length <= 1
      ? 100
      : (activeIndex / (HSK_LESSON_SECTION_KEYS.length - 1)) * 100

  return (
    <div className="cc-hsk-shell">
      <div className="cc-hsk-topbar">
        <Link href={courseHref} className="cc-hsk-backlink">
          <ChevronLeft className="cc-hsk-backlink-icon" aria-hidden />
          <span>{courseNavLabel}</span>
        </Link>

        <div className="cc-hsk-tabs-scroll ds-hide-scrollbar" role="tablist" aria-label="Разделы урока">
          {HSK_LESSON_SECTION_KEYS.map((key, i) => {
            const isActive = key === activeKey
            const isDone = i < activeIndex
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "cc-hsk-tab",
                  isActive && "cc-hsk-tab--active",
                  isDone && !isActive && "cc-hsk-tab--done",
                )}
                onClick={() => onSelect(key)}
              >
                {isDone ? (
                  <span className="cc-hsk-tab-check" aria-hidden>
                    <Check className="cc-hsk-tab-check-icon" strokeWidth={2.5} />
                  </span>
                ) : null}
                {TAB_LABELS[key]}
              </button>
            )
          })}
        </div>

        <div className="cc-hsk-arrows">
          <button type="button" className="cc-hsk-round-btn" aria-label="Предыдущий раздел" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="cc-hsk-round-btn" aria-label="Следующий раздел" onClick={onNext}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="cc-hsk-progressbar" aria-hidden>
        <div className="cc-hsk-progressbar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="cc-hsk-body">{children}</div>
    </div>
  )
}
