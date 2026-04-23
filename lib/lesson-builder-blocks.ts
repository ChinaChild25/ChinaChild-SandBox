import { getLessonBlockSegments } from "@/lib/lesson-block-segments"
import type { LessonBlockType, TeacherLessonBlock } from "@/lib/types"

export type LessonBlockMeta = {
  title: string
  instruction: string
  points: number
  timerMinutes: number
  required: boolean
  shuffle: boolean
  attempts: number
}

export type TextBlockItem = {
  content: string
  questions: Array<{ prompt: string; answer: boolean }>
}

export type MatchingPair = { left: string; right: string }

export type FillGapItem = { text: string; answers: string[]; imageUrl?: string }

export type QuizSingleQuestion = {
  prompt: string
  options: string[]
  correctIndex: number
}

export type QuizMultiQuestion = {
  prompt: string
  options: string[]
  correctIndexes: number[]
}

export type SentenceBuilderItem = { source: string }

export type FlashcardItem = { front: string; back: string; example: string }

export type HomeworkResponseMode = "text" | "file" | "text_file"

export type MediaLibraryItem = {
  url: string
  title: string
  caption: string
  thumbnailUrl: string
}

export type AudioLibraryItem = {
  url: string
  title: string
  transcript: string
}

export type PdfLibraryItem = {
  url: string
  title: string
  description: string
}

export type SpeakingLibraryItem = {
  prompt: string
  helper: string
}

export const LESSON_BLOCK_LABELS: Record<LessonBlockType, string> = {
  text: "Текст",
  video: "Видео",
  image: "Картинка",
  quiz_single: "Тест · 1 ответ",
  quiz_multi: "Тест · неск. ответов",
  matching: "Сопоставь слова",
  fill_gaps: "Заполни пропуски",
  sentence_builder: "Собери предложение",
  flashcards: "Карточки",
  homework: "Домашнее задание",
  audio: "Аудио",
  pdf: "PDF",
  speaking: "Ответ голосом",
  note: "Заметка",
  link: "Ссылка",
  divider: "Разделитель"
}

const DEFAULT_META_NUMBERS = {
  points: 10,
  timerMinutes: 5,
  attempts: 1
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? ""))
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(asNumber(value, fallback))))
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map(asRecord).filter((item) => Object.keys(item).length > 0)
}

function nonEmptyText(value: string) {
  return value.trim().length > 0
}

function normalizeTrueFalseQuestions(value: unknown, preserveEmpty = false): Array<{ prompt: string; answer: boolean }> {
  const questions = asRecordArray(value).map((item) => ({
    prompt: asString(item.prompt).trim(),
    answer: Boolean(item.answer)
  }))
  return preserveEmpty ? questions : questions.filter((item) => item.prompt)
}

function normalizeMatchingPairs(value: unknown, preserveEmpty = false): MatchingPair[] {
  const pairs = asRecordArray(value).map((item) => ({
    left: asString(item.left),
    right: asString(item.right)
  }))
  return preserveEmpty ? pairs : pairs.filter((item) => nonEmptyText(item.left) || nonEmptyText(item.right))
}

function normalizeTextItemsFromLegacy(rawData: Record<string, unknown>): TextBlockItem[] {
  return getLessonBlockSegments("text", rawData)
    .map((segment) => ({
      content: asString(segment.content),
      questions: normalizeTrueFalseQuestions(segment.questions)
    }))
    .filter((item) => nonEmptyText(item.content) || item.questions.length > 0)
}

function normalizeFillGapItemsFromLegacy(rawData: Record<string, unknown>): FillGapItem[] {
  return getLessonBlockSegments("fill_gaps", rawData)
    .map((segment) => {
      const text = asString(segment.text)
      const answers = extractBracketAnswers(text)
      return {
        text,
        answers: answers.length > 0 ? answers : asStringArray(segment.answers).map((item) => item.trim()).filter(Boolean),
        imageUrl: asString(segment.imageUrl).trim()
      }
    })
    .filter((item) => nonEmptyText(item.text) || item.answers.length > 0 || nonEmptyText(item.imageUrl ?? ""))
}

