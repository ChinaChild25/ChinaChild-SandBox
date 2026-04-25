import type { LessonBlockType } from "@/lib/types"

/** Ключ в `data` блока: массив однотипных подзаданий внутри одного блока. */
export const LESSON_BLOCK_SEGMENTS_KEY = "segments" as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Сегменты для редактора и предпросмотра: либо `data.segments`, либо один «legacy»-сегмент из корня `data`. */
export function getLessonBlockSegments(_type: LessonBlockType, rawData: unknown): Record<string, unknown>[] {
  const data = isPlainObject(rawData) ? rawData : {}
  const raw = data[LESSON_BLOCK_SEGMENTS_KEY]
  if (Array.isArray(raw) && raw.length > 0) {
    const cleaned = raw.filter((item): item is Record<string, unknown> => isPlainObject(item))
    if (cleaned.length > 0) return cleaned
  }
  const { [LESSON_BLOCK_SEGMENTS_KEY]: _ignored, ...rest } = data
  return [rest]
}

export function mergeSegmentsIntoBlockData(segments: Record<string, unknown>[]): Record<string, unknown> {
  return { [LESSON_BLOCK_SEGMENTS_KEY]: segments }
}

/** Одно подзадание внутри блока (прежняя форма `data` до введения сегментов). */
export function createDefaultSegmentPayload(type: LessonBlockType): Record<string, unknown> {
  switch (type) {
    case "hero":
      return { eyebrow: "", lead: "", imageUrl: "", imagePosition: "72% 50%", imageScale: 1, imageFlipX: false, imageFlipY: false, accentColor: "" }
    case "text":
      return { content: "", questions: [] }
    case "matching":
      return { pairs: [{ left: "", right: "" }] }
    case "fill_gaps":
      return { text: "[]", answers: [""] }
    case "quiz_single":
      return { question: "", options: ["", "", ""], correct: 0 }
    case "quiz_multi":
      return { prompt: "", options: ["", "", ""], correctIndexes: [0] }
    case "sentence_builder":
      return { source: "" }
    case "flashcards":
      return { front: "", back: "", example: "" }
    case "homework":
      return { prompt: "", responseMode: "text", deadline: "" }
    case "image":
      return { url: "", alt: "", caption: "" }
    case "video":
      return { url: "", caption: "" }
    case "audio":
      return { url: "", transcript: "" }
    case "pdf":
      return { url: "", title: "", description: "" }
    case "speaking":
      return { prompt: "", helper: "" }
    case "note":
      return { title: "", content: "" }
    case "link":
      return { label: "", url: "", hint: "" }
    case "divider":
      return { label: "" }
    default:
      return {}
  }
}

export function createDefaultBlockData(type: LessonBlockType): Record<string, unknown> {
  return mergeSegmentsIntoBlockData([createDefaultSegmentPayload(type)])
}

/** Стабильный префикс для ключей ответов / dnd внутри сегмента. */
export function lessonBlockSegmentScope(blockId: string, segmentIndex: number): string {
  return `${blockId}-seg-${segmentIndex}`
}
