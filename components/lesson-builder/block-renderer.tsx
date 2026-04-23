"use client"

import { useMemo, useState } from "react"
import { Download, ExternalLink, Mic, Play, Upload } from "lucide-react"
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
import { blockTypeStudentTheme } from "@/components/lesson-builder/block-theme"
import { InlineLessonVideo } from "@/components/lesson-builder/inline-lesson-video"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

function studentCardShell(type: TeacherLessonBlock["type"]) {
  return BLOCK_ICON_REGISTRY[type].cardClass
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
  "h-11 w-full rounded-[14px] border border-black/[0.06] bg-[var(--ds-surface)] px-3.5 text-[15px] text-ds-ink shadow-none outline-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0 dark:border-white/[0.08]"

const studentSelectContentClass =
  "rounded-[16px] border border-black/[0.08] bg-[var(--ds-surface)] p-1 text-ds-ink shadow-[0_18px_40px_-30px_rgba(0,0,0,0.2)] dark:border-white/[0.08]"

const studentMutedPanelClass = "rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]"
const studentSoftFieldClass = "rounded-[18px] border border-black/[0.06] bg-[var(--ds-surface)] px-5 py-4 text-ds-ink dark:border-white/[0.08]"
const studentSelectedOptionClass =
  "border-[color:var(--ds-sage-hover)] bg-[color:color-mix(in_srgb,var(--ds-sage)_72%,var(--ds-surface))] text-ds-ink dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_24%,var(--ds-surface))]"
const studentAnswerChipClass =
  "rounded-full border border-[color:var(--ds-sage-hover)] bg-[color:color-mix(in_srgb,var(--ds-sage)_70%,var(--ds-surface))] px-3 py-1.5 text-[14px] font-medium text-ds-ink dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_20%,var(--ds-surface))]"

export function BlockRenderer({ blocks }: { blocks: TeacherLessonBlock[]; taskBadgeColor?: string }) {
  const normalizedBlocks = useMemo(
    () => [...blocks].map(normalizeTeacherLessonBlock).sort((left, right) => left.order - right.order),
    [blocks]
  )
  const [singleAnswers, setSingleAnswers] = useState<Record<string, string>>({})
  const [multiAnswers, setMultiAnswers] = useState<Record<string, number[]>>({})
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({})
  const [fillAnswers, setFillAnswers] = useState<Record<string, string>>({})

  return (
    <div className="space-y-5">
      {normalizedBlocks.map((block, blockIndex) => {
        const visual = BLOCK_ICON_REGISTRY[block.type]
        const theme = blockTypeStudentTheme[block.type]
        const Icon = visual.icon
        const data = asRecord(block.data)
        const variantId = getBlockVariantId(data)
        const variantBehavior = getBlockVariantBehavior({ type: block.type, data, variantId })
        const meta = asRecord(data.meta)
        const title = asString(meta.title).trim() || `Блок ${blockIndex + 1}`
        const instruction = asString(meta.instruction).trim()

        return (
          <section
            key={block.id}
            className={cn(
              "overflow-hidden border bg-[var(--ds-surface)] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.18)] dark:border-white/[0.08]",
              theme.panel,
              studentCardShell(block.type)
            )}
          >
            <div className="flex items-center gap-4 px-5 py-5 sm:px-7">
              <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-full", visual.circleClass)}>
                <Icon className={cn("h-7 w-7", visual.iconClass)} strokeWidth={1.9} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                  Блок {blockIndex + 1}
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
                              className="flex items-center justify-between gap-4 rounded-[20px] border border-black/[0.06] bg-[var(--ds-surface)] px-4 py-3 dark:border-white/[0.08]"
                            >
                              <span className="text-[16px] leading-6 text-ds-ink">{question.prompt}</span>
                              <Select
                                value={singleAnswers[`${block.id}-text-${itemIndex}-${questionIndex}`] || undefined}
                                onValueChange={(value) =>
                                  setSingleAnswers((prev) => ({
                                    ...prev,
                                    [`${block.id}-text-${itemIndex}-${questionIndex}`]: value
                                  }))
                                }
                              >
                                <SelectTrigger className={cn(studentSelectTriggerClass, "min-w-[152px]")}>
                                  <SelectValue placeholder="Выберите" />
                                </SelectTrigger>
                                <SelectContent className={studentSelectContentClass}>
                                  <SelectItem value="true">Да</SelectItem>
                                  <SelectItem value="false">Нет</SelectItem>
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
                    const leftColumnTitle = asString(asRecord(data.matching).leftColumnTitle).trim() || "Колонка 1"
                    const rightColumnTitle = asString(asRecord(data.matching).rightColumnTitle).trim() || "Колонка 2"
                    return pairs.map((pair, pairIndex) => {
                      const answerKey = `${block.id}-match-${pairIndex}`
                      return (
                        <div
                          key={answerKey}
                          className="grid gap-3 rounded-[22px] border border-black/[0.06] bg-[var(--ds-surface-muted)] px-4 py-4 dark:border-white/[0.08] md:grid-cols-[minmax(0,1fr)_minmax(16rem,1fr)]"
                        >
                          <div className="space-y-2">
                            {variantBehavior.matchingMode === "columns" ? (
                              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ds-text-tertiary">
                                <span>{leftColumnTitle}</span>
                                <span className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.08]" />
                              </div>
                            ) : null}
                            <div className="rounded-[16px] border border-black/[0.06] bg-[var(--ds-surface)] px-4 py-3 text-[18px] text-ds-ink dark:border-white/[0.08]">
                              {pair.left || "—"}
                            </div>
                          </div>
                          <Select
                            value={matchAnswers[answerKey] || undefined}
                            onValueChange={(value) =>
                              setMatchAnswers((prev) => ({
                                ...prev,
                                [answerKey]: value
                              }))
                            }
                          >
                            <SelectTrigger className={cn(studentSelectTriggerClass, "h-12 rounded-[16px]")}>
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
                          {variantBehavior.matchingMode === "columns" ? (
                            <div className="md:col-span-2">
                              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ds-text-tertiary">
                                <span>{rightColumnTitle}</span>
                                <span className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.08]" />
                              </div>
                            </div>
                          ) : null}
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
                    return (
                      <div key={`${block.id}-fill-${itemIndex}`} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
                        {isImageVariant ? (
                          <div className="space-y-4">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt={item.text || `Карточка ${itemIndex + 1}`} className="aspect-square w-full rounded-[22px] object-cover sm:max-w-[220px]" />
                            ) : (
                              <div className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-[22px] bg-[var(--ds-surface)] text-ds-text-secondary">
                                Изображение
                              </div>
                            )}
                            {isChoiceVariant ? (
                              <Select
                                value={fillAnswers[`${block.id}-${itemIndex}-image`] || undefined}
                                onValueChange={(value) =>
                                  setFillAnswers((prev) => ({
                                    ...prev,
                                    [`${block.id}-${itemIndex}-image`]: value
                                  }))
                                }
                              >
                                <SelectTrigger className={studentSelectTriggerClass}>
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
                                className="inline-flex h-11 w-full max-w-[240px] rounded-[14px] border border-black/[0.08] bg-[var(--ds-surface)] px-3 text-[16px] text-ds-ink outline-none dark:border-white/[0.08]"
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
                                      ) : (
                                        <input
                                          value={fillAnswers[`${block.id}-${itemIndex}-${gapIndex}`] ?? ""}
                                          onChange={(event) =>
                                            setFillAnswers((prev) => ({
                                              ...prev,
                                              [`${block.id}-${itemIndex}-${gapIndex}`]: event.target.value
                                            }))
                                          }
                                          className="mx-2 inline-flex h-11 w-40 rounded-[14px] border border-black/[0.08] bg-[var(--ds-surface)] px-3 text-[16px] text-ds-ink outline-none dark:border-white/[0.08]"
                                        />
                                      )
                                    ) : null}
                                  </span>
                                )
                              })}
                            </div>
                            {!isChoiceVariant && answers.length > 0 ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {seededShuffle(answers, `${block.id}-${itemIndex}-bank`).map((answer, answerIndex) => (
                                  <span
                                    key={`${block.id}-answer-${itemIndex}-${answerIndex}`}
                                    className={studentAnswerChipClass}
                                  >
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
                      <div key={`${block.id}-sentence-${itemIndex}`} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
                        <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ds-text-tertiary">
                          {sentenceMode === "letters" ? `Слово ${itemIndex + 1}` : sentenceMode === "text_order" ? `Фрагмент ${itemIndex + 1}` : `Предложение ${itemIndex + 1}`}
                        </div>
                        <p className="mt-3 rounded-[16px] border border-black/[0.06] bg-[var(--ds-surface)] px-4 py-3 text-[20px] leading-8 text-ds-ink dark:border-white/[0.08]">
                          {item.source || "Введите предложение в редакторе"}
                        </p>
                        <p className="mt-4 text-[14px] text-ds-text-tertiary">Так его увидит ученик:</p>
                        {sentenceMode === "text_order" ? (
                          <div className="mt-3 space-y-2">
                            {seededShuffle(words, `${block.id}-${itemIndex}-chips`).map((word, wordIndex) => (
                              <div
                                key={`${block.id}-chip-${itemIndex}-${wordIndex}`}
                                className="rounded-[14px] border border-black/[0.08] bg-[var(--ds-surface)] px-4 py-2 text-[16px] text-ds-text-secondary dark:border-white/[0.08]"
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
                                className="rounded-[14px] border border-black/[0.08] bg-[var(--ds-surface)] px-4 py-2 text-[16px] text-ds-text-secondary dark:border-white/[0.08]"
                              >
                                {word}
                              </span>
                            ))}
                            {sentenceMode === "letters"
                              ? Array.from({ length: words.length }).map((_, slotIndex) => (
                                  <span key={`${block.id}-letter-slot-${itemIndex}-${slotIndex}`} className="h-10 w-10 rounded-[12px] border border-dashed border-black/[0.08] bg-[var(--ds-surface)] dark:border-white/[0.08]" />
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
                    <div className="flex items-center justify-between rounded-[20px] bg-[color:color-mix(in_srgb,var(--ds-sage)_48%,var(--ds-surface))] px-4 py-3 text-[14px] font-semibold text-ds-ink dark:bg-[color:color-mix(in_srgb,var(--ds-sage)_18%,var(--ds-surface))]">
                      <span>Тест начат</span>
                      <span>{String(meta.timerMinutes).padStart(2, "0")}:00</span>
                    </div>
                  ) : null}
                  {normalizeSingleQuestions(data.quiz_single).map((question, questionIndex) => (
                    <article key={`${block.id}-single-${questionIndex}`} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
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
                              "flex items-center gap-3 rounded-[18px] border px-4 py-3 transition-colors",
                              singleAnswers[`${block.id}-single-${questionIndex}`] === String(optionIndex)
                                ? studentSelectedOptionClass
                                : "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]"
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
                      <article key={key} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
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
                                "flex items-center gap-3 rounded-[18px] border px-4 py-3 transition-colors",
                                selected.includes(optionIndex)
                                  ? studentSelectedOptionClass
                                  : "border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]"
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
                          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] dark:border-white/[0.08]">
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
                <div className={cn("grid gap-4", variantBehavior.imageMode === "stack" ? "md:grid-cols-2" : "grid-cols-1")}>
                  {(variantBehavior.imageMode === "carousel"
                    ? (Array.isArray(asRecord(data.image).items) ? (asRecord(data.image).items as unknown[]) : []).slice(0, 1)
                    : Array.isArray(asRecord(data.image).items)
                      ? (asRecord(data.image).items as unknown[])
                      : []
                  ).map((item, itemIndex) => {
                    const image = asRecord(item)
                    return (
                      <article key={`${block.id}-image-${itemIndex}`} className="relative space-y-3 rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
                        {asString(image.url).trim() ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asString(image.url).trim()}
                            alt={asString(image.title).trim() || "Изображение"}
                            className={cn(
                              "w-full rounded-[20px] object-cover",
                              variantBehavior.imageMode === "gif" ? "aspect-video" : "aspect-[4/3]"
                            )}
                          />
                        ) : null}
                        {variantBehavior.imageMode === "gif" ? (
                          <div className="absolute left-7 top-7 rounded-[12px] bg-[var(--ds-surface)]/88 px-3 py-1 text-[13px] font-semibold text-ds-ink shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]">
                            GIF
                          </div>
                        ) : null}
                        {variantBehavior.imageMode === "carousel" ? (
                          <div className="absolute inset-y-0 left-6 flex items-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-surface)]/88 text-ds-text-secondary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]">‹</span>
                          </div>
                        ) : null}
                        {variantBehavior.imageMode === "carousel" ? (
                          <div className="absolute inset-y-0 right-6 flex items-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-surface)]/88 text-ds-text-secondary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]">›</span>
                          </div>
                        ) : null}
                        {asString(image.title).trim() ? <h3 className="text-[18px] font-semibold text-ds-ink">{asString(image.title)}</h3> : null}
                        {asString(image.caption).trim() ? <p className="text-[15px] leading-6 text-ds-text-secondary">{asString(image.caption)}</p> : null}
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {block.type === "audio" ? (
                <div className="space-y-4">
                  {(Array.isArray(asRecord(data.audio).items) ? (asRecord(data.audio).items as unknown[]) : []).map((item, itemIndex) => {
                    const audio = asRecord(item)
                    return (
                      <article key={`${block.id}-audio-${itemIndex}`} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
                        {asString(audio.title).trim() ? <h3 className="text-[20px] font-semibold text-ds-ink">{asString(audio.title)}</h3> : null}
                        {asString(audio.url).trim() ? (
                          <audio src={asString(audio.url).trim()} controls className="mt-4 w-full" preload="metadata" />
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
                <article className="space-y-5 rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
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
                        className="min-h-[140px] w-full rounded-[18px] border border-black/[0.08] bg-[var(--ds-surface)] px-4 py-3 text-[16px] text-ds-ink outline-none dark:border-white/[0.08]"
                        placeholder="Введите ответ"
                      />
                    ) : null}
                    {(asRecord(data.homework).responseMode === "file" || asRecord(data.homework).responseMode === "text_file") ? (
                      <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[16px] border border-black/[0.08] bg-[var(--ds-surface)] px-4 text-[15px] font-medium text-ds-ink dark:border-white/[0.08]">
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
                      <article key={`${block.id}-pdf-${itemIndex}`} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
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
                      <article key={`${block.id}-speaking-${itemIndex}`} className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
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
                <article className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
                  <h3 className="text-[20px] font-semibold text-ds-ink">{asString(asRecord(data.note).title).trim() || "Заметка"}</h3>
                  <p className="mt-3 text-[16px] leading-7 text-ds-text-secondary">
                    {asString(asRecord(data.note).content).trim() || "Содержимое заметки не заполнено."}
                  </p>
                </article>
              ) : null}

              {block.type === "link" ? (
                <article className="rounded-[24px] border border-black/[0.06] bg-[var(--ds-surface-muted)] p-4 dark:border-white/[0.08]">
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