function normalizeQuizSingleQuestionsFromLegacy(rawData: Record<string, unknown>): QuizSingleQuestion[] {
  return getLessonBlockSegments("quiz_single", rawData)
    .map((segment) => {
      const options = asStringArray(segment.options).map((item) => item.trim()).filter(Boolean)
      return {
        prompt: asString(segment.question || segment.prompt).trim(),
        options: options.length > 0 ? options : ["", ""],
        correctIndex: Math.max(0, Math.min(options.length - 1, clampInt(segment.correct, 0, 0, Math.max(options.length - 1, 0))))
      }
    })
    .filter((item) => nonEmptyText(item.prompt) || item.options.some(nonEmptyText))
}

function normalizeMediaItemsFromLegacy(type: "video" | "image" | "audio", rawData: Record<string, unknown>) {
  return getLessonBlockSegments(type, rawData)
    .map((segment) => {
      const titleCandidate =
        type === "audio"
          ? asString(segment.title)
          : asString(segment.title || segment.alt)
      return {
        url: asString(segment.url).trim(),
        title: titleCandidate.trim(),
        caption: asString(segment.caption || segment.transcript).trim(),
        thumbnailUrl: asString(segment.thumbnailUrl).trim()
      }
    })
    .filter((item) => item.url || item.title || item.caption || item.thumbnailUrl)
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b)
}

function normalizeQuizMultiQuestions(value: unknown, preserveEmpty = false): QuizMultiQuestion[] {
  const questions = asRecordArray(value).map((item) => {
    const options = asStringArray(item.options).map((option) => option.trim())
    return {
      prompt: asString(item.prompt).trim(),
      options,
      correctIndexes: uniqueNumbers(
        Array.isArray(item.correctIndexes)
          ? item.correctIndexes.map((entry) => asNumber(entry, -1))
          : []
      ).filter((index) => index < options.length)
    }
  })
  return preserveEmpty ? questions : questions.filter((item) => item.prompt || item.options.some(nonEmptyText))
}

function normalizeQuizSingleQuestions(value: unknown, preserveEmpty = false): QuizSingleQuestion[] {
  const questions = asRecordArray(value).map((item) => {
    const options = asStringArray(item.options).map((option) => option.trim())
    return {
      prompt: asString(item.prompt).trim(),
      options,
      correctIndex: Math.max(0, Math.min(options.length - 1, clampInt(item.correctIndex, 0, 0, Math.max(options.length - 1, 0))))
    }
  })
  return preserveEmpty ? questions : questions.filter((item) => item.prompt || item.options.some(nonEmptyText))
}

function normalizeTextItems(value: unknown, preserveEmpty = false): TextBlockItem[] {
  const items = asRecordArray(value).map((item) => ({
    content: asString(item.content),
    questions: normalizeTrueFalseQuestions(item.questions, preserveEmpty)
  }))
  return preserveEmpty ? items : items.filter((item) => nonEmptyText(item.content) || item.questions.length > 0)
}

function normalizeFillGapItems(value: unknown, preserveEmpty = false): FillGapItem[] {
  const items = asRecordArray(value).map((item) => {
    const text = asString(item.text)
    const derivedAnswers = extractBracketAnswers(text)
    return {
      text,
      answers: derivedAnswers.length > 0 ? derivedAnswers : asStringArray(item.answers).map((entry) => entry.trim()).filter(Boolean),
      imageUrl: asString(item.imageUrl).trim()
    }
  })
  return preserveEmpty ? items : items.filter((item) => item.text || item.answers.length > 0 || item.imageUrl)
}

function normalizeSentenceItems(value: unknown, preserveEmpty = false): SentenceBuilderItem[] {
  const items = asRecordArray(value).map((item) => ({ source: asString(item.source).trim() }))
  return preserveEmpty ? items : items.filter((item) => item.source)
}

function normalizeFlashcards(value: unknown, preserveEmpty = false): FlashcardItem[] {
  const cards = asRecordArray(value).map((item) => ({
    front: asString(item.front),
    back: asString(item.back),
    example: asString(item.example)
  }))
  return preserveEmpty ? cards : cards.filter((item) => item.front || item.back || item.example)
}

function normalizeMediaItems(value: unknown, preserveEmpty = false): MediaLibraryItem[] {
  const items = asRecordArray(value).map((item) => ({
    url: asString(item.url).trim(),
    title: asString(item.title).trim(),
    caption: asString(item.caption).trim(),
    thumbnailUrl: asString(item.thumbnailUrl).trim()
  }))
  return preserveEmpty ? items : items.filter((item) => item.url || item.title || item.caption || item.thumbnailUrl)
}

