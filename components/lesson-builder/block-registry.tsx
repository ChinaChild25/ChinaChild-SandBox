"use client"

import type { LucideIcon } from "lucide-react"
import {
  ArrowLeftRight,
  AudioLines,
  BadgeCheck,
  CheckCircle2,
  CheckSquare2,
  Columns2,
  FileText,
  FilePenLine,
  GalleryHorizontal,
  GalleryVertical,
  Headphones,
  Images,
  ImageIcon,
  Keyboard,
  Layers3,
  Link2,
  ListOrdered,
  Mic,
  Minus,
  MousePointerClick,
  NotebookPen,
  PlaySquare,
  BookOpenText,
  CaseSensitive,
  HandGrab,
  ScrollText,
  SeparatorHorizontal,
  SquareDashedMousePointer,
  SquareMousePointer,
  Shuffle,
  Timer,
  TimerOff,
  Type
} from "lucide-react"
import type { LessonBlockType } from "@/lib/types"
import { LESSON_BLOCK_LABELS } from "@/lib/lesson-builder-blocks"

type PaletteMetaOverrides = Partial<{
  title: string
  instruction: string
  points: number
  timerMinutes: number
  required: boolean
  shuffle: boolean
  attempts: number
}>

export type BuilderPaletteItem = {
  id: string
  type: LessonBlockType
  label: string
  initialMeta?: PaletteMetaOverrides
  initialData?: Record<string, unknown>
}

export type BuilderPaletteSection = {
  id: string
  label: string
  items: BuilderPaletteItem[]
}

export type BlockVariantBehavior = {
  showTimerSetting?: boolean
  timedQuiz?: boolean
  quizMode?: "default" | "true_false_unknown"
  lockQuizOptions?: string[]
  matchingMode?: "default" | "columns"
  fillMode?: "drag_word" | "type_word" | "choose_form" | "image_drag" | "image_type" | "image_form"
  sentenceMode?: "sentence" | "text_order" | "letters"
  imageMode?: "stack" | "carousel" | "gif"
}

function item(
  id: string,
  type: LessonBlockType,
  label: string,
  options?: Pick<BuilderPaletteItem, "initialMeta" | "initialData">
): BuilderPaletteItem {
  return {
    id,
    type,
    label,
    initialMeta: options?.initialMeta,
    initialData: options?.initialData
  }
}

export const LESSON_BUILDER_PALETTE_SECTIONS: BuilderPaletteSection[] = [
  {
    id: "images",
    label: "Изображения",
    items: [
      item("images-stack", "image", "Изображение друг под другом"),
      item("images-carousel", "image", "Изображение в карусели"),
      item("images-gif", "image", "GIF анимация")
    ]
  },
  {
    id: "media",
    label: "Аудио и видео",
    items: [
      item("media-video", "video", "Видео"),
      item("media-audio-playback", "audio", "Аудиозапись"),
      item("media-audio-record", "speaking", "Запись аудио")
    ]
  },
  {
    id: "words_and_gaps",
    label: "Слова и пропуски",
    items: [
      item("fill-drag-word", "fill_gaps", "Перенести слово к пропуску"),
      item("fill-type-word", "fill_gaps", "Ввести слово в пропуск"),
      item("fill-choose-form", "fill_gaps", "Выбрать форму слова к пропуску"),
      item("fill-image-drag", "fill_gaps", "Перенести слово к изображению"),
      item("fill-image-type", "fill_gaps", "Ввести слово к изображению"),
      item("fill-image-form", "fill_gaps", "Выбрать форму слова к изображению")
    ]
  },
  {
    id: "tests",
    label: "Тесты",
    items: [
      item("quiz-no-timer", "quiz_single", "Тест без таймера", {
        initialMeta: { timerMinutes: 0 }
      }),
      item("quiz-timer", "quiz_single", "Тест с таймером", {
        initialMeta: { timerMinutes: 5 }
      })
    ]
  },
  {
    id: "right_answer",
    label: "Выбрать правильный ответ",
    items: [
      item("answer-true-false-unknown", "quiz_single", "Ложь, истина, неопределённо", {
        initialMeta: { timerMinutes: 0 },
        initialData: {
          quiz_single: {
            questions: [
              {
                prompt: "",
                options: ["Ложь", "Истина", "Неопределённо"],
                correctIndex: 1
              }
            ]
          }
        }
      })
    ]
  },
  {
    id: "ordering",
    label: "Расставить в правильном порядке",
    items: [
      item("order-sentence", "sentence_builder", "Предложение из слов"),
      item("order-columns", "matching", "Отсортировать слова по колонкам"),
      item("order-text", "sentence_builder", "Расставить текст по порядку"),
      item("order-letters", "sentence_builder", "Составить слово из букв"),
      item("order-match-words", "matching", "Сопоставить слова")
    ]
  },
  {
    id: "text_work",
    label: "Работа с текстом",
    items: [
      item("text-article", "text", "Статья"),
      item("text-essay", "text", "Сочинение"),
      item("text-default", "text", "Текст")
    ]
  },
  {
    id: "other",
    label: "Прочее",
    items: [
      item("other-wordset", "flashcards", "Набор слов для изучения"),
      item("other-note", "note", "Заметка"),
      item("other-link", "link", "Ссылка"),
      item("other-divider", "divider", "Разделяющая линия")
    ]
  }
]

