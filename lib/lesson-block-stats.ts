/** Подсчёт лексики и аудио по блокам урока (кабинет преподавателя, карточка курса). */

import { getLessonBlockSegments } from "@/lib/lesson-block-segments"
import type { LessonBlockType } from "@/lib/types"

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

type Pair = { left: string; right: string }

function asPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    left: asString((item as Record<string, unknown>)?.left),
    right: asString((item as Record<string, unknown>)?.right)
  }))
}

function extractBracketAnswers(text: string): string[] {
  const matches = Array.from(text.matchAll(/\[([^[\]]*?)\]/g))
  return matches.map((m) => (m[1] ?? "").trim()).filter(Boolean)
}

function countWordSlotsInSegment(type: string, seg: Record<string, unknown>): number {
  if (type === "matching") {
    let n = 0
    for (const p of asPairs(seg.pairs)) {
      if (p.left.trim()) n += 1
      if (p.right.trim()) n += 1
    }
    return n
  }

  if (type === "fill_gaps") {
    const fromBrackets = extractBracketAnswers(asString(seg.text))
    if (fromBrackets.length > 0) return fromBrackets.length
    const arr = seg.answers
    if (Array.isArray(arr)) {
      return arr.filter((x) => typeof x === "string" && x.trim()).length
    }
    return 0
  }

  return 0
}

/** Оценка «слотов» лексики: пары сопоставления + слова в пропусках (по всем частям блока). */
export function countWordSlotsInBlock(type: string, rawData: unknown): number {
  if (type !== "matching" && type !== "fill_gaps") return 0
  const segments = getLessonBlockSegments(type as LessonBlockType, rawData)
  return segments.reduce((sum, seg) => sum + countWordSlotsInSegment(type, seg), 0)
}

/** Блок «аудио»: число частей с загруженным URL. */
export function countAudioInBlock(type: string, rawData: unknown): number {
  if (type !== "audio") return 0
  const segments = getLessonBlockSegments("audio", rawData)
  return segments.filter((seg) => asString(seg.url).trim()).length
}