function normalizeAudioItems(value: unknown, preserveEmpty = false): AudioLibraryItem[] {
  const items = asRecordArray(value).map((item) => ({
    url: asString(item.url).trim(),
    title: asString(item.title).trim(),
    transcript: asString(item.transcript || item.caption).trim()
  }))
  return preserveEmpty ? items : items.filter((item) => item.url || item.title || item.transcript)
}

function normalizePdfItems(value: unknown, preserveEmpty = false): PdfLibraryItem[] {
  const items = asRecordArray(value).map((item) => ({
    url: asString(item.url).trim(),
    title: asString(item.title).trim(),
    description: asString(item.description).trim()
  }))
  return preserveEmpty ? items : items.filter((item) => item.url || item.title || item.description)
}

function normalizeSpeakingItems(value: unknown, preserveEmpty = false): SpeakingLibraryItem[] {
  const items = asRecordArray(value).map((item) => ({
    prompt: asString(item.prompt).trim(),
    helper: asString(item.helper).trim()
  }))
  return preserveEmpty ? items : items.filter((item) => item.prompt || item.helper)
}

function normalizeHomeworkResponseMode(value: unknown): HomeworkResponseMode {
  if (value === "text" || value === "file" || value === "text_file") return value
  if (value === "text+file") return "text_file"
  return "text"
}

export function extractBracketAnswers(text: string): string[] {
  const matches = Array.from(text.matchAll(/\[([^[\]]*?)\]/g))
  return matches.map((match) => (match[1] ?? "").trim()).filter(Boolean)
}

export function createDefaultBlockMeta(type: LessonBlockType): LessonBlockMeta {
  return {
    title: LESSON_BLOCK_LABELS[type],
    instruction: "",
    points: DEFAULT_META_NUMBERS.points,
    timerMinutes: DEFAULT_META_NUMBERS.timerMinutes,
    required: false,
    shuffle: false,
    attempts: DEFAULT_META_NUMBERS.attempts
  }
}

function normalizeMeta(type: LessonBlockType, rawData: Record<string, unknown>): LessonBlockMeta {
  const rawMeta = asRecord(rawData.meta)
  const fallbackTitle = asString(rawData.exercise_variant_label).trim() || LESSON_BLOCK_LABELS[type]
  const variantId = asString(rawData.exercise_variant_id).trim()
  const requestedTimer = clampInt(rawMeta.timerMinutes, DEFAULT_META_NUMBERS.timerMinutes, 0, 999)
  const timerMinutes =
    variantId === "quiz-no-timer" || variantId === "answer-true-false-unknown"
      ? 0
      : variantId === "quiz-timer"
        ? Math.max(requestedTimer || DEFAULT_META_NUMBERS.timerMinutes, 1)
        : requestedTimer
  return {
    title: asString(rawMeta.title).trim() || fallbackTitle,
    instruction: asString(rawMeta.instruction).trim(),
    points: clampInt(rawMeta.points, DEFAULT_META_NUMBERS.points, 0, 999),
    timerMinutes,
    required: asBoolean(rawMeta.required),
    shuffle: asBoolean(rawMeta.shuffle),
    attempts: clampInt(rawMeta.attempts, DEFAULT_META_NUMBERS.attempts, 1, 20)
  }
}

export function resolveLessonBlockType(block: TeacherLessonBlock): LessonBlockType {
  const rawData = asRecord(block.data)
  const variantId = asString(rawData.exercise_variant_id).trim()
  const variantLabel = asString(rawData.exercise_variant_label).trim().toLowerCase()
  if (
    block.type === "matching" &&
    (variantId === "order-sentence" || variantLabel === "sentence builder")
  ) {
    return "sentence_builder"
  }
  return block.type
}

