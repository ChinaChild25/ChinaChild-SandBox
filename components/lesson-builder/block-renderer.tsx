"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, ExternalLink, Image as ImageIcon, Mic, Play, Upload } from "lucide-react"
import type { TeacherLessonBlock } from "@/lib/types"
import {
  asRecord,
  asString,
  asStringArray,
  extractBracketAnswers,
  normalizeTeacherLessonBlock,
  type FlashcardItem,
  type FillGapItem,
  type MatchingPair,
  type QuizMultiQuestion,
  type QuizSingleQuestion,
  type SentenceBuilderItem,
  type TextBlockItem
} from "@/lib/lesson-builder-blocks"
import { BLOCK_ICON_REGISTRY, getBlockVariantBehavior, getBlockVariantId } from "@/components/lesson-builder/block-registry"
import { LessonAudioPlayerRow } from "@/components/lesson-builder/lesson-audio-waveform"
import { InlineLessonVideo } from "@/components/lesson-builder/inline-lesson-video"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getLessonBlockDisplayTitle } from "@/lib/lesson-block-display"
import { useUiLocale } from "@/lib/ui-locale"
import { cn } from "@/lib/utils"

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededShuffle<T>(items: T[], seedKey: string): T[] {
  const next = [...items]
  let seed = hashString(seedKey) || 1
  for (let index = next.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const swapIndex = seed % (index + 1)
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function parseFillText(text: string) {
  const tokenRe = /\[([^[\]]*?)\]|___/g
  const parts: string[] = []
  const answers: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRe.exec(text)) !== null) {
    parts.push(text.slice(lastIndex, match.index))
    lastIndex = match.index + match[0].length
    answers.push((match[1] ?? "").trim())
  }

  parts.push(text.slice(lastIndex))
  return { parts, answers }
}

function normalizeTextItems(value: unknown): TextBlockItem[] {
  const items = Array.isArray(asRecord(value).items) ? (asRecord(value).items as unknown[]) : []
  return items.map((item) => ({
    content: asString(asRecord(item).content),
    questions: Array.isArray(asRecord(item).questions)
      ? (asRecord(item).questions as unknown[]).map((entry) => ({
          prompt: asString(asRecord(entry).prompt),
          answer: Boolean(asRecord(entry).answer)
        }))
      : []
  }))
}

function normalizePairs(value: unknown): MatchingPair[] {
  const pairs = Array.isArray(asRecord(value).pairs) ? (asRecord(value).pairs as unknown[]) : []
  return pairs.map((item) => ({
    left: asString(asRecord(item).left),
    right: asString(asRecord(item).right)
  }))
}

function normalizeFillGapItems(value: unknown): FillGapItem[] {
  const items = Array.isArray(asRecord(value).items) ? (asRecord(value).items as unknown[]) : []
  return items.map((item) => ({
    text: asString(asRecord(item).text),
    answers: asStringArray(asRecord(item).answers)
  }))
}

function normalizeSingleQuestions(value: unknown): QuizSingleQuestion[] {
  const questions = Array.isArray(asRecord(value).questions) ? (asRecord(value).questions as unknown[]) : []
  return questions.map((item) => ({
    prompt: asString(asRecord(item).prompt),
    options: asStringArray(asRecord(item).options),
    correctIndex: Number(asRecord(item).correctIndex ?? 0)
  }))
}

function normalizeMultiQuestions(value: unknown): QuizMultiQuestion[] {
  const questions = Array.isArray(asRecord(value).questions) ? (asRecord(value).questions as unknown[]) : []
  return questions.map((item) => ({
    prompt: asString(asRecord(item).prompt),
    options: asStringArray(asRecord(item).options),
    correctIndexes: Array.isArray(asRecord(item).correctIndexes)
      ? (asRecord(item).correctIndexes as unknown[]).map((index) => Number(index)).filter((index) => Number.isInteger(index) && index >= 0)
      : []
  }))
}

function normalizeSentenceItems(value: unknown): SentenceBuilderItem[] {
  const items = Array.isArray(asRecord(value).sentences) ? (asRecord(value).sentences as unknown[]) : []
  return items.map((item) => ({ source: asString(asRecord(item).source) }))
}

function normalizeFlashcards(value: unknown): FlashcardItem[] {
  const cards = Array.isArray(asRecord(value).cards) ? (asRecord(value).cards as unknown[]) : []
  return cards.map((item) => ({
    front: asString(asRecord(item).front),
    back: asString(asRecord(item).back),
    example: asString(asRecord(item).example)
  }))
}

const studentSelectTriggerClass =
  "h-11 w-full rounded-[14px] border-0 bg-[var(--ds-surface)] px-3.5 text-[15px] text-ds-ink shadow-none outline-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-0 focus-visible:ring-0"

const studentSelectContentClass =
  "rounded-[16px] border border-black/[0.08] bg-[var(--ds-surface)] p-1 text-ds-ink shadow-[0_18px_40px_-30px_rgba(0,0,0,0.2)] dark:border-white/[0.08]"

const studentMutedPanelClass = "rounded-[24px] bg-[var(--ds-surface-muted)] p-4"
const studentSoftFieldClass = "rounded-[18px] bg-[var(--ds-surface)] px-5 py-4 text-ds-ink"
const studentSelectedOptionClass =
  "bg-[color:color-mix(in_srgb,var(--ds-sage)_72%,var(--ds-surface))] text-ds-ink dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_24%,var(--ds-surface))]"
const studentAnswerChipClass =
  "rounded-full bg-[color:color-mix(in_srgb,var(--ds-sage)_70%,var(--ds-surface))] px-3 py-1.5 text-[14px] font-medium text-ds-ink dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_20%,var(--ds-surface))]"

export type BlockAssessment = {
  totalCount: number
  answeredCount: number
  correctCount: number
}

export type LessonResponseState = {
  singleAnswers: Record<string, string>
  multiAnswers: Record<string, number[]>
  matchAnswers: Record<string, string>
  fillAnswers: Record<string, string>
}

type TimedQuizRun = {
  durationSec: number
  remainingSec: number
  startedAt: number
  finished: boolean
}

