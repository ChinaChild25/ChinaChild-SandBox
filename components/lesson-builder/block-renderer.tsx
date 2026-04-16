"use client"

import { useMemo, useRef, useState } from "react"
import type { TeacherLessonBlock } from "@/lib/types"
import { blockTypeStudentTheme } from "@/components/lesson-builder/block-theme"
import { InlineLessonVideo } from "@/components/lesson-builder/inline-lesson-video"
import { LessonAudioPlayerRow } from "@/components/lesson-builder/lesson-audio-waveform"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardTitle } from "@/components/ui/card"

type Pair = { left: string; right: string }
type TrueFalseQuestion = { prompt: string; answer: boolean }

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? ""))
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
}

function asPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    left: asString((item as Record<string, unknown>)?.left),
    right: asString((item as Record<string, unknown>)?.right)
  }))
}

function asTrueFalseQuestions(value: unknown): TrueFalseQuestion[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      prompt: asString((item as Record<string, unknown>)?.prompt).trim(),
      answer: Boolean((item as Record<string, unknown>)?.answer)
    }))
    .filter((item) => item.prompt)
}

function parseFillGaps(text: string): { parts: string[]; answers: string[]; gaps: number } {
  // Поддерживаем новый формат [слово], а также legacy [] и ___.
  const tokenRe = /\[([^[\]]*?)\]|___/g
  const parts: string[] = []
  const answers: string[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = tokenRe.exec(text)) !== null) {
    parts.push(text.slice(lastIndex, m.index))
    lastIndex = m.index + m[0].length
    const bracketWord = (m[1] ?? "").trim()
    answers.push(bracketWord)
  }

  parts.push(text.slice(lastIndex))
  return { parts, answers, gaps: answers.length }
}