export function normalizeLessonBlockData(type: LessonBlockType, rawData: unknown): Record<string, unknown> {
  const raw = asRecord(rawData)
  const meta = normalizeMeta(type, raw)

  if (type === "text") {
    const nested = asRecord(raw.text)
    const items =
      Array.isArray(nested.items) && normalizeTextItems(nested.items, true).length > 0
        ? normalizeTextItems(nested.items, true)
        : normalizeTextItemsFromLegacy(raw)
    return { ...raw, meta, text: { items: items.length > 0 ? items : [{ content: "", questions: [] }] } }
  }

  if (type === "matching") {
    const nested = asRecord(raw.matching)
    const pairs =
      Array.isArray(nested.pairs) && normalizeMatchingPairs(nested.pairs, true).length > 0
        ? normalizeMatchingPairs(nested.pairs, true)
        : normalizeMatchingPairs(getLessonBlockSegments("matching", raw).flatMap((segment) => asRecordArray(segment.pairs)))
    return { ...raw, meta, matching: { pairs: pairs.length > 0 ? pairs : [{ left: "", right: "" }] } }
  }

  if (type === "fill_gaps") {
    const nested = asRecord(raw.fill_gaps)
    const items =
      Array.isArray(nested.items) && normalizeFillGapItems(nested.items, true).length > 0
        ? normalizeFillGapItems(nested.items, true)
        : normalizeFillGapItemsFromLegacy(raw)
    return { ...raw, meta, fill_gaps: { items: items.length > 0 ? items : [{ text: "", answers: [] }] } }
  }

  if (type === "quiz_single") {
    const nested = asRecord(raw.quiz_single)
    const questions =
      Array.isArray(nested.questions) && normalizeQuizSingleQuestions(nested.questions, true).length > 0
        ? normalizeQuizSingleQuestions(nested.questions, true)
        : normalizeQuizSingleQuestionsFromLegacy(raw)
    const variantId = asString(raw.exercise_variant_id).trim()
    const isTrueFalseUnknown = variantId === "answer-true-false-unknown"
    return {
      ...raw,
      meta,
      quiz_single: {
        questions:
          questions.length > 0
            ? questions.map((question) => ({
                ...question,
                options: isTrueFalseUnknown ? ["Ложь", "Истина", "Неопределённо"] : question.options,
                correctIndex: isTrueFalseUnknown ? Math.max(0, Math.min(2, question.correctIndex)) : question.correctIndex
              }))
            : [
                {
                  prompt: "",
                  options: isTrueFalseUnknown ? ["Ложь", "Истина", "Неопределённо"] : ["", ""],
                  correctIndex: isTrueFalseUnknown ? 1 : 0
                }
              ]
      }
    }
  }

  if (type === "quiz_multi") {
    const nested = asRecord(raw.quiz_multi)
    const questions =
      Array.isArray(nested.questions) && normalizeQuizMultiQuestions(nested.questions, true).length > 0
        ? normalizeQuizMultiQuestions(nested.questions, true)
        : normalizeQuizMultiQuestions(nested.questions)
    return {
      ...raw,
      meta,
      quiz_multi: {
        questions: questions.length > 0 ? questions : [{ prompt: "", options: ["", ""], correctIndexes: [0] }]
      }
    }
  }

  if (type === "sentence_builder") {
    const nested = asRecord(raw.sentence_builder)
    const direct = Array.isArray(nested.sentences) ? normalizeSentenceItems(nested.sentences, true) : []
    const legacy = getLessonBlockSegments("matching", raw)
      .flatMap((segment) => {
        if (asString(segment.source).trim()) return [{ source: asString(segment.source).trim() }]
        const pairs = normalizeMatchingPairs(segment.pairs)
        return pairs.map((pair) => ({ source: pair.left.trim() || pair.right.trim() })).filter((item) => item.source)
      })
    const sentences = direct.length > 0 ? direct : legacy
    return {
      ...raw,
      meta,
      sentence_builder: { sentences: sentences.length > 0 ? sentences : [{ source: "" }] }
    }
  }

  if (type === "flashcards") {
    const nested = asRecord(raw.flashcards)
    const cards = Array.isArray(nested.cards) ? normalizeFlashcards(nested.cards, true) : normalizeFlashcards(nested.cards)
    return {
      ...raw,
      meta,
      flashcards: { cards: cards.length > 0 ? cards : [{ front: "", back: "", example: "" }] }
    }
  }

  if (type === "homework") {
    const nested = asRecord(raw.homework)
    return {
      ...raw,
      meta,
      homework: {
        prompt: asString(nested.prompt || raw.content).trim(),
        responseMode: normalizeHomeworkResponseMode(nested.responseMode || nested.response_mode),
        deadline: asString(nested.deadline).trim()
      }
    }
  }

  if (type === "video") {
    const nested = asRecord(raw.video)
    const items =
      Array.isArray(nested.items) && normalizeMediaItems(nested.items, true).length > 0
        ? normalizeMediaItems(nested.items, true)
        : normalizeMediaItemsFromLegacy("video", raw)
    return {
      ...raw,
      meta,
      video: { items: items.length > 0 ? items : [{ url: "", title: "", caption: "", thumbnailUrl: "" }] }
    }
  }

  if (type === "image") {
    const nested = asRecord(raw.image)
    const items =
      Array.isArray(nested.items) && normalizeMediaItems(nested.items, true).length > 0
        ? normalizeMediaItems(nested.items, true)
        : normalizeMediaItemsFromLegacy("image", raw)
    return {
      ...raw,
      meta,
      image: { items: items.length > 0 ? items : [{ url: "", title: "", caption: "", thumbnailUrl: "" }] }
    }
  }

  if (type === "audio") {
    const nested = asRecord(raw.audio)
    const items =
      Array.isArray(nested.items) && normalizeAudioItems(nested.items, true).length > 0
        ? normalizeAudioItems(nested.items, true)
        : normalizeMediaItemsFromLegacy("audio", raw).map((item) => ({
            url: item.url,
            title: item.title,
            transcript: item.caption
          }))
    return {
      ...raw,
      meta,
      audio: { items: items.length > 0 ? items : [{ url: "", title: "", transcript: "" }] }
    }
  }

  if (type === "pdf") {
    const nested = asRecord(raw.pdf)
    const items = Array.isArray(nested.items) ? normalizePdfItems(nested.items, true) : normalizePdfItems(nested.items)
    return {
      ...raw,
      meta,
      pdf: { items: items.length > 0 ? items : [{ url: "", title: "", description: "" }] }
    }
  }

  if (type === "speaking") {
    const nested = asRecord(raw.speaking)
    const items = Array.isArray(nested.items) ? normalizeSpeakingItems(nested.items, true) : normalizeSpeakingItems(nested.items)
    return {
      ...raw,
      meta,
      speaking: { items: items.length > 0 ? items : [{ prompt: "", helper: "" }] }
    }
  }

  if (type === "note") {
    const nested = asRecord(raw.note)
    return {
      ...raw,
      meta,
      note: {
        title: asString(nested.title || raw.title).trim(),
        content: asString(nested.content || raw.content).trim()
      }
    }
  }

  if (type === "link") {
    const nested = asRecord(raw.link)
    return {
      ...raw,
      meta,
      link: {
        label: asString(nested.label || raw.label).trim(),
        url: asString(nested.url || raw.url).trim(),
        hint: asString(nested.hint || raw.hint).trim()
      }
    }
  }

  const nested = asRecord(raw.divider)
  return {
    ...raw,
    meta,
    divider: {
      label: asString(nested.label || raw.label).trim()
    }
  }
}

