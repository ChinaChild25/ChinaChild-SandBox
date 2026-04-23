"use client"

import { useRef, useState } from "react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Trash2, Upload } from "lucide-react"
import type { TeacherLessonBlock } from "@/lib/types"
import {
  asRecord,
  asString,
  asStringArray,
  extractBracketAnswers,
  normalizeTeacherLessonBlock,
  type FlashcardItem,
  type HomeworkResponseMode,
  type MatchingPair,
  type QuizMultiQuestion,
  type QuizSingleQuestion
} from "@/lib/lesson-builder-blocks"
import { getBlockVariantBehavior, getBlockVariantId } from "@/components/lesson-builder/block-registry"
import { InlineLessonVideo } from "@/components/lesson-builder/inline-lesson-video"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export { createDefaultBlockData } from "@/lib/lesson-builder-blocks"

const sectionShellClass = "rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] p-4 transition-colors hover:bg-[var(--ds-neutral-row-hover)]"
const fieldClass =
  "min-h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface)] px-3.5 py-2.5 text-ds-body text-ds-ink shadow-none outline-none transition-colors hover:bg-[var(--ds-surface)] focus-visible:border-transparent focus-visible:ring-0"
const smallLabelClass = "text-[13px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary"
const actionIconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-ds-text-tertiary transition-colors hover:bg-[var(--ds-surface)] hover:text-ds-ink"

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className={smallLabelClass}>{children}</div>
}

function SectionTitle({
  title,
  onRemove,
  extra
}: {
  title: string
  onRemove?: () => void
  extra?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <FieldLabel>{title}</FieldLabel>
      <div className="flex items-center gap-2">
        {extra}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className={actionIconButtonClass}
            aria-label={`Удалить: ${title}`}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AddGhostButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border border-dashed border-black/[0.1] bg-[var(--ds-surface)] text-ds-body font-medium text-ds-text-secondary transition-colors hover:border-black/[0.14] hover:bg-[var(--ds-surface)] dark:border-white/[0.12] dark:hover:border-white/[0.16]"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  )
}

function ChoiceToggle({
  active,
  label,
  onClick
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-[var(--ds-radius-md)] px-3.5 text-ds-body font-medium transition-colors",
        active ? "bg-ds-ink text-[var(--ds-surface)]" : "bg-[var(--ds-surface)] text-ds-text-secondary hover:bg-[var(--ds-neutral-row)]"
      )}
    >
      {label}
    </button>
  )
}

function LocalUploadButton({
  lessonId,
  label,
  accept,
  onSelect
}: {
  lessonId: string
  label: string
  accept?: string
  onSelect: (payload: { url: string; fileName: string }) => void | Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-[var(--ds-surface)] px-4 text-ds-body font-medium text-ds-ink transition-colors hover:bg-[var(--ds-neutral-row)] disabled:pointer-events-none disabled:opacity-60 dark:border-white/[0.08]"
      >
        <Upload className="h-4 w-4" />
        {isUploading ? "Загрузка..." : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          setIsUploading(true)
          setUploadError(null)
          try {
            const formData = new FormData()
            formData.set("file", file)
            const response = await fetch(`/api/teacher/lessons/${lessonId}/media`, {
              method: "POST",
              body: formData
            })
            const payload = (await response.json().catch(() => null)) as { url?: string; fileName?: string; error?: string } | null
            if (!response.ok || !payload?.url) {
              throw new Error(payload?.error ?? "Не удалось загрузить файл")
            }
            await onSelect({
              url: payload.url,
              fileName: payload.fileName || file.name
            })
          } catch (error) {
            setUploadError(error instanceof Error ? error.message : "Не удалось загрузить файл")
          } finally {
            setIsUploading(false)
          }
          event.currentTarget.value = ""
        }}
      />
      {uploadError ? <p className="text-[12px] leading-5 text-[#c0394b]">{uploadError}</p> : null}
    </div>
  )
}