export const LESSON_BUILDER_PALETTE: BuilderPaletteItem[] = LESSON_BUILDER_PALETTE_SECTIONS.flatMap((section) => section.items)

const neutralCircleClass = "bg-[var(--ds-neutral-row)] text-ds-ink"
const sageCircleClass = "bg-[var(--ds-sage)] text-ds-ink"
const inkCircleClass = "bg-[#1f1f1f] text-white dark:bg-[#f1f1f1] dark:text-[#111111]"
const pinkCircleClass = "bg-[var(--ds-pink)] text-ds-ink"
const skyCircleClass = "bg-[#eef7ff] text-[#1f1f1f] dark:bg-[#1d3134] dark:text-[#c8eff1]"

export const PALETTE_ITEM_VISUALS: Record<
  string,
  {
    icon: LucideIcon
    circleClass: string
    iconClass: string
  }
> = {
  "images-stack": { icon: Images, circleClass: neutralCircleClass, iconClass: "text-current" },
  "images-carousel": { icon: GalleryHorizontal, circleClass: neutralCircleClass, iconClass: "text-current" },
  "images-gif": { icon: GalleryVertical, circleClass: neutralCircleClass, iconClass: "text-current" },
  "media-video": { icon: PlaySquare, circleClass: neutralCircleClass, iconClass: "text-current" },
  "media-audio-playback": { icon: AudioLines, circleClass: neutralCircleClass, iconClass: "text-current" },
  "media-audio-record": { icon: Mic, circleClass: pinkCircleClass, iconClass: "text-current" },
  "fill-drag-word": { icon: HandGrab, circleClass: neutralCircleClass, iconClass: "text-current" },
  "fill-type-word": { icon: Keyboard, circleClass: neutralCircleClass, iconClass: "text-current" },
  "fill-choose-form": { icon: MousePointerClick, circleClass: neutralCircleClass, iconClass: "text-current" },
  "fill-image-drag": { icon: SquareDashedMousePointer, circleClass: neutralCircleClass, iconClass: "text-current" },
  "fill-image-type": { icon: FilePenLine, circleClass: neutralCircleClass, iconClass: "text-current" },
  "fill-image-form": { icon: SquareMousePointer, circleClass: neutralCircleClass, iconClass: "text-current" },
  "quiz-no-timer": { icon: TimerOff, circleClass: inkCircleClass, iconClass: "text-current" },
  "quiz-timer": { icon: Timer, circleClass: inkCircleClass, iconClass: "text-current" },
  "answer-true-false-unknown": { icon: BadgeCheck, circleClass: inkCircleClass, iconClass: "text-current" },
  "order-sentence": { icon: Shuffle, circleClass: sageCircleClass, iconClass: "text-current" },
  "order-columns": { icon: Columns2, circleClass: sageCircleClass, iconClass: "text-current" },
  "order-text": { icon: ScrollText, circleClass: sageCircleClass, iconClass: "text-current" },
  "order-letters": { icon: CaseSensitive, circleClass: sageCircleClass, iconClass: "text-current" },
  "order-match-words": { icon: ArrowLeftRight, circleClass: sageCircleClass, iconClass: "text-current" },
  "text-article": { icon: BookOpenText, circleClass: neutralCircleClass, iconClass: "text-current" },
  "text-essay": { icon: FilePenLine, circleClass: neutralCircleClass, iconClass: "text-current" },
  "text-default": { icon: Type, circleClass: neutralCircleClass, iconClass: "text-current" },
  "other-wordset": { icon: Layers3, circleClass: sageCircleClass, iconClass: "text-current" },
  "other-note": { icon: NotebookPen, circleClass: skyCircleClass, iconClass: "text-current" },
  "other-link": { icon: Link2, circleClass: skyCircleClass, iconClass: "text-current" },
  "other-divider": { icon: SeparatorHorizontal, circleClass: neutralCircleClass, iconClass: "text-current" }
}