export function normalizeTeacherLessonBlock(block: TeacherLessonBlock): TeacherLessonBlock {
  const nextType = resolveLessonBlockType(block)
  return {
    ...block,
    type: nextType,
    data: normalizeLessonBlockData(nextType, block.data)
  }
}

export function createDefaultBlockData(type: LessonBlockType): Record<string, unknown> {
  const meta = createDefaultBlockMeta(type)

  if (type === "text") return { meta, text: { items: [{ content: "", questions: [] }] } }
  if (type === "matching") return { meta, matching: { pairs: [{ left: "", right: "" }] } }
  if (type === "fill_gaps") return { meta, fill_gaps: { items: [{ text: "", answers: [] }] } }
  if (type === "quiz_single") {
    return { meta, quiz_single: { questions: [{ prompt: "", options: ["", ""], correctIndex: 0 }] } }
  }
  if (type === "quiz_multi") {
    return { meta, quiz_multi: { questions: [{ prompt: "", options: ["", ""], correctIndexes: [0] }] } }
  }
  if (type === "sentence_builder") return { meta, sentence_builder: { sentences: [{ source: "" }] } }
  if (type === "flashcards") {
    return { meta, flashcards: { cards: [{ front: "", back: "", example: "" }] } }
  }
  if (type === "homework") {
    return { meta, homework: { prompt: "", responseMode: "text", deadline: "" } }
  }
  if (type === "video") {
    return { meta, video: { items: [{ url: "", title: "", caption: "", thumbnailUrl: "" }] } }
  }
  if (type === "image") {
    return { meta, image: { items: [{ url: "", title: "", caption: "", thumbnailUrl: "" }] } }
  }
  if (type === "audio") {
    return { meta, audio: { items: [{ url: "", title: "", transcript: "" }] } }
  }
  if (type === "pdf") {
    return { meta, pdf: { items: [{ url: "", title: "", description: "" }] } }
  }
  if (type === "speaking") {
    return { meta, speaking: { items: [{ prompt: "", helper: "" }] } }
  }
  if (type === "note") return { meta, note: { title: "", content: "" } }
  if (type === "link") return { meta, link: { label: "", url: "", hint: "" } }
  return { meta, divider: { label: "" } }
}