function formatDuration(totalSec: number) {
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function remainingAnswerBank(allAnswers: string[], assignedAnswers: string[]) {
  const assignedCountByAnswer = new Map<string, number>()
  for (const answer of assignedAnswers) {
    const key = normalizeAnswer(answer)
    assignedCountByAnswer.set(key, (assignedCountByAnswer.get(key) ?? 0) + 1)
  }

  return allAnswers.filter((answer) => {
    const key = normalizeAnswer(answer)
    const remaining = assignedCountByAnswer.get(key) ?? 0
    if (remaining <= 0) return true
    assignedCountByAnswer.set(key, remaining - 1)
    return false
  })
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase()
}

function createAnswerChipDragPreview(answer: string) {
  if (typeof document === "undefined") return null
  const chip = document.createElement("div")
  chip.textContent = answer
  chip.style.position = "fixed"
  chip.style.top = "-1000px"
  chip.style.left = "-1000px"
  chip.style.pointerEvents = "none"
  chip.style.zIndex = "2147483647"
  chip.style.display = "inline-flex"
  chip.style.alignItems = "center"
  chip.style.justifyContent = "center"
  chip.style.whiteSpace = "nowrap"
  chip.style.padding = "8px 14px"
  chip.style.borderRadius = "999px"
  chip.style.background = "#dceaa6"
  chip.style.color = "#1f1f1f"
  chip.style.fontSize = "14px"
  chip.style.fontWeight = "600"
  chip.style.lineHeight = "1"
  chip.style.boxShadow = "0 18px 38px -24px rgba(0, 0, 0, 0.34)"
  document.body.appendChild(chip)
  return chip
}

export function evaluateBlockAssessment(
  block: TeacherLessonBlock,
  state: {
    singleAnswers: Record<string, string>
    multiAnswers: Record<string, number[]>
    matchAnswers: Record<string, string>
    fillAnswers: Record<string, string>
  }
): BlockAssessment {
  const normalized = normalizeTeacherLessonBlock(block)
  const data = asRecord(normalized.data)
  const variantId = getBlockVariantId(data)
  const variantBehavior = getBlockVariantBehavior({ type: normalized.type, data, variantId })
  let totalCount = 0
  let answeredCount = 0
  let correctCount = 0

  if (normalized.type === "text") {
    for (const [itemIndex, item] of normalizeTextItems(data.text).entries()) {
      for (const [questionIndex, question] of item.questions.entries()) {
        totalCount += 1
        const answerKey = `${normalized.id}-text-${itemIndex}-${questionIndex}`
        const selected = state.singleAnswers[answerKey]
        if (selected) {
          answeredCount += 1
          const expected = question.answer ? "true" : "false"
          if (selected === expected) correctCount += 1
        }
      }
    }
  }

  if (normalized.type === "matching") {
    for (const [pairIndex, pair] of normalizePairs(data.matching).entries()) {
      totalCount += 1
      const answerKey = `${normalized.id}-match-${pairIndex}`
      const selected = state.matchAnswers[answerKey]
      if (selected) {
        answeredCount += 1
        if (normalizeAnswer(selected) === normalizeAnswer(pair.right)) correctCount += 1
      }
    }
  }

  if (normalized.type === "fill_gaps") {
    for (const [itemIndex, item] of normalizeFillGapItems(data.fill_gaps).entries()) {
      const parsed = parseFillText(item.text)
      const answers = parsed.answers.length > 0 ? parsed.answers : item.answers
      const isImageVariant = variantBehavior.fillMode?.startsWith("image_")

      if (isImageVariant) {
        const expected = answers[0]?.trim() ?? ""
        if (!expected) continue
        totalCount += 1
        const answerKey = `${normalized.id}-${itemIndex}-image`
        const selected = state.fillAnswers[answerKey]?.trim() ?? ""
        if (selected) {
          answeredCount += 1
          if (normalizeAnswer(selected) === normalizeAnswer(expected)) correctCount += 1
        }
        continue
      }

      for (const [gapIndex, expected] of answers.entries()) {
        totalCount += 1
        const answerKey = `${normalized.id}-${itemIndex}-${gapIndex}`
        const selected = state.fillAnswers[answerKey]?.trim() ?? ""
        if (selected) {
          answeredCount += 1
          if (normalizeAnswer(selected) === normalizeAnswer(expected)) correctCount += 1
        }
      }
    }
  }

  if (normalized.type === "quiz_single") {
    for (const [questionIndex, question] of normalizeSingleQuestions(data.quiz_single).entries()) {
      totalCount += 1
      const answerKey = `${normalized.id}-single-${questionIndex}`
      const selected = state.singleAnswers[answerKey]
      if (selected !== undefined) {
        answeredCount += 1
        if (selected === String(question.correctIndex)) correctCount += 1
      }
    }
  }

  if (normalized.type === "quiz_multi") {
    for (const [questionIndex, question] of normalizeMultiQuestions(data.quiz_multi).entries()) {
      totalCount += 1
      const answerKey = `${normalized.id}-multi-${questionIndex}`
      const selected = state.multiAnswers[answerKey] ?? []
      if (selected.length > 0) {
        answeredCount += 1
        const normalizedSelected = [...selected].sort((left, right) => left - right)
        const normalizedExpected = [...question.correctIndexes].sort((left, right) => left - right)
        if (
          normalizedSelected.length === normalizedExpected.length &&
          normalizedSelected.every((value, index) => value === normalizedExpected[index])
        ) {
          correctCount += 1
        }
      }
    }
  }

  return { totalCount, answeredCount, correctCount }
}

export function BlockRenderer({
  blocks,
  lessonTitle,
  indexOffset = 0,
  onBlockAssessmentChange,
  initialResponseState,
  onResponseStateChange,
  onBlockCompletionStateChange,
}: {
  blocks: TeacherLessonBlock[]
  lessonTitle?: string
  taskBadgeColor?: string
  indexOffset?: number
  onBlockAssessmentChange?: (blockId: string, assessment: BlockAssessment) => void
  initialResponseState?: LessonResponseState | null
  onResponseStateChange?: (state: LessonResponseState) => void
  onBlockCompletionStateChange?: (blockId: string, completed: boolean) => void
}) {
  const { locale } = useUiLocale()
  const normalizedBlocks = useMemo(
    () => [...blocks].map(normalizeTeacherLessonBlock).sort((left, right) => left.order - right.order),
    [blocks]
  )
  const [singleAnswers, setSingleAnswers] = useState<Record<string, string>>(initialResponseState?.singleAnswers ?? {})
  const [multiAnswers, setMultiAnswers] = useState<Record<string, number[]>>(initialResponseState?.multiAnswers ?? {})
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>(initialResponseState?.matchAnswers ?? {})
  const [fillAnswers, setFillAnswers] = useState<Record<string, string>>(initialResponseState?.fillAnswers ?? {})
  const [selectedFillAnswer, setSelectedFillAnswer] = useState<{
    blockId: string
    itemIndex: number
    answer: string
    sourceKey?: string
  } | null>(null)
  const [hoveredDropTarget, setHoveredDropTarget] = useState<string | null>(null)
  const [audioTrackCompletion, setAudioTrackCompletion] = useState<Record<string, boolean>>({})
  const [timedQuizRuns, setTimedQuizRuns] = useState<Record<string, TimedQuizRun>>({})
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({})
  const [hydratedFromSavedState, setHydratedFromSavedState] = useState(false)

  useEffect(() => {
    if (hydratedFromSavedState) return
    if (!initialResponseState) {
      setHydratedFromSavedState(true)
      return
    }
    setSingleAnswers(initialResponseState.singleAnswers ?? {})
    setMultiAnswers(initialResponseState.multiAnswers ?? {})
    setMatchAnswers(initialResponseState.matchAnswers ?? {})
    setFillAnswers(initialResponseState.fillAnswers ?? {})
    setHydratedFromSavedState(true)
  }, [hydratedFromSavedState, initialResponseState])

  useEffect(() => {
    const running = Object.values(timedQuizRuns).some((run) => !run.finished)
    if (!running) return

    const interval = window.setInterval(() => {
      const now = Date.now()
      setTimedQuizRuns((prev) => {
        let changed = false
        const next: Record<string, TimedQuizRun> = {}

        for (const [key, run] of Object.entries(prev)) {
          if (run.finished) {
            next[key] = run
            continue
          }
          const elapsedSec = Math.max(0, Math.floor((now - run.startedAt) / 1000))
          const remainingSec = Math.max(0, run.durationSec - elapsedSec)
          const finished = remainingSec === 0
          if (remainingSec !== run.remainingSec || finished !== run.finished) changed = true
          next[key] = {
            ...run,
            remainingSec,
            finished
          }
        }

        return changed ? next : prev
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [timedQuizRuns])

  function startTimedQuiz(blockId: string, timerMinutes: number) {
    const durationSec = Math.max(1, Math.round(timerMinutes * 60))
    setTimedQuizRuns((prev) => ({
      ...prev,
      [blockId]: {
        durationSec,
        remainingSec: durationSec,
        startedAt: Date.now(),
        finished: false
      }
    }))
  }

  useEffect(() => {
    if (!onBlockAssessmentChange) return

    for (const block of normalizedBlocks) {
      onBlockAssessmentChange(
        block.id,
        evaluateBlockAssessment(block, {
          singleAnswers,
          multiAnswers,
          matchAnswers,
          fillAnswers
        })
      )
    }
  }, [fillAnswers, matchAnswers, multiAnswers, normalizedBlocks, onBlockAssessmentChange, singleAnswers])

  useEffect(() => {
    if (!onResponseStateChange) return
    onResponseStateChange({
      singleAnswers,
      multiAnswers,
      matchAnswers,
      fillAnswers,
    })
  }, [fillAnswers, matchAnswers, multiAnswers, onResponseStateChange, singleAnswers])

  function beginFillAnswerDrag(event: React.DragEvent<HTMLButtonElement>, answer: string) {
    beginFillAnswerDragWithSource(event, answer)
  }

  function beginFillAnswerDragWithSource(
    event: React.DragEvent<HTMLButtonElement>,
    answer: string,
    sourceKey?: string
  ) {
    const preview = createAnswerChipDragPreview(answer)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", answer)
    if (sourceKey) {
      event.dataTransfer.setData("application/x-chinachild-fill-source", sourceKey)
    }
    if (preview) {
      event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2)
      window.setTimeout(() => preview.remove(), 0)
    }
  }

  function applyFillPlacement(
    prev: Record<string, string>,
    targetKey: string,
    answer: string,
    sourceKey?: string
  ) {
    const next = { ...prev }
    const previousTargetAnswer = next[targetKey] ?? ""
    next[targetKey] = answer
    if (sourceKey && sourceKey !== targetKey) {
      if (previousTargetAnswer) next[sourceKey] = previousTargetAnswer
      else delete next[sourceKey]
    }
    return next
  }

  return (
    <div className="space-y-5">
      {normalizedBlocks.map((block, blockIndex) => {
        const visual = BLOCK_ICON_REGISTRY[block.type]
        const Icon = visual.icon
        const data = asRecord(block.data)
        const variantId = getBlockVariantId(data)
        const variantBehavior = getBlockVariantBehavior({ type: block.type, data, variantId })
        const meta = asRecord(data.meta)
        const title = getLessonBlockDisplayTitle(block, locale)
        const instruction = asString(meta.instruction).trim()

        if (block.type === "hero") {
          const hero = asRecord(data.hero)
          const eyebrow = asString(hero.eyebrow).trim() || "Индивидуальный урок"
          const lead = asString(hero.lead).trim() || instruction
          const imageUrl = asString(hero.imageUrl).trim()
          const imagePosition = asString(hero.imagePosition).trim() || "72% 50%"
          const imageScaleRaw = Number(hero.imageScale)
          const imageScale = Number.isFinite(imageScaleRaw) ? Math.max(0.5, Math.min(2, imageScaleRaw)) : 1
          const imageFlipX = hero.imageFlipX === true
          const imageFlipY = hero.imageFlipY === true
          const heroTitle = lessonTitle?.trim() || title || "Урок"

          return (
            <section
              key={block.id}
              className="overflow-hidden rounded-[32px] bg-[color:color-mix(in_srgb,var(--ds-sage)_58%,var(--ds-surface))] p-4 shadow-[0_26px_72px_-44px_rgba(0,0,0,0.2)] dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_16%,var(--ds-surface))] sm:p-5 lg:p-6"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-stretch">
                <div className="rounded-[28px] bg-[var(--ds-surface)]/80 p-6 backdrop-blur-sm dark:bg-[var(--ds-surface)]/70 sm:p-7">
                  <div className="inline-flex items-center rounded-full bg-[var(--ds-surface)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ds-text-secondary">
                    {eyebrow}
                  </div>
                  <h2 className="mt-5 text-[clamp(2rem,4vw,3.8rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-ds-ink">
                    {heroTitle}
                  </h2>
                  {lead ? (
                    <p className="mt-4 max-w-[34ch] text-[15px] leading-7 text-ds-text-secondary sm:text-[16px]">
                      {lead}
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-[28px] bg-[var(--ds-surface)]/70 dark:bg-[var(--ds-surface)]/55">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={heroTitle}
                      className="aspect-[4/3] h-full w-full object-cover lg:aspect-auto"
                      style={{
                        objectPosition: imagePosition,
                        transform: `scale(${imageScale}) scaleX(${imageFlipX ? -1 : 1}) scaleY(${imageFlipY ? -1 : 1})`,
                        transformOrigin: imagePosition,
                      }}
                    />
                  ) : (
                    <div className="flex aspect-[4/3] h-full min-h-[260px] items-center justify-center px-8 text-center text-[15px] leading-7 text-ds-text-secondary">
                      Добавьте изображение в редакторе, чтобы у урока появился первый экран с обложкой.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        return (
          <section
            key={block.id}
            className="overflow-hidden rounded-[32px] border border-black/[0.06] bg-[var(--ds-surface)] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.18)] dark:border-white/[0.08]"
          >
            <div className="flex items-center gap-4 px-5 py-5 sm:px-7">
              <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-full", visual.circleClass)}>
                <Icon className={cn("h-7 w-7", visual.iconClass)} strokeWidth={1.9} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                  Блок {blockIndex + 1 + indexOffset}
                </div>
                <h2 className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em] text-ds-ink sm:text-[28px]">
                  {title}
                </h2>
                {instruction ? <p className="mt-2 text-[15px] leading-6 text-ds-text-secondary">{instruction}</p> : null}
              </div>
            </div>

            <div className="border-t border-black/[0.06] px-5 py-5 dark:border-white/[0.08] sm:px-7 sm:py-6">
              {block.type === "text" ? (
                <div className="space-y-5">
                  {normalizeTextItems(data.text).map((item, itemIndex) => (
                    <article key={`${block.id}-text-${itemIndex}`} className="space-y-4">
                      {item.content ? (
                        <div className={cn(studentMutedPanelClass, "px-5 py-4 text-[18px] leading-8 text-ds-ink")}>
                          {item.content}
                        </div>
                      ) : null}
                      {item.questions.length > 0 ? (
                        <div className="space-y-3">
                          {item.questions.map((question, questionIndex) => (
                            <div
                              key={`${block.id}-text-q-${questionIndex}`}
                              className="grid gap-3 rounded-[20px] bg-[var(--ds-surface)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(176px,220px)] md:items-start"
                            >
                              <span className="max-w-[52rem] text-[16px] leading-7 text-ds-ink">{question.prompt}</span>
                              <Select
                                value={singleAnswers[`${block.id}-text-${itemIndex}-${questionIndex}`] || undefined}
                                onValueChange={(value) =>
                                  setSingleAnswers((prev) => ({
                                    ...prev,
                                    [`${block.id}-text-${itemIndex}-${questionIndex}`]: value
                                  }))
                                }
                              >
                                <SelectTrigger className={cn(studentSelectTriggerClass, "h-11 w-full max-w-[220px] justify-self-start md:justify-self-end")}>
                                  <SelectValue placeholder="Выберите" />
                                </SelectTrigger>
                                <SelectContent className={studentSelectContentClass}>
                                  <SelectItem value="false">Ложь</SelectItem>
                                  <SelectItem value="true">Истина</SelectItem>
                                  <SelectItem value="unknown">Неопределённо</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {block.type === "matching" ? (
                <div className="space-y-3">
                  {(() => {
                    const pairs = normalizePairs(data.matching)
                    const options = seededShuffle(pairs.map((pair) => pair.right).filter(Boolean), block.id)
                    const categories = [...new Set(pairs.map((pair) => pair.right).filter(Boolean))]
                    return pairs.map((pair, pairIndex) => {
                      const answerKey = `${block.id}-match-${pairIndex}`
                      return (
                        <div key={answerKey} className="rounded-[22px] bg-[var(--ds-surface-muted)] px-4 py-4">
                          <div className="mx-auto flex max-w-[720px] flex-col items-center gap-3 md:flex-row md:items-stretch md:justify-center">
                            <div className="flex h-[72px] w-full max-w-[280px] items-center rounded-[20px] bg-[var(--ds-surface)] px-5 text-[18px] text-ds-ink">
                              {pair.left || "—"}
                            </div>
                            <div className="w-full max-w-[280px]">
                              <Select
                                value={matchAnswers[answerKey] || undefined}
                                onValueChange={(value) =>
                                  setMatchAnswers((prev) => ({
                                    ...prev,
                                    [answerKey]: value
                                  }))
                                }
                              >
                                <SelectTrigger className={cn(studentSelectTriggerClass, "!h-[72px] rounded-[20px] px-5 text-[18px]")}>
                                  <SelectValue placeholder="Выберите вариант" />
                                </SelectTrigger>
                                <SelectContent className={studentSelectContentClass}>
                                  {(variantBehavior.matchingMode === "columns" ? categories : options).map((option, optionIndex) => (
                                    <SelectItem key={`${answerKey}-option-${optionIndex}`} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : null}

              {block.type === "fill_gaps" ? (
                <div className="space-y-4">
                  {normalizeFillGapItems(data.fill_gaps).map((item, itemIndex) => {
                    const parsed = parseFillText(item.text)
                    const answers = parsed.answers.length > 0 ? parsed.answers : item.answers
                    const isChoiceVariant = variantBehavior.fillMode === "choose_form" || variantBehavior.fillMode === "image_form"
                    const isImageVariant = variantBehavior.fillMode?.startsWith("image_")
                    const isDragVariant = variantBehavior.fillMode === "drag_word" || variantBehavior.fillMode === "image_drag"
                    const selectedAnswer =
                      selectedFillAnswer?.blockId === block.id && selectedFillAnswer?.itemIndex === itemIndex
                        ? selectedFillAnswer.answer
                        : null
                    const assignedAnswers = isImageVariant
                      ? [fillAnswers[`${block.id}-${itemIndex}-image`] || ""].filter(Boolean)
                      : answers
                          .map((_, gapIndex) => fillAnswers[`${block.id}-${itemIndex}-${gapIndex}`] || "")
                          .filter(Boolean)
                    const bankAnswers = remainingAnswerBank(answers, assignedAnswers)
                    const bankDropTargetKey = `${block.id}-${itemIndex}-bank`
                    return (
                      <div key={`${block.id}-fill-${itemIndex}`} className={cn(!isImageVariant && "rounded-[24px] bg-[var(--ds-surface-muted)] p-4")}>
                        {isImageVariant ? (
                          <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-4">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.text || `Карточка ${itemIndex + 1}`}
                                className="aspect-square w-full rounded-[22px] object-cover"
                              />
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center rounded-[22px] bg-[var(--ds-surface-muted)] text-ds-text-secondary">
                                <ImageIcon className="h-14 w-14 opacity-55" strokeWidth={1.6} aria-hidden />
                              </div>
                            )}
                            {isDragVariant ? (
                              <>
                                {(() => {
                                  const imageAnswerKey = `${block.id}-${itemIndex}-image`
                                    const isHovered = hoveredDropTarget === imageAnswerKey
                                  return (
                                <button
                                  type="button"
                                  draggable={Boolean(fillAnswers[`${block.id}-${itemIndex}-image`])}
                                  className={cn(
                                    "inline-flex min-h-[52px] w-full items-center justify-center rounded-[18px] px-4 py-3 text-[16px] font-medium transition-colors",
                                    fillAnswers[`${block.id}-${itemIndex}-image`]
                                      ? "bg-[color:color-mix(in_srgb,var(--ds-sage)_48%,var(--ds-surface))] text-ds-ink"
                                      : "bg-[var(--ds-surface-muted)] text-ds-text-secondary",
                                    isHovered && "ring-2 ring-[var(--ds-sage)] bg-[color:color-mix(in_srgb,var(--ds-sage)_18%,var(--ds-surface))]"
                                  )}
                                  onClick={() => {
                                    if (selectedAnswer) {
                                      setFillAnswers((prev) =>
                                        applyFillPlacement(prev, `${block.id}-${itemIndex}-image`, selectedAnswer, selectedFillAnswer?.sourceKey)
                                      )
                                      setSelectedFillAnswer(null)
                                      return
                                    }
                                    setFillAnswers((prev) => {
                                      const next = { ...prev }
                                      delete next[`${block.id}-${itemIndex}-image`]
                                      return next
                                    })
                                  }}
                                  onDragStart={(event) => {
                                    const current = fillAnswers[`${block.id}-${itemIndex}-image`]
                                    if (!current) return
                                    beginFillAnswerDragWithSource(event, current, `${block.id}-${itemIndex}-image`)
                                  }}
                                  onDragEnd={() => {
                                    setHoveredDropTarget(null)
                                  }}
                                  onDragOver={(event) => {
                                    event.preventDefault()
                                    setHoveredDropTarget((prev) => (prev === imageAnswerKey ? prev : imageAnswerKey))
                                    event.dataTransfer.dropEffect = "move"
                                  }}
                                  onDragEnter={() => {
                                    setHoveredDropTarget(imageAnswerKey)
                                  }}
                                  onDragLeave={() => {
                                    setHoveredDropTarget((prev) => (prev === imageAnswerKey ? null : prev))
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    const sourceKey =
                                      selectedFillAnswer?.sourceKey || event.dataTransfer.getData("application/x-chinachild-fill-source") || undefined
                                    const answer = selectedAnswer || event.dataTransfer.getData("text/plain")
                                    if (!answer) return
                                    setFillAnswers((prev) =>
                                      applyFillPlacement(prev, imageAnswerKey, answer, sourceKey)
                                    )
                                    setHoveredDropTarget(null)
                                    setSelectedFillAnswer(null)
                                  }}
                                >
                                  {fillAnswers[`${block.id}-${itemIndex}-image`] || "Выберите слово и нажмите сюда"}
                                </button>
                                  )
                                })()}
                                {bankAnswers.length > 0 ? (
                                  <div className="space-y-3">
                                    <p className="text-[14px] text-ds-text-secondary">
                                      Выберите слово ниже и нажмите на поле под изображением.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {bankAnswers.map((answer, answerIndex) => (
                                        <button
                                          key={`${block.id}-image-drag-${itemIndex}-${answerIndex}`}
                                          type="button"
                                          draggable
                                          className={cn(
                                            studentAnswerChipClass,
                                            "cursor-grab active:cursor-grabbing",
                                            selectedAnswer === answer && "ring-2 ring-black/15 dark:ring-white/20"
                                          )}
                                          onClick={() => {
                                            setSelectedFillAnswer((prev) =>
                                              prev?.blockId === block.id && prev?.itemIndex === itemIndex && prev?.answer === answer
                                                ? null
                                                : { blockId: block.id, itemIndex, answer, sourceKey: undefined }
                                            )
                                          }}
                                          onDragStart={(event) => {
                                            beginFillAnswerDragWithSource(event, answer)
                                          }}
                                          onDragEnd={() => {
                                            setHoveredDropTarget(null)
                                          }}
                                        >
                                          {answer}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : isChoiceVariant ? (
                              <Select
                                value={fillAnswers[`${block.id}-${itemIndex}-image`] || undefined}
                                onValueChange={(value) =>
                                  setFillAnswers((prev) => ({
                                    ...prev,
                                    [`${block.id}-${itemIndex}-image`]: value
                                  }))
                                }
                              >
                                <SelectTrigger className={cn(studentSelectTriggerClass, "w-full")}>
                                  <SelectValue placeholder="Выберите слово" />
                                </SelectTrigger>
                                <SelectContent className={studentSelectContentClass}>
                                  {answers.map((answer, answerIndex) => (
                                    <SelectItem key={`${block.id}-image-answer-${itemIndex}-${answerIndex}`} value={answer}>
                                      {answer}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <input
                                value={fillAnswers[`${block.id}-${itemIndex}-image`] ?? ""}
                                onChange={(event) =>
                                  setFillAnswers((prev) => ({
                                    ...prev,
                                    [`${block.id}-${itemIndex}-image`]: event.target.value
                                  }))
                                }
                                className="inline-flex h-11 w-full rounded-[14px] bg-[var(--ds-surface-muted)] px-3 text-[16px] text-ds-ink outline-none"
                                placeholder="Введите слово"
                              />
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2 text-[18px] leading-8 text-ds-ink">
                                  {parsed.parts.map((part, partIndex) => {
                                const gapIndex = partIndex
                                const hasGapAfter = gapIndex < answers.length
                                const answerKey = `${block.id}-${itemIndex}-${gapIndex}`
                                const currentAnswer = fillAnswers[answerKey] ?? ""
                                return (
                                  <span key={`${block.id}-fill-part-${itemIndex}-${partIndex}`}>
                                    {part}
                                    {hasGapAfter ? (
                                      isChoiceVariant ? (
                                        <span className="mx-2 inline-flex w-48 align-middle">
                                          <Select
                                            value={fillAnswers[`${block.id}-${itemIndex}-${gapIndex}`] || undefined}
                                            onValueChange={(value) =>
                                              setFillAnswers((prev) => ({
                                                ...prev,
                                                [`${block.id}-${itemIndex}-${gapIndex}`]: value
                                              }))
                                            }
                                          >
                                            <SelectTrigger className={cn(studentSelectTriggerClass, "h-11 rounded-[14px]")}>
                                              <SelectValue placeholder="Выберите форму" />
                                            </SelectTrigger>
                                            <SelectContent className={studentSelectContentClass}>
                                              {answers.map((answer, answerIndex) => (
                                                <SelectItem key={`${block.id}-choice-${itemIndex}-${answerIndex}`} value={answer}>
                                                  {answer}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </span>
                                      ) : isDragVariant ? (
                                        <button
                                          type="button"
                                          draggable={Boolean(currentAnswer)}
                                          className={cn(
                                            "mx-2 inline-flex min-h-[44px] min-w-[9rem] items-center justify-center rounded-[16px] px-4 py-2 align-middle text-[15px] font-medium transition-colors",
                                            currentAnswer
                                              ? "bg-[color:color-mix(in_srgb,var(--ds-sage)_48%,var(--ds-surface))] text-ds-ink"
                                              : "bg-[var(--ds-surface)] text-ds-text-secondary",
                                            hoveredDropTarget === answerKey &&
                                              "ring-2 ring-[var(--ds-sage)] bg-[color:color-mix(in_srgb,var(--ds-sage)_18%,var(--ds-surface))]"
                                          )}
                                          onClick={() => {
                                            if (selectedAnswer) {
                                              setFillAnswers((prev) =>
                                                applyFillPlacement(prev, answerKey, selectedAnswer, selectedFillAnswer?.sourceKey)
                                              )
                                              setSelectedFillAnswer(null)
                                              return
                                            }
                                            setFillAnswers((prev) => {
                                              const next = { ...prev }
                                              delete next[answerKey]
                                              return next
                                            })
                                          }}
                                          onDragStart={(event) => {
                                            if (!currentAnswer) return
                                            beginFillAnswerDragWithSource(event, currentAnswer, answerKey)
                                          }}
                                          onDragEnd={() => {
                                            setHoveredDropTarget(null)
                                          }}
                                          onDragOver={(event) => {
                                            event.preventDefault()
                                            setHoveredDropTarget((prev) => (prev === answerKey ? prev : answerKey))
                                            event.dataTransfer.dropEffect = "move"
                                          }}
                                          onDragEnter={() => {
                                            setHoveredDropTarget(answerKey)
                                          }}
                                          onDragLeave={() => {
                                            setHoveredDropTarget((prev) => (prev === answerKey ? null : prev))
                                          }}
                                          onDrop={(event) => {
                                            event.preventDefault()
                                            const sourceKey =
                                              selectedFillAnswer?.sourceKey || event.dataTransfer.getData("application/x-chinachild-fill-source") || undefined
                                            const answer = selectedAnswer || event.dataTransfer.getData("text/plain")
                                            if (!answer) return
                                            setFillAnswers((prev) => applyFillPlacement(prev, answerKey, answer, sourceKey))
                                            setHoveredDropTarget(null)
                                            setSelectedFillAnswer(null)
                                          }}
                                        >
                                          {currentAnswer || "Выберите слово"}
                                        </button>
                                      ) : (
                                        <input
                                          value={currentAnswer}
                                          onChange={(event) =>
                                            setFillAnswers((prev) => ({
                                              ...prev,
                                              [answerKey]: event.target.value
                                            }))
                                          }
                                          className="mx-2 inline-flex h-11 w-40 rounded-[14px] bg-[var(--ds-surface)] px-3 text-[16px] text-ds-ink outline-none"
                                        />
                                      )
                                    ) : null}
                                  </span>
                                )
                              })}
                            </div>
                            {isDragVariant && (bankAnswers.length > 0 || assignedAnswers.length > 0) ? (
                              <div
                                className={cn(
                                  "mt-4 space-y-3 rounded-[18px] px-3 py-3 transition-colors",
                                  hoveredDropTarget === bankDropTargetKey &&
                                    "bg-[color:color-mix(in_srgb,var(--ds-sage)_16%,var(--ds-surface))] ring-2 ring-[var(--ds-sage)]"
                                )}
                                onDragOver={(event) => {
                                  event.preventDefault()
                                  setHoveredDropTarget(bankDropTargetKey)
                                  event.dataTransfer.dropEffect = "move"
                                }}
                                onDragEnter={() => {
                                  setHoveredDropTarget(bankDropTargetKey)
                                }}
                                onDragLeave={() => {
                                  setHoveredDropTarget((prev) => (prev === bankDropTargetKey ? null : prev))
                                }}
                                onDrop={(event) => {
                                  event.preventDefault()
                                  const sourceKey =
                                    selectedFillAnswer?.sourceKey || event.dataTransfer.getData("application/x-chinachild-fill-source") || undefined
                                  if (sourceKey) {
                                    setFillAnswers((prev) => {
                                      const next = { ...prev }
                                      delete next[sourceKey]
                                      return next
                                    })
                                  }
                                  setSelectedFillAnswer(null)
                                  setHoveredDropTarget(null)
                                }}
                              >
                                <p className="text-[14px] text-ds-text-secondary">
                                  Перетащите слово в пропуск или нажмите на слово и затем на нужное место. Чтобы вернуть слово обратно, перетащите его в банк или нажмите на уже заполненный пропуск.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {seededShuffle(bankAnswers, `${block.id}-${itemIndex}-bank`).map((answer, answerIndex) => (
                                    <button
                                      key={`${block.id}-answer-${itemIndex}-${answerIndex}`}
                                      type="button"
                                      draggable
                                      className={cn(
                                        studentAnswerChipClass,
                                        "cursor-grab active:cursor-grabbing",
                                        selectedAnswer === answer && "ring-2 ring-black/15 dark:ring-white/20"
                                      )}
                                      onClick={() => {
                                        setSelectedFillAnswer((prev) =>
                                          prev?.blockId === block.id && prev?.itemIndex === itemIndex && prev?.answer === answer
                                            ? null
                                            : { blockId: block.id, itemIndex, answer, sourceKey: undefined }
                                        )
                                      }}
                                      onDragStart={(event) => {
                                        beginFillAnswerDragWithSource(event, answer)
                                      }}
                                      onDragEnd={() => {
                                        setHoveredDropTarget(null)
                                      }}
                                    >
                                      {answer}
                                    </button>
                                  ))}
                                </div>
                                {bankAnswers.length === 0 ? (
                                  <div className="rounded-[14px] bg-[var(--ds-surface)] px-4 py-3 text-[14px] text-ds-text-secondary">
                                    Все слова уже расставлены. Снимите слово с пропуска или перетащите его обратно сюда, если хотите поменять ответ.
                                  </div>
                                ) : null}
                              </div>
                            ) : !isChoiceVariant && answers.length > 0 ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {seededShuffle(answers, `${block.id}-${itemIndex}-bank`).map((answer, answerIndex) => (
                                  <span key={`${block.id}-answer-${itemIndex}-${answerIndex}`} className={studentAnswerChipClass}>
                                    {answer}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "sentence_builder" ? (
                <div className="space-y-4">
                  {normalizeSentenceItems(data.sentence_builder).map((item, itemIndex) => {
                    const sentenceMode = variantBehavior.sentenceMode ?? "sentence"
                    const words =
                      sentenceMode === "letters"
                        ? seededShuffle(Array.from(item.source.replace(/\s+/g, "")), `${block.id}-${itemIndex}-letters`)
                        : item.source.split(/\s+/).filter(Boolean)
                    return (
                      <div key={`${block.id}-sentence-${itemIndex}`} className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                        <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                          {sentenceMode === "letters" ? `Слово ${itemIndex + 1}` : sentenceMode === "text_order" ? `Фрагмент ${itemIndex + 1}` : `Предложение ${itemIndex + 1}`}
                        </div>
                        <p className="mt-3 rounded-[16px] bg-[var(--ds-surface)] px-4 py-3 text-[20px] leading-8 text-ds-ink">
                          {item.source || "Введите предложение в редакторе"}
                        </p>
                        <p className="mt-4 text-[14px] text-ds-text-tertiary">Так его увидит ученик:</p>
                        {sentenceMode === "text_order" ? (
                          <div className="mt-3 space-y-2">
                            {seededShuffle(words, `${block.id}-${itemIndex}-chips`).map((word, wordIndex) => (
                              <div
                                key={`${block.id}-chip-${itemIndex}-${wordIndex}`}
                                className="rounded-[14px] bg-[var(--ds-surface)] px-4 py-2 text-[16px] text-ds-text-secondary"
                              >
                                {word}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {seededShuffle(words, `${block.id}-${itemIndex}-chips`).map((word, wordIndex) => (
                              <span
                                key={`${block.id}-chip-${itemIndex}-${wordIndex}`}
                                className="rounded-[14px] bg-[var(--ds-surface)] px-4 py-2 text-[16px] text-ds-text-secondary"
                              >
                                {word}
                              </span>
                            ))}
                            {sentenceMode === "letters"
                              ? Array.from({ length: words.length }).map((_, slotIndex) => (
                                  <span key={`${block.id}-letter-slot-${itemIndex}-${slotIndex}`} className="h-10 w-10 rounded-[12px] bg-[var(--ds-surface)]/92" />
                                ))
                              : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "flashcards" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {normalizeFlashcards(data.flashcards).map((card, cardIndex) => (
                    <article
                      key={`${block.id}-flashcard-${cardIndex}`}
                      className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[var(--ds-surface)] dark:border-white/[0.08]"
                    >
                      <div className="bg-[linear-gradient(135deg,color-mix(in_srgb,var(--ds-sage)_78%,#ffffff),color-mix(in_srgb,var(--ds-sage)_58%,#ffffff))] px-5 py-5">
                        <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                          Лицевая
                        </div>
                        <div className="mt-3 text-[34px] font-semibold text-ds-ink">{card.front || "—"}</div>
                      </div>
                      <div className="space-y-3 px-5 py-5">
                        <div>
                          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                            Обратная
                          </div>
                          <div className="mt-2 text-[18px] text-ds-ink">{card.back || "—"}</div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                            Пример
                          </div>
                          <div className="mt-2 rounded-[14px] bg-[var(--ds-surface-muted)] px-3 py-2 text-[15px] text-ds-text-secondary">
                            {card.example || "Пример не добавлен"}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {block.type === "quiz_single" ? (
                <div className="space-y-5">
                  {variantBehavior.timedQuiz && Number(meta.timerMinutes ?? 0) > 0 ? (
                    <div className="flex flex-col gap-3 rounded-[20px] bg-[color:color-mix(in_srgb,var(--ds-sage)_48%,var(--ds-surface))] px-4 py-4 text-ds-ink dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_18%,var(--ds-surface))] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[15px] font-semibold">
                          {timedQuizRuns[block.id]?.finished
                            ? "Время вышло"
                            : timedQuizRuns[block.id]
                              ? "Тест идёт"
                              : "Тест с таймером"}
                        </div>
                        <div className="mt-1 text-[14px] text-ds-text-secondary">
                          {timedQuizRuns[block.id]
                            ? "Ответьте на вопросы до окончания отсчёта."
                            : "Запустите таймер, когда будете готовы начать."}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="min-w-[72px] text-right text-[18px] font-semibold">
                          {formatDuration(timedQuizRuns[block.id]?.remainingSec ?? Number(meta.timerMinutes) * 60)}
                        </span>
                        {!timedQuizRuns[block.id] || timedQuizRuns[block.id]?.finished ? (
                          <button
                            type="button"
                            className="inline-flex h-11 items-center rounded-full bg-ds-ink px-5 text-[14px] font-semibold text-[var(--ds-surface)]"
                            onClick={() => startTimedQuiz(block.id, Number(meta.timerMinutes ?? 0))}
                          >
                            {timedQuizRuns[block.id]?.finished ? "Запустить ещё раз" : "Начать тест"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {(!variantBehavior.timedQuiz || Boolean(timedQuizRuns[block.id])) &&
                    normalizeSingleQuestions(data.quiz_single).map((question, questionIndex) => (
                    <article key={`${block.id}-single-${questionIndex}`} className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                      <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                        Вопрос {questionIndex + 1} · один ответ
                      </div>
                      <p className={cn(studentSoftFieldClass, "mt-3 text-[20px] leading-8")}>
                        {question.prompt || "Введите вопрос в редакторе"}
                      </p>
                      <div className="mt-4 space-y-3">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={`${block.id}-single-option-${questionIndex}-${optionIndex}`}
                            className={cn(
                              "flex items-center gap-3 rounded-[18px] px-4 py-3 transition-colors",
                              singleAnswers[`${block.id}-single-${questionIndex}`] === String(optionIndex)
                                ? studentSelectedOptionClass
                                : "bg-[var(--ds-surface)]"
                              )}
                            >
                            <input
                              type="radio"
                              name={`${block.id}-single-${questionIndex}`}
                              checked={singleAnswers[`${block.id}-single-${questionIndex}`] === String(optionIndex)}
                              onChange={() =>
                                setSingleAnswers((prev) => ({
                                  ...prev,
                                  [`${block.id}-single-${questionIndex}`]: String(optionIndex)
                                }))
                              }
                              className="h-5 w-5 accent-ds-ink"
                            />
                            <span className="text-[18px] text-ds-ink">{option || `Вариант ${optionIndex + 1}`}</span>
                          </label>
                        ))}
                      </div>
                    </article>
                    ))}
                </div>
              ) : null}

              {block.type === "quiz_multi" ? (
                <div className="space-y-5">
                  {normalizeMultiQuestions(data.quiz_multi).map((question, questionIndex) => {
                    const key = `${block.id}-multi-${questionIndex}`
                    const selected = multiAnswers[key] ?? []
                    return (
                      <article key={key} className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                        <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                          Вопрос {questionIndex + 1} · несколько ответов
                        </div>
                        <p className={cn(studentSoftFieldClass, "mt-3 text-[20px] leading-8")}>
                          {question.prompt || "Введите вопрос в редакторе"}
                        </p>
                        <div className="mt-4 space-y-3">
                          {question.options.map((option, optionIndex) => (
                            <label
                              key={`${key}-option-${optionIndex}`}
                              className={cn(
                              "flex items-center gap-3 rounded-[18px] px-4 py-3 transition-colors",
                              selected.includes(optionIndex)
                                ? studentSelectedOptionClass
                                : "bg-[var(--ds-surface)]"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selected.includes(optionIndex)}
                                onChange={() =>
                                  setMultiAnswers((prev) => {
                                    const current = prev[key] ?? []
                                    return {
                                      ...prev,
                                      [key]: current.includes(optionIndex)
                                        ? current.filter((value) => value !== optionIndex)
                                        : [...current, optionIndex]
                                    }
                                  })
                                }
                                className="h-5 w-5 accent-ds-ink"
                              />
                              <span className="text-[18px] text-ds-ink">{option || `Вариант ${optionIndex + 1}`}</span>
                            </label>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "video" ? (
                <div className="space-y-5">
                  {(Array.isArray(asRecord(data.video).items) ? (asRecord(data.video).items as unknown[]) : []).map((item, itemIndex) => {
                    const video = asRecord(item)
                    const videoUrl = asString(video.url).trim()
                    const videoTitle = asString(video.title).trim()
                    const caption = asString(video.caption).trim()
                    const thumbnailUrl = asString(video.thumbnailUrl).trim()
                    return (
                      <article key={`${block.id}-video-${itemIndex}`} className="space-y-4">
                        {thumbnailUrl && !videoUrl ? (
                          <div className="relative overflow-hidden rounded-[28px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={thumbnailUrl} alt={videoTitle || "Видео"} className="h-auto w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--ds-surface)]/90 shadow-lg">
                                <Play className="h-8 w-8 fill-current text-ds-ink" />
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {videoUrl ? <InlineLessonVideo url={videoUrl} className="!max-w-none rounded-[28px]" /> : null}
                        {videoTitle ? <h3 className="text-[22px] font-semibold text-ds-ink">{videoTitle}</h3> : null}
                        {caption ? <p className="text-[16px] leading-7 text-ds-text-secondary">{caption}</p> : null}
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "image" ? (
                (() => {
                  const allImageItems = Array.isArray(asRecord(data.image).items) ? (asRecord(data.image).items as unknown[]) : []
                  const isCarousel = variantBehavior.imageMode === "carousel"
                  const rawCurrentIndex = carouselIndexes[block.id] ?? 0
                  const safeCurrentIndex =
                    allImageItems.length > 0 ? ((rawCurrentIndex % allImageItems.length) + allImageItems.length) % allImageItems.length : 0
                  const renderItems = isCarousel ? (allImageItems[safeCurrentIndex] ? [allImageItems[safeCurrentIndex]] : []) : allImageItems

                  return (
                    <div className={cn("grid gap-4", variantBehavior.imageMode === "stack" ? "md:grid-cols-2" : "grid-cols-1")}>
                      {renderItems.map((item, itemIndex) => {
                        const image = asRecord(item)
                        return (
                          <article key={`${block.id}-image-${itemIndex}`} className="relative space-y-3">
                            {asString(image.url).trim() ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={asString(image.url).trim()}
                                alt={asString(image.title).trim() || "Изображение"}
                                className={cn(
                                  "mx-auto w-full max-w-[620px] rounded-[24px] object-cover",
                                  variantBehavior.imageMode === "gif" ? "aspect-video" : "aspect-[4/3]"
                                )}
                              />
                            ) : null}
                            {variantBehavior.imageMode === "gif" ? (
                              <div className="absolute left-7 top-7 rounded-[12px] bg-[var(--ds-surface)]/88 px-3 py-1 text-[13px] font-semibold text-ds-ink shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]">
                                GIF
                              </div>
                            ) : null}
                            {isCarousel && allImageItems.length > 1 ? (
                              <div className="absolute inset-y-0 left-6 flex items-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCarouselIndexes((prev) => ({
                                      ...prev,
                                      [block.id]: ((safeCurrentIndex - 1) % allImageItems.length + allImageItems.length) % allImageItems.length
                                    }))
                                  }
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-surface)]/88 text-ds-text-secondary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] transition-colors hover:bg-[var(--ds-surface)]"
                                  aria-label="Предыдущая картинка"
                                >
                                  ‹
                                </button>
                              </div>
                            ) : null}
                            {isCarousel && allImageItems.length > 1 ? (
                              <div className="absolute inset-y-0 right-6 flex items-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCarouselIndexes((prev) => ({
                                      ...prev,
                                      [block.id]: (safeCurrentIndex + 1) % allImageItems.length
                                    }))
                                  }
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-surface)]/88 text-ds-text-secondary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] transition-colors hover:bg-[var(--ds-surface)]"
                                  aria-label="Следующая картинка"
                                >
                                  ›
                                </button>
                              </div>
                            ) : null}
                            {asString(image.title).trim() ? <h3 className="mx-auto w-full max-w-[620px] text-[18px] font-semibold text-ds-ink">{asString(image.title)}</h3> : null}
                            {asString(image.caption).trim() ? (
                              <p className="mx-auto w-full max-w-[620px] text-[15px] leading-6 text-ds-text-secondary">{asString(image.caption)}</p>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  )
                })()
              ) : null}

              {block.type === "audio" ? (
                <div className="space-y-4">
                  {(Array.isArray(asRecord(data.audio).items) ? (asRecord(data.audio).items as unknown[]) : []).map((item, itemIndex, items) => {
                    const audio = asRecord(item)
                    const trackKey = `${block.id}-audio-${itemIndex}`
                    return (
                      <article key={`${block.id}-audio-${itemIndex}`} className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                        {asString(audio.title).trim() ? <h3 className="text-[20px] font-semibold text-ds-ink">{asString(audio.title)}</h3> : null}
                        {asString(audio.url).trim() ? (
                          <LessonAudioPlayerRow
                            src={asString(audio.url).trim()}
                            seekable
                            volumeControl
                            speedControl
                            transportIconMode="solid"
                            barCount={56}
                            containerClassName="mt-4 gap-3 rounded-[22px] border-0 bg-[var(--ds-surface)] px-3 py-3 shadow-none"
                            buttonClassName="h-10 w-10 border-0 bg-ds-ink text-white shadow-none hover:bg-[#2a2a2a] dark:bg-white dark:text-black dark:hover:bg-[#f2f2f2]"
                            playedBarClassName="bg-ds-ink dark:bg-white"
                            idleBarClassName="bg-black/18 dark:bg-white/22"
                            liveActiveBarClassName="bg-ds-ink dark:bg-white"
                            liveIdleBarClassName="bg-black/18 dark:bg-white/22"
                            timeClassName="text-ds-text-secondary"
                            onPlaybackComplete={() => {
                              setAudioTrackCompletion((prev) => {
                                if (prev[trackKey]) return prev
                                const next = { ...prev, [trackKey]: true }
                                const completedCount = items.reduce<number>((count, _, index) => {
                                  return count + (next[`${block.id}-audio-${index}`] ? 1 : 0)
                                }, 0)
                                if (completedCount >= items.length) {
                                  onBlockCompletionStateChange?.(block.id, true)
                                }
                                return next
                              })
                            }}
                          />
                        ) : (
                          <p className="mt-4 text-[15px] text-ds-text-secondary">Аудио пока не добавлено.</p>
                        )}
                        {asString(audio.transcript).trim() ? (
                          <p className="mt-4 text-[16px] leading-7 text-ds-text-secondary">{asString(audio.transcript)}</p>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "homework" ? (
                <article className="space-y-5 rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                  <div>
                    <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">Задание</div>
                    <p className={cn(studentSoftFieldClass, "mt-3 text-[18px] leading-8")}>
                      {asString(asRecord(data.homework).prompt).trim() || "Задание появится после настройки блока"}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">Ответ ученика</div>
                    {(asRecord(data.homework).responseMode === "text" || asRecord(data.homework).responseMode === "text_file") ? (
                      <textarea
                        className="min-h-[140px] w-full rounded-[18px] bg-[var(--ds-surface)] px-4 py-3 text-[16px] text-ds-ink outline-none"
                        placeholder="Введите ответ"
                      />
                    ) : null}
                    {(asRecord(data.homework).responseMode === "file" || asRecord(data.homework).responseMode === "text_file") ? (
                      <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[16px] bg-[var(--ds-surface)] px-4 text-[15px] font-medium text-ds-ink">
                        <Upload className="h-4 w-4" />
                        Прикрепить файл
                        <input type="file" className="sr-only" />
                      </label>
                    ) : null}
                  </div>
                </article>
              ) : null}

              {block.type === "pdf" ? (
                <div className="space-y-4">
                  {(Array.isArray(asRecord(data.pdf).items) ? (asRecord(data.pdf).items as unknown[]) : []).map((item, itemIndex) => {
                    const pdf = asRecord(item)
                    const url = asString(pdf.url).trim()
                    return (
                      <article key={`${block.id}-pdf-${itemIndex}`} className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-[20px] font-semibold text-ds-ink">{asString(pdf.title).trim() || "PDF материал"}</h3>
                            {asString(pdf.description).trim() ? (
                              <p className="mt-2 text-[15px] leading-6 text-ds-text-secondary">{asString(pdf.description)}</p>
                            ) : null}
                          </div>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-ds-ink px-5 text-[15px] font-semibold text-[var(--ds-surface)]"
                            >
                              <Download className="h-4 w-4" />
                              Открыть PDF
                            </a>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "speaking" ? (
                <div className="space-y-4">
                  {(Array.isArray(asRecord(data.speaking).items) ? (asRecord(data.speaking).items as unknown[]) : []).map((item, itemIndex) => {
                    const speaking = asRecord(item)
                    return (
                      <article key={`${block.id}-speaking-${itemIndex}`} className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                        <h3 className="text-[20px] font-semibold text-ds-ink">{asString(speaking.prompt).trim() || "Запишите голосовой ответ"}</h3>
                        {asString(speaking.helper).trim() ? (
                          <p className="mt-3 text-[15px] leading-6 text-ds-text-secondary">{asString(speaking.helper)}</p>
                        ) : null}
                        <label className="mt-5 inline-flex h-12 cursor-pointer items-center gap-2 rounded-[16px] bg-ds-ink px-5 text-[15px] font-semibold text-[var(--ds-surface)]">
                          <Mic className="h-4 w-4" />
                          Загрузить ответ
                          <input type="file" accept="audio/*" className="sr-only" />
                        </label>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "note" ? (
                <article className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                  <h3 className="text-[20px] font-semibold text-ds-ink">{asString(asRecord(data.note).title).trim() || "Заметка"}</h3>
                  <p className="mt-3 text-[16px] leading-7 text-ds-text-secondary">
                    {asString(asRecord(data.note).content).trim() || "Содержимое заметки не заполнено."}
                  </p>
                </article>
              ) : null}

              {block.type === "link" ? (
                <article className="rounded-[24px] bg-[var(--ds-surface-muted)] p-4">
                  <h3 className="text-[20px] font-semibold text-ds-ink">{asString(asRecord(data.link).label).trim() || "Материал"}</h3>
                  {asString(asRecord(data.link).hint).trim() ? (
                    <p className="mt-3 text-[16px] leading-7 text-ds-text-secondary">{asString(asRecord(data.link).hint)}</p>
                  ) : null}
                  {asString(asRecord(data.link).url).trim() ? (
                    <a
                      href={asString(asRecord(data.link).url).trim()}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex h-12 items-center gap-2 rounded-[16px] bg-ds-ink px-5 text-[15px] font-semibold text-[var(--ds-surface)]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Открыть ссылку
                    </a>
                  ) : null}
                </article>
              ) : null}

              {block.type === "divider" ? (
                <div className="flex items-center gap-4 py-3">
                  <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.08]" />
                    <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                      {asString(asRecord(data.divider).label).trim() || "Следующий этап"}
                    </span>
                  <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.08]" />
                </div>
              ) : null}
            </div>
          </section>
        )
      })}

      {normalizedBlocks.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-black/[0.08] bg-[var(--ds-surface)] px-6 py-12 text-center text-[16px] text-ds-text-secondary dark:border-white/[0.08]">
          В этом уроке пока нет блоков.
        </div>
      ) : null}
    </div>
  )
}
