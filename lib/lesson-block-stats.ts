/** Подсчёт лексики и аудио по блокам урока (кабинет преподавателя, карточка курса). */

import {
  asRecord,
  asString,
  asStringArray,
  extractBracketAnswers,
  normalizeLessonBlockData
} from "@/lib/lesson-builder-blocks"
import type { LessonBlockType } from "@/lib/types"

type Pair = { left: string; right: string }

function asPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    left: asString((item as Record<string, unknown>)?.left),
    right: asString((item as Record<string, unknown>)?.right)
  }))
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
  const normalized = normalizeLessonBlockData(type as LessonBlockType, rawData)
  if (type === "matching") {
    const pairs = asPairs(asRecord(normalized.matching).pairs)
    return pairs.reduce((sum, pair) => sum + (pair.left.trim() ? 1 : 0) + (pair.right.trim() ? 1 : 0), 0)
  }

  const items = Array.isArray(asRecord(normalized.fill_gaps).items)
    ? (asRecord(normalized.fill_gaps).items as Record<string, unknown>[])
    : []
  return items.reduce((sum, item) => {
    const answers = extractBracketAnswers(asString(item.text))
    if (answers.length > 0) return sum + answers.length
    return sum + asStringArray(item.answers).filter((entry) => entry.trim()).length
  }, 0)
}

/** Блок «аудио»: число частей с загруженным URL. */
export function countAudioInBlock(type: string, rawData: unknown): number {
  if (type !== "audio") return 0
  const normalized = normalizeLessonBlockData("audio", rawData)
  const items = Array.isArray(asRecord(normalized.audio).items)
    ? (asRecord(normalized.audio).items as Record<string, unknown>[])
    : []
  return items.filter((item) => asString(item.url).trim()).length
}