export function getBlockMeta(block: TeacherLessonBlock): LessonBlockMeta {
  return normalizeMeta(block.type, asRecord(block.data))
}

export function getNormalizedBlockSubtitle(block: TeacherLessonBlock): string {
  const normalized = normalizeTeacherLessonBlock(block)
  const raw = asRecord(normalized.data)

  if (normalized.type === "text") {
    const firstItem = asRecordArray(asRecord(raw.text).items)[0]
    return asString(firstItem?.content).trim().slice(0, 72) || "Текстовый материал"
  }
  if (normalized.type === "video") {
    const firstItem = asRecordArray(asRecord(raw.video).items)[0]
    return asString(firstItem?.title || firstItem?.caption).trim() || "Видео для урока"
  }
  if (normalized.type === "image") {
    const firstItem = asRecordArray(asRecord(raw.image).items)[0]
    return asString(firstItem?.caption || firstItem?.title).trim() || "Иллюстрация к уроку"
  }
  if (normalized.type === "matching") {
    const count = normalizeMatchingPairs(asRecord(asRecord(raw.matching)).pairs).length
    return count > 0 ? `${count} ${pluralizeRu(count, "пара", "пары", "пар")}` : "Сопоставьте слова и переводы"
  }
  if (normalized.type === "fill_gaps") {
    const count = normalizeFillGapItems(asRecord(asRecord(raw.fill_gaps)).items).length
    return count > 0 ? `${count} ${pluralizeRu(count, "предложение", "предложения", "предложений")} с пропусками` : "Заполните пропуски"
  }
  if (normalized.type === "sentence_builder") {
    const count = normalizeSentenceItems(asRecord(asRecord(raw.sentence_builder)).sentences).length
    return count > 0 ? `${count} ${pluralizeRu(count, "предложение", "предложения", "предложений")}` : "Соберите предложение из слов"
  }
  if (normalized.type === "flashcards") {
    const count = normalizeFlashcards(asRecord(asRecord(raw.flashcards)).cards).length
    return count > 0 ? `${count} ${pluralizeRu(count, "карточка", "карточки", "карточек")}` : "Карточки со словами"
  }
  if (normalized.type === "quiz_single") {
    const count = normalizeQuizSingleQuestions(asRecord(asRecord(raw.quiz_single)).questions).length
    return count > 0 ? `${count} ${pluralizeRu(count, "вопрос", "вопроса", "вопросов")} · 1 ответ` : "Один правильный ответ"
  }
  if (normalized.type === "quiz_multi") {
    const count = normalizeQuizMultiQuestions(asRecord(asRecord(raw.quiz_multi)).questions).length
    return count > 0 ? `${count} ${pluralizeRu(count, "вопрос", "вопроса", "вопросов")} · несколько ответов` : "Несколько правильных ответов"
  }
  if (normalized.type === "homework") {
    return asString(asRecord(raw.homework).prompt).trim() || "Домашнее задание для ученика"
  }
  if (normalized.type === "audio") return "Аудиоматериал"
  if (normalized.type === "pdf") return "Файл PDF"
  if (normalized.type === "speaking") return "Голосовая практика"
  if (normalized.type === "note") return asString(asRecord(raw.note).content).trim() || "Важная заметка"
  if (normalized.type === "link") return asString(asRecord(raw.link).hint).trim() || "Внешний материал"
  return asString(asRecord(raw.divider).label).trim() || "Следующий этап"
}

function pluralizeRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