function PairSortableRow({
  id,
  pair,
  onChange,
  onRemove
}: {
  id: string
  pair: MatchingPair
  onChange: (patch: Partial<MatchingPair>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid items-center gap-3 rounded-[var(--ds-radius-md)] bg-[var(--ds-surface)] px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
    >
      <button
        type="button"
        aria-label="Переместить пару"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-ds-text-tertiary transition-colors hover:bg-[var(--ds-neutral-row)] hover:text-ds-ink"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-[18px] w-[18px]" />
      </button>
      <Input
        value={pair.left}
        onChange={(event) => onChange({ left: event.target.value })}
        placeholder="Левая колонка"
        className={fieldClass}
      />
      <span className="hidden text-center text-[18px] text-[var(--ds-sage-hover)] md:inline">↔</span>
      <Input
        value={pair.right}
        onChange={(event) => onChange({ right: event.target.value })}
        placeholder="Правая колонка"
        className={fieldClass}
      />
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-ds-text-tertiary transition-colors hover:bg-[var(--ds-neutral-row)] hover:text-ds-ink"
        aria-label="Удалить пару"
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </button>
    </div>
  )
}

function getQuizOptionLabel(index: number) {
  return `Вариант ${index + 1}`
}

function homeworkModeLabel(mode: HomeworkResponseMode) {
  if (mode === "text") return "Текст"
  if (mode === "file") return "Файл"
  return "Текст + Файл"
}

export function BlockEditors({
  block,
  onChange
}: {
  block: TeacherLessonBlock
  onChange: (data: Record<string, unknown>) => void
}) {
  const normalizedBlock = normalizeTeacherLessonBlock(block)
  const data = asRecord(normalizedBlock.data)
  const variantId = getBlockVariantId(data)
  const variantBehavior = getBlockVariantBehavior({ type: normalizedBlock.type, data, variantId })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (normalizedBlock.type === "text") {
    const textData = asRecord(data.text)
    const items = Array.isArray(textData.items) ? (textData.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const textItem = asRecord(item)
          const questions = Array.isArray(textItem.questions) ? (textItem.questions as Record<string, unknown>[]) : []
          return (
            <section key={`${block.id}-text-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Текст ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, text: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              <Textarea
                value={asString(textItem.content)}
                onChange={(event) =>
                  onChange({
                    ...data,
                    text: {
                      items: items.map((current, itemIndex) =>
                        itemIndex === index ? { ...asRecord(current), content: event.target.value } : current
                      )
                    }
                  })
                }
                placeholder="Введите текст для ученика"
                className={cn(fieldClass, "min-h-[160px] resize-y")}
              />

              <div className="mt-5 space-y-3">
                <FieldLabel>Проверка понимания</FieldLabel>
                {questions.map((question, questionIndex) => (
                  <div
                    key={`${block.id}-text-question-${index}-${questionIndex}`}
                    className="grid gap-3 rounded-[18px] bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <Input
                      value={asString(asRecord(question).prompt)}
                      onChange={(event) => {
                        const nextQuestions = questions.map((entry, entryIndex) =>
                          entryIndex === questionIndex ? { ...asRecord(entry), prompt: event.target.value } : entry
                        )
                        onChange({
                          ...data,
                          text: {
                            items: items.map((current, itemIndex) =>
                              itemIndex === index ? { ...asRecord(current), questions: nextQuestions } : current
                            )
                          }
                        })
                      }}
                      placeholder={`Вопрос ${questionIndex + 1}`}
                      className={fieldClass}
                    />
                    <div className="flex gap-2">
                      <ChoiceToggle
                        active={Boolean(asRecord(question).answer)}
                        label="Правда"
                        onClick={() => {
                          const nextQuestions = questions.map((entry, entryIndex) =>
                            entryIndex === questionIndex ? { ...asRecord(entry), answer: true } : entry
                          )
                          onChange({
                            ...data,
                            text: {
                              items: items.map((current, itemIndex) =>
                                itemIndex === index ? { ...asRecord(current), questions: nextQuestions } : current
                              )
                            }
                          })
                        }}
                      />
                      <ChoiceToggle
                        active={!Boolean(asRecord(question).answer)}
                        label="Ложь"
                        onClick={() => {
                          const nextQuestions = questions.map((entry, entryIndex) =>
                            entryIndex === questionIndex ? { ...asRecord(entry), answer: false } : entry
                          )
                          onChange({
                            ...data,
                            text: {
                              items: items.map((current, itemIndex) =>
                                itemIndex === index ? { ...asRecord(current), questions: nextQuestions } : current
                              )
                            }
                          })
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextQuestions = questions.filter((_, entryIndex) => entryIndex !== questionIndex)
                        onChange({
                          ...data,
                          text: {
                            items: items.map((current, itemIndex) =>
                              itemIndex === index ? { ...asRecord(current), questions: nextQuestions } : current
                            )
                          }
                        })
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-[#9aa0ad] transition-colors hover:bg-black/[0.04] hover:text-[#1f1f1f]"
                      aria-label="Удалить вопрос"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                ))}
                <AddGhostButton
                  label="Добавить вопрос"
                  onClick={() =>
                    onChange({
                      ...data,
                      text: {
                        items: items.map((current, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...asRecord(current),
                                questions: [...questions, { prompt: "", answer: true }]
                              }
                            : current
                        )
                      }
                    })
                  }
                />
              </div>
            </section>
          )
        })}

        <AddGhostButton
          label="Добавить текст"
          onClick={() =>
            onChange({
              ...data,
              text: {
                items: [...items, { content: "", questions: [] }]
              }
            })
          }
        />
      </div>
    )
  }

  if (normalizedBlock.type === "matching") {
    const matchingData = asRecord(data.matching)
    const pairs = Array.isArray(matchingData.pairs) ? (matchingData.pairs as Record<string, unknown>[]) : []
    const leftColumnTitle = asString(matchingData.leftColumnTitle).trim() || "Колонка 1"
    const rightColumnTitle = asString(matchingData.rightColumnTitle).trim() || "Колонка 2"
    const ids = pairs.map((_, index) => `${block.id}-pair-${index}`)

    return (
      <section className={sectionShellClass}>
        <SectionTitle title={variantBehavior.matchingMode === "columns" ? "Колонки и слова" : "Пары слов"} />
        {variantBehavior.matchingMode === "columns" ? (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel>Название колонки 1</FieldLabel>
              <Input
                value={leftColumnTitle}
                onChange={(event) =>
                  onChange({
                    ...data,
                    matching: {
                      ...matchingData,
                      leftColumnTitle: event.target.value
                    }
                  })
                }
                className={cn(fieldClass, "mt-2")}
              />
            </div>
            <div>
              <FieldLabel>Название колонки 2</FieldLabel>
              <Input
                value={rightColumnTitle}
                onChange={(event) =>
                  onChange({
                    ...data,
                    matching: {
                      ...matchingData,
                      rightColumnTitle: event.target.value
                    }
                  })
                }
                className={cn(fieldClass, "mt-2")}
              />
            </div>
          </div>
        ) : null}
        <div className="mb-3 grid gap-3 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#8d93a1] md:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <span />
          <span>{variantBehavior.matchingMode === "columns" ? "Слово" : "Левая колонка"}</span>
          <span />
          <span>{variantBehavior.matchingMode === "columns" ? "Категория" : "Правая колонка"}</span>
          <span />
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            const from = ids.indexOf(String(active.id))
            const to = ids.indexOf(String(over.id))
            if (from < 0 || to < 0) return
            onChange({
              ...data,
              matching: {
                pairs: arrayMove(pairs, from, to)
              }
            })
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {pairs.map((pair, index) => (
                <PairSortableRow
                  key={ids[index]}
                  id={ids[index]!}
                  pair={{
                    left: asString(asRecord(pair).left),
                    right: asString(asRecord(pair).right)
                  }}
                  onChange={(patch) =>
                    onChange({
                      ...data,
                      matching: {
                        pairs: pairs.map((current, pairIndex) =>
                          pairIndex === index ? { ...asRecord(current), ...patch } : current
                        )
                      }
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...data,
                      matching: {
                        pairs: pairs.filter((_, pairIndex) => pairIndex !== index)
                      }
                    })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="mt-4">
          <AddGhostButton
            label={variantBehavior.matchingMode === "columns" ? "Добавить слово" : "Добавить пару"}
            onClick={() =>
              onChange({
                ...data,
                matching: {
                  pairs: [...pairs, { left: "", right: "" }]
                }
              })
            }
          />
        </div>
      </section>
    )
  }

  if (normalizedBlock.type === "fill_gaps") {
    const fillData = asRecord(data.fill_gaps)
    const items = Array.isArray(fillData.items) ? (fillData.items as Record<string, unknown>[]) : []
    const fillMode = variantBehavior.fillMode ?? "type_word"
    const isImageVariant = fillMode.startsWith("image_")
    const isChoiceVariant = fillMode === "choose_form" || fillMode === "image_form"
    const helperText = isImageVariant
      ? isChoiceVariant
        ? "Добавьте изображение и варианты ответа. Первый вариант будет считаться правильным, если список пуст."
        : "Добавьте изображение и правильное слово, которое ученик должен вставить."
      : isChoiceVariant
        ? "Используйте [слово], чтобы обозначить пропуск. Ученик будет выбирать ответ из списка вариантов."
        : fillMode === "drag_word"
          ? "Используйте [слово], чтобы обозначить пропуск. Правильные ответы появятся в банке слов для перетаскивания."
          : "Используйте [слово], чтобы обозначить пропуск. Ученик будет вводить ответ вручную."
    const sentencePlaceholder = isChoiceVariant
      ? "Например: Сегодня я [учу] китайский язык."
      : fillMode === "drag_word"
        ? "Например: My name is [Anna] and I am from [Russia]."
        : "Например: Hello! I am [student] at a modern [school]."
    return (
      <div className="space-y-4">
        <div className="rounded-[20px] bg-[#eef4ff] px-4 py-3 text-[15px] leading-6 text-[#5f6f90]">
          {helperText}
        </div>
        {items.map((item, index) => {
          const fillItem = asRecord(item)
          const text = asString(fillItem.text)
          const answers = extractBracketAnswers(text).length > 0 ? extractBracketAnswers(text) : asStringArray(fillItem.answers)
          const imageUrl = asString(fillItem.imageUrl)
          const manualAnswers = answers.join(", ")
          return (
            <section key={`${block.id}-fill-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={isImageVariant ? `Карточка ${index + 1}` : `Предложение ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, fill_gaps: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              {isImageVariant ? (
                <>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={text || `Карточка ${index + 1}`} className="aspect-square w-full rounded-[24px] object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-[24px] bg-[#eceef3] text-[#7b8091]">
                      Превью изображения
                    </div>
                  )}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <LocalUploadButton
                      lessonId={block.lesson_id}
                      label="Загрузить изображение"
                      accept="image/*"
                      onSelect={({ url }) =>
                        onChange({
                          ...data,
                          fill_gaps: {
                            items: items.map((current, itemIndex) =>
                              itemIndex === index ? { ...asRecord(current), imageUrl: url } : current
                            )
                          }
                        })
                      }
                    />
                    <Input
                      value={imageUrl}
                      onChange={(event) =>
                        onChange({
                          ...data,
                          fill_gaps: {
                            items: items.map((current, itemIndex) =>
                              itemIndex === index ? { ...asRecord(current), imageUrl: event.target.value } : current
                            )
                          }
                        })
                      }
                      placeholder="URL изображения"
                      className={fieldClass}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>Правильный ответ</FieldLabel>
                      <Input
                        value={text}
                        onChange={(event) =>
                          onChange({
                            ...data,
                            fill_gaps: {
                              items: items.map((current, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...asRecord(current),
                                      text: event.target.value,
                                      answers: isChoiceVariant ? asStringArray(asRecord(current).answers) : [event.target.value].filter(Boolean)
                                    }
                                  : current
                              )
                            }
                          })
                        }
                        placeholder="Например: 猫"
                        className={cn(fieldClass, "mt-2")}
                      />
                    </div>
                    {isChoiceVariant ? (
                      <div>
                        <FieldLabel>Варианты через запятую</FieldLabel>
                        <Input
                          value={manualAnswers}
                          onChange={(event) =>
                            onChange({
                              ...data,
                              fill_gaps: {
                                items: items.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...asRecord(current),
                                        answers: event.target.value
                                          .split(",")
                                          .map((entry) => entry.trim())
                                          .filter(Boolean)
                                      }
                                    : current
                                )
                              }
                            })
                          }
                          placeholder="猫, 狗, 鸟"
                          className={cn(fieldClass, "mt-2")}
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <Textarea
                    value={text}
                    onChange={(event) =>
                      onChange({
                        ...data,
                        fill_gaps: {
                          items: items.map((current, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...asRecord(current),
                                  text: event.target.value,
                                  answers: extractBracketAnswers(event.target.value)
                                }
                              : current
                          )
                        }
                      })
                    }
                    placeholder={sentencePlaceholder}
                    className={cn(fieldClass, "min-h-[120px] resize-y")}
                  />
                  <div className="mt-4">
                    <FieldLabel>{isChoiceVariant ? "Варианты выбора" : "Правильные ответы"}</FieldLabel>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {answers.map((answer, answerIndex) => (
                        <span
                          key={`${block.id}-fill-answer-${index}-${answerIndex}`}
                          className="rounded-full bg-[color:color-mix(in_srgb,var(--ds-sage)_72%,#ffffff)] px-3 py-1.5 text-[14px] font-medium text-[color:color-mix(in_srgb,var(--ds-sage-hover)_72%,#1f1f1f)]"
                        >
                          {answer}
                        </span>
                      ))}
                      {answers.length === 0 ? <span className="text-[14px] text-[#7b8091]">Ответы появятся автоматически</span> : null}
                    </div>
                  </div>
                </>
              )}
            </section>
          )
        })}
        <AddGhostButton
          label={isImageVariant ? "Добавить карточку" : "Добавить предложение"}
          onClick={() =>
            onChange({
              ...data,
              fill_gaps: {
                items: [...items, { text: "", answers: [], imageUrl: "" }]
              }
            })
          }
        />
      </div>
    )
  }

  if (normalizedBlock.type === "sentence_builder") {
    const sentenceData = asRecord(data.sentence_builder)
    const items = Array.isArray(sentenceData.sentences) ? (sentenceData.sentences as Record<string, unknown>[]) : []
    const sentenceMode = variantBehavior.sentenceMode ?? "sentence"
    const introText =
      sentenceMode === "letters"
        ? "Введите слово. Буквы автоматически перемешаются для ученика."
        : sentenceMode === "text_order"
          ? "Добавьте фрагменты текста в правильном порядке. В превью ученик увидит их перемешанными."
          : "Введите правильное предложение. Слова автоматически перемешаются для ученика."
    return (
      <div className="space-y-4">
        <div className="rounded-[20px] bg-[#eef4ff] px-4 py-3 text-[15px] leading-6 text-[#5f6f90]">
          {introText}
        </div>
        {items.map((item, index) => {
          const sentence = asString(asRecord(item).source)
          const previewTokens =
            sentenceMode === "letters"
              ? seededShuffle(Array.from(sentence.replace(/\s+/g, "")), `${block.id}-${index}-letters-preview`)
              : seededShuffle(sentence.split(/\s+/).filter(Boolean), `${block.id}-${index}-sentence-preview`)
          return (
            <section key={`${block.id}-sentence-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={
                  sentenceMode === "letters"
                    ? `Слово ${index + 1}`
                    : sentenceMode === "text_order"
                      ? `Фрагмент ${index + 1}`
                      : `Предложение ${index + 1}`
                }
                onRemove={items.length > 1 ? () => onChange({ ...data, sentence_builder: { sentences: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              <Input
                value={sentence}
                onChange={(event) =>
                  onChange({
                    ...data,
                    sentence_builder: {
                      sentences: items.map((current, itemIndex) =>
                        itemIndex === index ? { ...asRecord(current), source: event.target.value } : current
                      )
                    }
                  })
                }
                placeholder={
                  sentenceMode === "letters"
                    ? "Например: 好"
                    : sentenceMode === "text_order"
                      ? "Введите строку или фрагмент текста"
                      : "I am learning Chinese every day"
                }
                className={fieldClass}
              />
              <div className="mt-4">
                <FieldLabel>Предпросмотр для ученика</FieldLabel>
                {sentenceMode === "text_order" ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-[14px] border border-dashed border-black/[0.08] px-3 py-2 text-[13px] text-[#7b8091]">
                      Ученик расставляет фрагменты сверху вниз в правильном порядке
                    </div>
                    <div className="space-y-2">
                      {previewTokens.map((token, tokenIndex) => (
                        <div key={`${block.id}-row-${index}-${tokenIndex}`} className="rounded-[14px] bg-white px-4 py-2 text-[15px] text-[#485066]">
                          {token}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {previewTokens.map((word, wordIndex) => (
                      <span
                        key={`${block.id}-sentence-word-${index}-${wordIndex}`}
                        className="rounded-[14px] bg-white px-4 py-2 text-[16px] text-[#485066]"
                      >
                        {word}
                      </span>
                    ))}
                    {sentenceMode === "letters" && previewTokens.length > 0
                      ? Array.from({ length: previewTokens.length }).map((_, slotIndex) => (
                          <span key={`${block.id}-slot-${index}-${slotIndex}`} className="h-[42px] w-[42px] rounded-[14px] border border-dashed border-black/[0.08] bg-white" />
                        ))
                      : null}
                    {!sentence.trim() ? <span className="text-[14px] text-[#7b8091]">Слова появятся здесь</span> : null}
                  </div>
                )}
              </div>
            </section>
          )
        })}
        <AddGhostButton
          label={sentenceMode === "text_order" ? "Добавить строку" : sentenceMode === "letters" ? "Добавить слово" : "Добавить предложение"}
          onClick={() =>
            onChange({
              ...data,
              sentence_builder: {
                sentences: [...items, { source: "" }]
              }
            })
          }
        />
      </div>
    )
  }

  if (normalizedBlock.type === "flashcards") {
    const flashcardsData = asRecord(data.flashcards)
    const cards = Array.isArray(flashcardsData.cards) ? (flashcardsData.cards as Record<string, unknown>[]) : []
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card, index) => {
          const current = asRecord(card)
          return (
            <section key={`${block.id}-flashcard-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Карточка ${index + 1}`}
                onRemove={cards.length > 1 ? () => onChange({ ...data, flashcards: { cards: cards.filter((_, cardIndex) => cardIndex !== index) } }) : undefined}
              />
              <div className="space-y-3">
                <div>
                  <FieldLabel>Лицевая</FieldLabel>
                  <Input
                    value={asString(current.front)}
                    onChange={(event) =>
                      onChange({
                        ...data,
                        flashcards: {
                          cards: cards.map((entry, cardIndex) =>
                            cardIndex === index ? { ...asRecord(entry), front: event.target.value } : entry
                          )
                        }
                      })
                    }
                    placeholder="你好"
                    className={cn(fieldClass, "mt-2")}
                  />
                </div>
                <div>
                  <FieldLabel>Обратная</FieldLabel>
                  <Input
                    value={asString(current.back)}
                    onChange={(event) =>
                      onChange({
                        ...data,
                        flashcards: {
                          cards: cards.map((entry, cardIndex) =>
                            cardIndex === index ? { ...asRecord(entry), back: event.target.value } : entry
                          )
                        }
                      })
                    }
                    placeholder="Здравствуйте"
                    className={cn(fieldClass, "mt-2")}
                  />
                </div>
                <div>
                  <FieldLabel>Пример</FieldLabel>
                  <Input
                    value={asString(current.example)}
                    onChange={(event) =>
                      onChange({
                        ...data,
                        flashcards: {
                          cards: cards.map((entry, cardIndex) =>
                            cardIndex === index ? { ...asRecord(entry), example: event.target.value } : entry
                          )
                        }
                      })
                    }
                    placeholder="你好，我叫安娜"
                    className={cn(fieldClass, "mt-2")}
                  />
                </div>
              </div>
            </section>
          )
        })}
        <div className="md:col-span-2">
          <AddGhostButton
            label="Добавить карточку"
            onClick={() =>
              onChange({
                ...data,
                flashcards: {
                  cards: [...cards, { front: "", back: "", example: "" } satisfies FlashcardItem]
                }
              })
            }
          />
        </div>
      </div>
    )
  }

  if (normalizedBlock.type === "quiz_single" || normalizedBlock.type === "quiz_multi") {
    const quizKey = normalizedBlock.type
    const quizData = asRecord(data[quizKey])
    const questions = Array.isArray(quizData.questions) ? (quizData.questions as Record<string, unknown>[]) : []
    const lockedOptions = variantBehavior.lockQuizOptions ?? null
    return (
      <div className="space-y-4">
        {questions.map((question, index) => {
          const current = asRecord(question)
          const options = lockedOptions ?? (Array.isArray(current.options) ? (current.options as string[]) : [])
          const correctSingle = Number(current.correctIndex ?? 0)
          const correctMulti = Array.isArray(current.correctIndexes) ? (current.correctIndexes as number[]) : []
          return (
            <section key={`${block.id}-${quizKey}-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Вопрос ${index + 1} · ${normalizedBlock.type === "quiz_single" ? "один ответ" : "несколько ответов"}`}
                onRemove={questions.length > 1 ? () => onChange({ ...data, [quizKey]: { questions: questions.filter((_, questionIndex) => questionIndex !== index) } }) : undefined}
              />
              <Input
                value={asString(current.prompt)}
                onChange={(event) =>
                  onChange({
                    ...data,
                    [quizKey]: {
                      questions: questions.map((entry, questionIndex) =>
                        questionIndex === index
                          ? {
                              ...asRecord(entry),
                              prompt: event.target.value,
                              ...(lockedOptions ? { options: lockedOptions } : {})
                            }
                          : entry
                      )
                    }
                  })
                }
                placeholder={lockedOptions ? "Введите утверждение" : "Введите вопрос"}
                className={fieldClass}
              />
              <div className="mt-4 space-y-3">
                {options.map((option, optionIndex) => (
                  <div
                    key={`${block.id}-${quizKey}-option-${index}-${optionIndex}`}
                    className={cn(
                      "grid gap-3 rounded-[18px] px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto]",
                      normalizedBlock.type === "quiz_single"
                        ? correctSingle === optionIndex
                          ? "bg-[color:color-mix(in_srgb,var(--ds-sage)_70%,#ffffff)]"
                          : "bg-white"
                        : correctMulti.includes(optionIndex)
                          ? "bg-[color:color-mix(in_srgb,var(--ds-sage)_70%,#ffffff)]"
                          : "bg-white"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (normalizedBlock.type === "quiz_single") {
                          onChange({
                            ...data,
                            [quizKey]: {
                              questions: questions.map((entry, questionIndex) =>
                                questionIndex === index ? { ...asRecord(entry), correctIndex: optionIndex } : entry
                              )
                            }
                          })
                          return
                        }

                        const nextIndexes = correctMulti.includes(optionIndex)
                          ? correctMulti.filter((value) => value !== optionIndex)
                          : [...correctMulti, optionIndex].sort((left, right) => left - right)
                        onChange({
                          ...data,
                          [quizKey]: {
                            questions: questions.map((entry, questionIndex) =>
                              questionIndex === index ? { ...asRecord(entry), correctIndexes: nextIndexes } : entry
                            )
                          }
                        })
                      }}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                        normalizedBlock.type === "quiz_single"
                          ? correctSingle === optionIndex
                            ? "bg-[var(--ds-sage)] text-[#1f1f1f]"
                            : "bg-[var(--ds-surface-muted)] text-[#7b8091]"
                          : correctMulti.includes(optionIndex)
                            ? "bg-[#1f1f1f] text-white"
                            : "bg-[var(--ds-surface-muted)] text-[#7b8091]"
                      )}
                    >
                      {normalizedBlock.type === "quiz_single" ? "●" : "✓"}
                    </button>
                    {lockedOptions ? (
                      <div className={cn(fieldClass, "flex items-center")}>{option}</div>
                    ) : (
                      <>
                        <Input
                          value={option}
                          onChange={(event) =>
                            onChange({
                              ...data,
                              [quizKey]: {
                                questions: questions.map((entry, questionIndex) =>
                                  questionIndex === index
                                    ? {
                                        ...asRecord(entry),
                                        options: options.map((entryOption, entryOptionIndex) =>
                                          entryOptionIndex === optionIndex ? event.target.value : entryOption
                                        )
                                      }
                                    : entry
                                )
                              }
                            })
                          }
                          placeholder={getQuizOptionLabel(optionIndex)}
                          className={fieldClass}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (options.length <= 2) return
                            const nextOptions = options.filter((_, entryOptionIndex) => entryOptionIndex !== optionIndex)
                            onChange({
                              ...data,
                              [quizKey]: {
                                questions: questions.map((entry, questionIndex) => {
                                  if (questionIndex !== index) return entry
                                  if (normalizedBlock.type === "quiz_single") {
                                    const nextCorrect = correctSingle >= nextOptions.length ? nextOptions.length - 1 : correctSingle
                                    return { ...asRecord(entry), options: nextOptions, correctIndex: Math.max(nextCorrect, 0) }
                                  }
                                  const nextCorrect = correctMulti
                                    .filter((value) => value !== optionIndex)
                                    .map((value) => (value > optionIndex ? value - 1 : value))
                                  return { ...asRecord(entry), options: nextOptions, correctIndexes: nextCorrect }
                                })
                              }
                            })
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-[#9aa0ad] transition-colors hover:bg-black/[0.04] hover:text-[#1f1f1f]"
                          aria-label="Удалить вариант"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {!lockedOptions ? (
                <div className="mt-4">
                  <AddGhostButton
                    label="Добавить вариант"
                    onClick={() =>
                      onChange({
                        ...data,
                        [quizKey]: {
                          questions: questions.map((entry, questionIndex) =>
                            questionIndex === index
                              ? { ...asRecord(entry), options: [...options, ""] }
                              : entry
                          )
                        }
                      })
                    }
                  />
                </div>
              ) : null}
            </section>
          )
        })}
        <AddGhostButton
          label="Добавить вопрос"
          onClick={() =>
            onChange({
              ...data,
              [quizKey]: {
                questions: [
                  ...questions,
                  normalizedBlock.type === "quiz_single"
                    ? ({
                        prompt: "",
                        options: lockedOptions ?? ["", ""],
                        correctIndex: lockedOptions ? 1 : 0
                      } satisfies QuizSingleQuestion)
                    : ({ prompt: "", options: ["", ""], correctIndexes: [0] } satisfies QuizMultiQuestion)
                ]
              }
            })
          }
        />
      </div>
    )
  }

  if (normalizedBlock.type === "video") {
    const videoData = asRecord(data.video)
    const items = Array.isArray(videoData.items) ? (videoData.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const current = asRecord(item)
          return (
            <section key={`${block.id}-video-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Видео ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, video: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              {asString(current.url).trim() ? (
                <InlineLessonVideo url={asString(current.url).trim()} className="!max-w-none rounded-[24px]" />
              ) : asString(current.thumbnailUrl).trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asString(current.thumbnailUrl).trim()}
                  alt={asString(current.title).trim() || "Видео"}
                  className="w-full rounded-[24px] object-cover"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-[24px] bg-[#eceef3] text-[#7b8091]">
                  Превью видео
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <LocalUploadButton
                  lessonId={block.lesson_id}
                  label="Загрузить видео"
                  accept="video/*"
                  onSelect={({ url, fileName }) =>
                    onChange({
                      ...data,
                      video: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...asRecord(entry),
                                url,
                                title: asString(asRecord(entry).title) || fileName
                              }
                            : entry
                        )
                      }
                    })
                  }
                />
                <Input
                  value={asString(current.url)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      video: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), url: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Ссылка YouTube / Vimeo"
                  className={fieldClass}
                />
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={asString(current.title)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      video: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), title: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Название видео"
                  className={fieldClass}
                />
                <Input
                  value={asString(current.thumbnailUrl)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      video: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), thumbnailUrl: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="URL постера (необязательно)"
                  className={fieldClass}
                />
                <Textarea
                  value={asString(current.caption)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      video: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), caption: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Подпись или подсказка к видео"
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                />
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  if (normalizedBlock.type === "image") {
    const imageData = asRecord(data.image)
    const items = Array.isArray(imageData.items) ? (imageData.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const current = asRecord(item)
          return (
            <section key={`${block.id}-image-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Картинка ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, image: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              {asString(current.url).trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asString(current.url).trim()}
                  alt={asString(current.title).trim() || "Изображение"}
                  className="aspect-[4/3] w-full rounded-[24px] object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-[24px] bg-[#eceef3] text-[#7b8091]">
                  Превью изображения
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <LocalUploadButton
                  lessonId={block.lesson_id}
                  label="Загрузить картинку"
                  accept="image/*"
                  onSelect={({ url, fileName }) =>
                    onChange({
                      ...data,
                      image: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...asRecord(entry),
                                url,
                                title: asString(asRecord(entry).title) || fileName
                              }
                            : entry
                        )
                      }
                    })
                  }
                />
                <Input
                  value={asString(current.url)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      image: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), url: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="URL изображения"
                  className={fieldClass}
                />
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={asString(current.title)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      image: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), title: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Название или alt"
                  className={fieldClass}
                />
                <Textarea
                  value={asString(current.caption)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      image: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), caption: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Подпись"
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                />
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  if (normalizedBlock.type === "audio") {
    const audioData = asRecord(data.audio)
    const items = Array.isArray(audioData.items) ? (audioData.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const current = asRecord(item)
          return (
            <section key={`${block.id}-audio-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Аудио ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, audio: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              {asString(current.url).trim() ? (
                <audio src={asString(current.url).trim()} controls className="w-full" preload="metadata" />
              ) : (
                <div className="rounded-[20px] bg-[#eceef3] px-4 py-5 text-[#7b8091]">Аудио появится здесь</div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <LocalUploadButton
                  lessonId={block.lesson_id}
                  label="Загрузить аудио"
                  accept="audio/*"
                  onSelect={({ url, fileName }) =>
                    onChange({
                      ...data,
                      audio: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...asRecord(entry),
                                url,
                                title: asString(asRecord(entry).title) || fileName
                              }
                            : entry
                        )
                      }
                    })
                  }
                />
                <Input
                  value={asString(current.url)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      audio: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), url: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="URL аудио"
                  className={fieldClass}
                />
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={asString(current.title)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      audio: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), title: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Название аудио"
                  className={fieldClass}
                />
                <Textarea
                  value={asString(current.transcript)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      audio: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), transcript: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Транскрипт или подсказка"
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                />
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  if (normalizedBlock.type === "pdf") {
    const pdfData = asRecord(data.pdf)
    const items = Array.isArray(pdfData.items) ? (pdfData.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const current = asRecord(item)
          return (
            <section key={`${block.id}-pdf-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`PDF ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, pdf: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <LocalUploadButton
                  lessonId={block.lesson_id}
                  label="Загрузить PDF"
                  accept="application/pdf"
                  onSelect={({ url, fileName }) =>
                    onChange({
                      ...data,
                      pdf: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...asRecord(entry),
                                url,
                                title: asString(asRecord(entry).title) || fileName
                              }
                            : entry
                        )
                      }
                    })
                  }
                />
                <Input
                  value={asString(current.url)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      pdf: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), url: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="URL PDF"
                  className={fieldClass}
                />
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={asString(current.title)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      pdf: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), title: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Название PDF"
                  className={fieldClass}
                />
                <Textarea
                  value={asString(current.description)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      pdf: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), description: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Описание файла"
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                />
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  if (normalizedBlock.type === "speaking") {
    const speakingData = asRecord(data.speaking)
    const items = Array.isArray(speakingData.items) ? (speakingData.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const current = asRecord(item)
          return (
            <section key={`${block.id}-speaking-${index}`} className={sectionShellClass}>
              <SectionTitle
                title={`Голосовой ответ ${index + 1}`}
                onRemove={items.length > 1 ? () => onChange({ ...data, speaking: { items: items.filter((_, itemIndex) => itemIndex !== index) } }) : undefined}
              />
              <div className="space-y-3">
                <Input
                  value={asString(current.prompt)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      speaking: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), prompt: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Что должен сказать ученик"
                  className={fieldClass}
                />
                <Textarea
                  value={asString(current.helper)}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      speaking: {
                        items: items.map((entry, itemIndex) =>
                          itemIndex === index ? { ...asRecord(entry), helper: event.target.value } : entry
                        )
                      }
                    })
                  }
                  placeholder="Подсказка или критерии ответа"
                  className={cn(fieldClass, "min-h-[100px] resize-y")}
                />
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  if (normalizedBlock.type === "homework") {
    const homework = asRecord(data.homework)
    const responseMode = (homework.responseMode as HomeworkResponseMode | undefined) ?? "text"
    return (
      <section className={sectionShellClass}>
        <SectionTitle title="Задание для ученика" />
        <Textarea
          value={asString(homework.prompt)}
          onChange={(event) => onChange({ ...data, homework: { ...homework, prompt: event.target.value } })}
          placeholder="Напишите, что должен сделать ученик"
          className={cn(fieldClass, "min-h-[140px] resize-y")}
        />
        <div className="mt-5">
          <FieldLabel>Тип ответа</FieldLabel>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(["text", "file", "text_file"] as HomeworkResponseMode[]).map((mode) => (
              <ChoiceToggle
                key={mode}
                active={responseMode === mode}
                label={homeworkModeLabel(mode)}
                onClick={() => onChange({ ...data, homework: { ...homework, responseMode: mode } })}
              />
            ))}
          </div>
        </div>
        <div className="mt-5">
          <FieldLabel>Дедлайн</FieldLabel>
          <Input
            type="date"
            value={asString(homework.deadline)}
            onChange={(event) => onChange({ ...data, homework: { ...homework, deadline: event.target.value } })}
            className={cn(fieldClass, "mt-3")}
          />
        </div>
      </section>
    )
  }

  if (normalizedBlock.type === "note") {
    const note = asRecord(data.note)
    return (
      <section className={sectionShellClass}>
        <SectionTitle title="Legacy заметка" />
        <div className="space-y-3">
          <Input
            value={asString(note.title)}
            onChange={(event) => onChange({ ...data, note: { ...note, title: event.target.value } })}
            placeholder="Заголовок"
            className={fieldClass}
          />
          <Textarea
            value={asString(note.content)}
            onChange={(event) => onChange({ ...data, note: { ...note, content: event.target.value } })}
            placeholder="Содержимое"
            className={cn(fieldClass, "min-h-[120px] resize-y")}
          />
        </div>
      </section>
    )
  }

  if (normalizedBlock.type === "link") {
    const link = asRecord(data.link)
    return (
      <section className={sectionShellClass}>
        <SectionTitle title="Legacy ссылка" />
        <div className="space-y-3">
          <Input
            value={asString(link.label)}
            onChange={(event) => onChange({ ...data, link: { ...link, label: event.target.value } })}
            placeholder="Текст кнопки"
            className={fieldClass}
          />
          <Input
            value={asString(link.url)}
            onChange={(event) => onChange({ ...data, link: { ...link, url: event.target.value } })}
            placeholder="URL"
            className={fieldClass}
          />
          <Textarea
            value={asString(link.hint)}
            onChange={(event) => onChange({ ...data, link: { ...link, hint: event.target.value } })}
            placeholder="Подсказка"
            className={cn(fieldClass, "min-h-[100px] resize-y")}
          />
        </div>
      </section>
    )
  }

  if (normalizedBlock.type === "divider") {
    const divider = asRecord(data.divider)
    return (
      <section className={sectionShellClass}>
        <SectionTitle title="Legacy разделитель" />
        <Input
          value={asString(divider.label)}
          onChange={(event) => onChange({ ...data, divider: { ...divider, label: event.target.value } })}
          placeholder="Подпись разделителя"
          className={fieldClass}
        />
      </section>
    )
  }

  return (
    <section className={sectionShellClass}>
      <SectionTitle title="Редактор блока" />
      <p className="text-[15px] text-[#7b8091]">Для этого типа блока пока нет отдельного редактора.</p>
    </section>
  )
}