function joinClasses(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededShuffle<T>(items: T[], seedKey: string): T[] {
  const out = [...items]
  let seed = hashString(seedKey) || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function blockGoalAndInstruction(type: TeacherLessonBlock["type"]): { goal: string; instruction: string } {
  switch (type) {
    case "text":
      return {
        goal: "Прочитать и понять материал",
        instruction: "Внимательно прочитайте текст — он понадобится в следующих заданиях."
      }
    case "matching":
      return {
        goal: "Сопоставить пары",
        instruction: "Сравните элементы слева и справа и найдите соответствия."
      }
    case "fill_gaps":
      return {
        goal: "Вставить слова в пропуски",
        instruction:
          "Перетащите слова из банка в пропуски (или нажмите слово, затем пропуск). Каждое слово можно использовать один раз."
      }
    case "quiz_single":
      return {
        goal: "Выбрать правильный ответ",
        instruction: "Отметьте один вариант, который вы считаете правильным."
      }
    case "image":
      return {
        goal: "Рассмотреть изображение и понять смысл",
        instruction: "Посмотрите на картинку и прочитайте подпись (если есть)."
      }
    case "video":
      return {
        goal: "Посмотреть видео и понять ключевые идеи",
        instruction: "Просмотрите видео и обратите внимание на основные моменты."
      }
    case "audio":
      return {
        goal: "Прослушать аудио и понять смысл",
        instruction: "Прослушайте запись. При необходимости ориентируйтесь на подпись/транскрипт."
      }
    default: {
      const _never: never = type
      return _never
    }
  }
}

const TASK_BADGE_COLORS: Record<
  string,
  { rgb: string; label: string; textRgb: string }
> = {
  blue: { rgb: "125 176 232", textRgb: "24 63 104", label: "Синий" },
  pink: { rgb: "232 135 135", textRgb: "110 45 45", label: "Розовый" },
  yellow: { rgb: "232 153 74", textRgb: "99 55 15", label: "Жёлтый" },
  green: { rgb: "163 201 104", textRgb: "34 74 33", label: "Зелёный" },
  purple: { rgb: "201 157 240", textRgb: "72 46 102", label: "Фиолетовый" },
  red: { rgb: "240 120 120", textRgb: "112 35 35", label: "Красный" }
}

function badgeColors(key: string | null | undefined) {
  return TASK_BADGE_COLORS[key ?? ""] ?? TASK_BADGE_COLORS.blue
}

export function BlockRenderer({ blocks, taskBadgeColor = "blue" }: { blocks: TeacherLessonBlock[]; taskBadgeColor?: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const ordered = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks])
  const matchingShuffleSeedRef = useRef(`${Date.now()}-${Math.random()}`)
  const [activeBankWord, setActiveBankWord] = useState<{ blockId: string; word: string } | null>(null)
  const [returnGapTarget, setReturnGapTarget] = useState<{ blockId: string; gapIndex: number } | null>(null)
  const [dragOverGap, setDragOverGap] = useState<{ blockId: string; gapIndex: number } | null>(null)
  const dragGhostRef = useRef<HTMLDivElement | null>(null)

  function handleWordDragStart(e: React.DragEvent<HTMLElement>, word: string, blockId: string) {
    e.dataTransfer.setData("application/x-fillgap-word", word)
    e.dataTransfer.setData("application/x-fillgap-block", blockId)
    e.dataTransfer.effectAllowed = "move"
    const chipStyles = window.getComputedStyle(e.currentTarget)

    const ghost = document.createElement("div")
    ghost.textContent = word
    ghost.style.position = "fixed"
    ghost.style.top = "-9999px"
    ghost.style.left = "-9999px"
    ghost.style.padding = "6px 12px"
    ghost.style.borderRadius = "9999px"
    ghost.style.background = chipStyles.backgroundColor || "rgb(255 243 226)"
    ghost.style.color = chipStyles.color || "rgb(122 86 50)"
    ghost.style.fontSize = "14px"
    ghost.style.fontWeight = "600"
    ghost.style.border = `1px solid ${chipStyles.borderColor || "rgb(248 223 190)"}`
    ghost.style.boxShadow = chipStyles.boxShadow && chipStyles.boxShadow !== "none" ? chipStyles.boxShadow : "0 1px 2px rgba(0,0,0,0.1)"
    ghost.style.pointerEvents = "none"
    document.body.appendChild(ghost)
    dragGhostRef.current = ghost
    e.dataTransfer.setDragImage(ghost, 16, 12)
  }

  function handleWordDragEnd() {
    setDragOverGap(null)
    if (dragGhostRef.current) {
      dragGhostRef.current.remove()
      dragGhostRef.current = null
    }
  }

  const badge = badgeColors(taskBadgeColor)
  const matchingOptionsByBlockId = useMemo(() => {
    const byId: Record<string, string[]> = {}
    for (const block of ordered) {
      if (block.type !== "matching") continue
      const pairs = asPairs(block.data?.pairs).filter((pair) => pair.left.trim() || pair.right.trim())
      const options = pairs.map((pair) => pair.right).filter((value) => value.trim())
      byId[block.id] = seededShuffle(options, `${block.id}:${matchingShuffleSeedRef.current}`)
    }
    return byId
  }, [ordered])

  return (
    <div className="space-y-6">
      {ordered.map((block, index) => {
        const data = block.data ?? {}
        const meta = blockGoalAndInstruction(block.type)
        const audioUrl = block.type === "audio" ? asString(data.url) : ""
        const audioPeaks = block.type === "audio" ? asNumberArray(data.waveform_peaks) : []
        const textQuestions = block.type === "text" ? asTrueFalseQuestions(data.questions) : []
        const fillText = block.type === "fill_gaps" ? asString(data.text) : ""
        const fillParse = block.type === "fill_gaps" ? parseFillGaps(fillText) : { parts: [""], answers: [], gaps: 0 }
        const rawBankWords =
          block.type === "fill_gaps"
            ? (fillParse.answers.some(Boolean) ? fillParse.answers : asStringArray(data.answers))
                .map((x) => x.trim())
                .filter(Boolean)
            : []
        const bankWords = block.type === "fill_gaps" ? seededShuffle(rawBankWords, `${block.id}:${matchingShuffleSeedRef.current}:fill`) : []
        const usedWords =
          block.type === "fill_gaps"
            ? new Set(
                Array.from({ length: fillParse.gaps })
                  .map((_, gapIndex) => answers[`${block.id}-gap-${gapIndex}`] ?? "")
                  .map((x) => x.trim())
                  .filter(Boolean)
              )
            : new Set<string>()
        const availableWords = block.type === "fill_gaps" ? bankWords.filter((word) => !usedWords.has(word)) : []
        const quizQuestion = block.type === "quiz_single" ? asString(data.question).trim() : ""
        const quizOptions = block.type === "quiz_single" ? asStringArray(data.options).map((x) => x.trim()).filter(Boolean) : []
        const imageUrl = block.type === "image" ? asString(data.url).trim() : ""
        const imageAlt = block.type === "image" ? asString(data.alt) : ""
        const imageCaption = block.type === "image" ? asString(data.caption) : ""
        const videoUrl = block.type === "video" ? asString(data.url).trim() : ""
        const videoCaption = block.type === "video" ? asString(data.caption) : ""
        const theme = blockTypeStudentTheme[block.type]
        return (
          <div key={block.id} className="flex items-start gap-3">
            <div className="pt-1">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[14px] shadow-sm backdrop-blur-md"
                style={{
                  backgroundColor: `rgb(${badge.rgb} / 0.22)`
                }}
                aria-label={`Задание ${index + 1}`}
                title={`Задание ${index + 1} • ${badge.label}`}
              >
                <span className="text-sm font-semibold" style={{ color: `rgb(${badge.textRgb} / 0.95)` }}>
                  {index + 1}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <CardTitle className="!text-[24px] font-semibold tracking-tight whitespace-normal break-words sm:whitespace-nowrap sm:overflow-hidden sm:text-ellipsis sm:!leading-[30px] sm:!h-[30px]">
                {meta.goal}
              </CardTitle>

              <div className="mt-3 space-y-3 text-sm">
              {block.type === "text" && (
                <div className="space-y-3">
                  <p>{asString(data.content)}</p>
                  {textQuestions.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ответьте на вопросы по тексту</p>
                      {textQuestions.map((question, questionIndex) => {
                        const answerKey = `${block.id}-text-tf-${questionIndex}`
                        const selectedValue = answers[answerKey] ?? ""
                        return (
                          <div key={answerKey} className="grid gap-2 rounded-lg border border-border/70 bg-background/50 p-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                            <p className="text-sm">{question.prompt}</p>
                            <div
                              className={joinClasses(
                                "rounded-md border px-3 py-2 transition-colors",
                                selectedValue ? theme.soft : "border-border bg-background"
                              )}
                            >
                              <Select
                                value={selectedValue}
                                onValueChange={(value) =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [answerKey]: value === "__empty__" ? "" : value
                                  }))
                                }
                              >
                                <SelectTrigger
                                  className={joinClasses(
                                    "h-auto w-full border-0 bg-transparent px-0 py-0 text-left text-sm shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent",
                                    selectedValue ? theme.text : "text-muted-foreground"
                                  )}
                                  aria-label={`Ответ на вопрос: ${question.prompt}`}
                                >
                                  <SelectValue placeholder="Выберите ответ" />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-popover">
                                  <SelectItem value="__empty__">Выберите ответ</SelectItem>
                                  <SelectItem value="true">Правда</SelectItem>
                                  <SelectItem value="false">Ложь</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )}

              {block.type === "matching" && (
                <div className="space-y-2">
                  {(() => {
                    const matchingPairs = asPairs(data.pairs).filter((pair) => pair.left.trim() || pair.right.trim())
                    const matchingOptions = matchingOptionsByBlockId[block.id] ?? []
                    const selectedRightValues = matchingPairs
                      .map((_, rowIndex) => answers[`${block.id}-match-${rowIndex}`] ?? "")
                      .filter(Boolean)

                    return matchingPairs.length > 0 ? (
                      <>
                        {matchingPairs.map((pair, rowIndex) => {
                          const answerKey = `${block.id}-match-${rowIndex}`
                          const selectedValue = answers[answerKey] ?? ""
                          const usedElsewhere = new Set(selectedRightValues.filter((value) => value && value !== selectedValue))

                          return (
                            <div key={`${block.id}-pair-${rowIndex}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)]">
                              <div className="rounded-md border border-border bg-background px-3 py-2">{pair.left || "..."}</div>
                              <div
                                className={joinClasses(
                                  "rounded-md border px-3 py-2 transition-colors",
                                  selectedValue ? theme.soft : "border-border bg-background"
                                )}
                              >
                                <label className="sr-only" htmlFor={`${block.id}-match-select-${rowIndex}`}>
                                  Выберите соответствие для {pair.left || `пары ${rowIndex + 1}`}
                                </label>
                                <Select
                                  value={selectedValue}
                                  onValueChange={(value) =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [answerKey]: value === "__empty__" ? "" : value
                                    }))
                                  }
                                >
                                  <SelectTrigger
                                    id={`${block.id}-match-select-${rowIndex}`}
                                    className={joinClasses(
                                      "h-auto w-full border-0 bg-transparent px-0 py-0 text-left text-sm shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent",
                                      selectedValue ? theme.text : "text-muted-foreground"
                                    )}
                                    aria-label={`Выберите соответствие для ${pair.left || `пары ${rowIndex + 1}`}`}
                                  >
                                    <SelectValue placeholder="Выберите соответствие" />
                                  </SelectTrigger>
                                  <SelectContent className="border-border bg-popover">
                                    <SelectItem value="__empty__">Выберите соответствие</SelectItem>
                                    {matchingOptions.map((option, optionIndex) => (
                                      <SelectItem
                                      key={`${block.id}-match-option-${optionIndex}`}
                                      value={option}
                                      disabled={usedElsewhere.has(option)}
                                    >
                                      {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )
                        })}

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            className="rounded-[10px] bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                            onClick={() =>
                              setAnswers((prev) => {
                                const next = { ...prev }
                                matchingPairs.forEach((_, rowIndex) => {
                                  delete next[`${block.id}-match-${rowIndex}`]
                                })
                                return next
                              })
                            }
                          >
                            Сбросить ответы
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Пары для сопоставления пока не заполнены.</p>
                    )
                  })()}
                </div>
              )}

              {block.type === "fill_gaps" && (
                <div className="space-y-2">
                  {fillParse.gaps === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Пропуски не найдены. Пропуски обозначайте как `[]` в тексте (или `___` для старого формата).
                    </p>
                  ) : (
                    <>
                      <div className="rounded-lg border border-border bg-background/40 p-3 leading-7">
                        {fillParse.parts.map((part, partIndex) => {
                          const gapIndex = partIndex
                          const hasGapAfter = gapIndex < fillParse.gaps
                          const selected = answers[`${block.id}-gap-${gapIndex}`] ?? ""

                          return (
                            <span key={`${block.id}-fill-part-${partIndex}`}>
                              {part}
                              {hasGapAfter ? (
                                <span
                                  className="mx-1 inline-flex align-middle"
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    setDragOverGap({ blockId: block.id, gapIndex })
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    const droppedBlockId = e.dataTransfer.getData("application/x-fillgap-block")
                                    if (droppedBlockId !== block.id) return
                                    const word = e.dataTransfer.getData("application/x-fillgap-word")
                                    if (!word) return
                                    const sourceGapRaw = e.dataTransfer.getData("application/x-fillgap-source-gap")
                                    const sourceGapIndex = sourceGapRaw ? Number(sourceGapRaw) : null
                                    const current = answers[`${block.id}-gap-${gapIndex}`] ?? ""
                                    if (sourceGapIndex !== null && Number.isInteger(sourceGapIndex) && sourceGapIndex >= 0) {
                                      setAnswers((prev) => {
                                        const next = { ...prev }
                                        if (sourceGapIndex !== gapIndex) next[`${block.id}-gap-${sourceGapIndex}`] = ""
                                        next[`${block.id}-gap-${gapIndex}`] = word
                                        return next
                                      })
                                      setActiveBankWord(null)
                                      setReturnGapTarget(null)
                                      return
                                    }
                                    if (word !== current && usedWords.has(word)) return
                                    setAnswers((prev) => ({ ...prev, [`${block.id}-gap-${gapIndex}`]: word }))
                                    setActiveBankWord(null)
                                    setReturnGapTarget(null)
                                    setDragOverGap(null)
                                  }}
                                  onClick={() => {
                                    const current = answers[`${block.id}-gap-${gapIndex}`] ?? ""
                                    if (current) {
                                      // Выбор слова для возврата в банк по клику на область банка.
                                      setReturnGapTarget((prev) =>
                                        prev?.blockId === block.id && prev.gapIndex === gapIndex ? null : { blockId: block.id, gapIndex }
                                      )
                                      return
                                    }
                                    if (!activeBankWord) return
                                    if (activeBankWord.blockId !== block.id) return
                                    if (usedWords.has(activeBankWord.word)) return
                                    setAnswers((prev) => ({ ...prev, [`${block.id}-gap-${gapIndex}`]: activeBankWord.word }))
                                    setActiveBankWord(null)
                                    setReturnGapTarget(null)
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <span
                                    className={joinClasses(
                                      "my-1 inline-flex min-h-[2rem] min-w-[4.5rem] items-center justify-center rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                                      selected ? joinClasses(theme.active, "shadow-sm") : "border-border bg-muted/20 text-muted-foreground",
                                      dragOverGap?.blockId === block.id && dragOverGap.gapIndex === gapIndex ? joinClasses("ring-2", theme.ring) : ""
                                    )}
                                    draggable={Boolean(selected)}
                                    onDragStart={(e) => {
                                      if (!selected) return
                                      handleWordDragStart(e, selected, block.id)
                                      e.dataTransfer.setData("application/x-fillgap-source-gap", String(gapIndex))
                                    }}
                                    onDragEnd={handleWordDragEnd}
                                  >
                                    {selected ? selected : <span aria-hidden>&nbsp;</span>}
                                  </span>
                                </span>
                              ) : null}
                            </span>
                          )
                        })}
                      </div>

                      <div
                        className={[
                          "space-y-2 rounded-lg border border-dashed p-3 transition-colors",
                          theme.panel
                        ].join(" ")}
                        onDragOver={(e) => {
                          e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const droppedBlockId = e.dataTransfer.getData("application/x-fillgap-block")
                          if (droppedBlockId !== block.id) return
                          const sourceGapRaw = e.dataTransfer.getData("application/x-fillgap-source-gap")
                          const sourceGapIndex = sourceGapRaw ? Number(sourceGapRaw) : null
                          if (sourceGapIndex !== null && Number.isInteger(sourceGapIndex) && sourceGapIndex >= 0) {
                            setAnswers((prev) => ({ ...prev, [`${block.id}-gap-${sourceGapIndex}`]: "" }))
                            setReturnGapTarget(null)
                          }
                          setActiveBankWord(null)
                        }}
                        onClick={() => {
                          if (!returnGapTarget || returnGapTarget.blockId !== block.id) return
                          setAnswers((prev) => ({ ...prev, [`${block.id}-gap-${returnGapTarget.gapIndex}`]: "" }))
                          setReturnGapTarget(null)
                          setActiveBankWord(null)
                        }}
                      >
                        {returnGapTarget?.blockId === block.id ? (
                          <p className={joinClasses("text-xs", theme.text)}>
                            Слово выбрано для возврата. Нажмите на эту область банка слов, чтобы вернуть его обратно.
                          </p>
                        ) : null}
                        {availableWords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {availableWords.map((word, wIndex) => (
                              <button
                                key={`${block.id}-bank-chip-${wIndex}`}
                                type="button"
                                className={[
                                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors shadow-sm",
                                  "border",
                                  theme.active,
                                  theme.hover,
                                  activeBankWord?.blockId === block.id && activeBankWord.word === word
                                    ? joinClasses("ring-2", theme.ring)
                                    : ""
                                ].join(" ")}
                                draggable
                                onDragStart={(e) => handleWordDragStart(e, word, block.id)}
                                onDragEnd={handleWordDragEnd}
                                onClick={() => {
                                  setActiveBankWord({ blockId: block.id, word })
                                }}
                              >
                                {word}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {bankWords.length > 0 ? "Все слова уже использованы. Кликните по слову в пропуске, чтобы вернуть его в банк." : "Слова банка пока не добавлены."}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {block.type === "quiz_single" && (
                <div className="space-y-2">
                  <p className="mt-2 font-medium">{quizQuestion || "Вопрос пока не заполнен."}</p>
                  {quizOptions.map((option, optionIndex) => (
                    <label
                      key={`${block.id}-opt-${optionIndex}`}
                      className={joinClasses(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                        answers[block.id] === String(optionIndex) ? theme.active : "border-border/70 bg-background/60 hover:bg-muted/30"
                      )}
                    >
                      <input
                        type="radio"
                        className={joinClasses("h-5 w-5 cursor-pointer", theme.accent)}
                        name={`quiz-${block.id}`}
                        checked={answers[block.id] === String(optionIndex)}
                        onChange={() => setAnswers((prev) => ({ ...prev, [block.id]: String(optionIndex) }))}
                      />
                      <span className={answers[block.id] === String(optionIndex) ? theme.text : ""}>{option}</span>
                    </label>
                  ))}
                  {quizOptions.length === 0 ? <p className="text-xs text-muted-foreground">Варианты ответа пока не заполнены.</p> : null}
                </div>
              )}

              {block.type === "image" && (
                <div className="space-y-2">
                  {imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL от преподавателя */}
                      <img
                        src={imageUrl}
                        alt={imageAlt || "Иллюстрация к уроку"}
                        loading="lazy"
                        className="max-h-96 w-auto max-w-full rounded-lg border border-border object-contain"
                      />
                      {imageCaption ? <p className="text-muted-foreground">{imageCaption}</p> : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Картинка не указана.</p>
                  )}
                </div>
              )}

              {block.type === "video" && (
                <div className="space-y-2">
                  {videoUrl ? (
                    <>
                      <InlineLessonVideo url={videoUrl} />
                      {videoCaption ? <p className="text-muted-foreground">{videoCaption}</p> : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Видео не указано.</p>
                  )}
                </div>
              )}

              {block.type === "audio" && (
                <div className="space-y-2">
                  {audioUrl && !audioUrl.startsWith("blob:") ? (
                    <LessonAudioPlayerRow
                      src={audioUrl}
                      peaks={audioPeaks.length > 0 ? audioPeaks : null}
                      containerClassName={theme.panel}
                      buttonClassName={joinClasses(theme.active, theme.hover, "border shadow-sm")}
                      playedBarClassName="bg-[#7f3c4f] dark:bg-[#ffd9e4]"
                      idleBarClassName="bg-muted-foreground/25 dark:bg-muted-foreground/30"
                      liveActiveBarClassName="bg-[#7f3c4f]/90 dark:bg-[#ffd9e4]/90"
                      liveIdleBarClassName="bg-muted-foreground/35 dark:bg-muted-foreground/40"
                      timeClassName={theme.text}
                    />
                  ) : audioUrl.startsWith("blob:") ? (
                    <p className="my-2 text-muted-foreground">Аудио было записано как временная локальная ссылка и больше недоступно.</p>
                  ) : (
                    <p className="text-muted-foreground">Аудио не добавлено.</p>
                  )}
                  {asString(data.transcript) ? <p className="text-muted-foreground">{asString(data.transcript)}</p> : null}
                </div>
              )}

              <p className="pt-1 text-xs text-muted-foreground">{meta.instruction}</p>
              </div>
            </div>
          </div>
        )
      })}
      {ordered.length === 0 && (
        <div className="rounded-lg bg-muted/20 p-6 text-sm text-muted-foreground">В уроке пока нет блоков.</div>
      )}
    </div>
  )
}