export const BLOCK_ICON_REGISTRY: Record<
  LessonBlockType,
  {
    icon: LucideIcon
    circleClass: string
    cardClass: string
    iconClass: string
  }
> = {
  text: {
    icon: Type,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-ds-ink"
  },
  video: {
    icon: PlaySquare,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-ds-ink"
  },
  image: {
    icon: ImageIcon,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-ds-ink"
  },
  quiz_single: {
    icon: CheckCircle2,
    circleClass: inkCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  quiz_multi: {
    icon: CheckSquare2,
    circleClass: inkCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  matching: {
    icon: ArrowLeftRight,
    circleClass: sageCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  fill_gaps: {
    icon: Minus,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  sentence_builder: {
    icon: Shuffle,
    circleClass: sageCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  flashcards: {
    icon: Layers3,
    circleClass: sageCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  homework: {
    icon: NotebookPen,
    circleClass: pinkCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  audio: {
    icon: Headphones,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  pdf: {
    icon: FileText,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  speaking: {
    icon: Mic,
    circleClass: pinkCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  note: {
    icon: NotebookPen,
    circleClass: skyCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  link: {
    icon: Link2,
    circleClass: skyCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  },
  divider: {
    icon: SeparatorHorizontal,
    circleClass: neutralCircleClass,
    cardClass: "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]",
    iconClass: "text-current"
  }
}

const VARIANT_BEHAVIORS: Record<string, BlockVariantBehavior> = {
  "quiz-no-timer": {
    showTimerSetting: false,
    timedQuiz: false
  },
  "quiz-timer": {
    showTimerSetting: true,
    timedQuiz: true
  },
  "answer-true-false-unknown": {
    showTimerSetting: false,
    timedQuiz: false,
    quizMode: "true_false_unknown",
    lockQuizOptions: ["Ложь", "Истина", "Неопределённо"]
  },
  "order-columns": {
    matchingMode: "columns"
  },
  "order-sentence": {
    sentenceMode: "sentence"
  },
  "order-text": {
    sentenceMode: "text_order"
  },
  "order-letters": {
    sentenceMode: "letters"
  },
  "order-match-words": {
    matchingMode: "default"
  },
  "fill-drag-word": {
    fillMode: "drag_word"
  },
  "fill-type-word": {
    fillMode: "type_word"
  },
  "fill-choose-form": {
    fillMode: "choose_form"
  },
  "fill-image-drag": {
    fillMode: "image_drag"
  },
  "fill-image-type": {
    fillMode: "image_type"
  },
  "fill-image-form": {
    fillMode: "image_form"
  },
  "images-stack": {
    imageMode: "stack"
  },
  "images-carousel": {
    imageMode: "carousel"
  },
  "images-gif": {
    imageMode: "gif"
  }
}

export function lessonBlockLabel(type: LessonBlockType) {
  return LESSON_BLOCK_LABELS[type]
}

export function getPaletteItemVisual(item: Pick<BuilderPaletteItem, "id" | "type">) {
  return PALETTE_ITEM_VISUALS[item.id] ?? BLOCK_ICON_REGISTRY[item.type]
}

export function getBlockVisual(type: LessonBlockType, variantId?: string) {
  if (variantId && PALETTE_ITEM_VISUALS[variantId]) {
    return PALETTE_ITEM_VISUALS[variantId]
  }
  return BLOCK_ICON_REGISTRY[type]
}

export function getBlockVariantId(data: unknown) {
  return asVariantString((typeof data === "object" && data !== null ? (data as Record<string, unknown>).exercise_variant_id : "") ?? "")
}

export function getBlockVariantBehavior({
  type,
  data,
  variantId
}: {
  type: LessonBlockType
  data?: unknown
  variantId?: string
}): BlockVariantBehavior {
  const resolvedVariantId = variantId || getBlockVariantId(data)
  const specific = resolvedVariantId ? VARIANT_BEHAVIORS[resolvedVariantId] ?? {} : {}

  if (specific.showTimerSetting !== undefined) return specific
  if (type === "quiz_single" || type === "quiz_multi") {
    return {
      showTimerSetting: true,
      timedQuiz: false,
      ...specific
    }
  }
  return specific
}

function asVariantString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}
