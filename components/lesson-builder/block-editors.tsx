"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Check, CircleHelp, Link2, Mic, Minus, NotebookText, Plus, Square, Trash2, X } from "lucide-react"
import type { LessonBlockType, TeacherLessonBlock } from "@/lib/types"
import { computeWaveformPeaksFromBlob } from "@/lib/audio-waveform"
import { InlineLessonVideo } from "@/components/lesson-builder/inline-lesson-video"
import { LessonAudioPlayerRow } from "@/components/lesson-builder/lesson-audio-waveform"
import { blockTypeAccentFillClass, blockTypeStudentTheme } from "@/components/lesson-builder/block-theme"
import { TrueFalseInlineSelect } from "@/components/lesson-builder/true-false-inline-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  createDefaultSegmentPayload,
  getLessonBlockSegments,
  mergeSegmentsIntoBlockData
} from "@/lib/lesson-block-segments"
import { cn } from "@/lib/utils"

export { createDefaultBlockData } from "@/lib/lesson-block-segments"

type MatchingPair = { left: string; right: string }
type TrueFalseQuestion = { prompt: string; answer: boolean }

const BLOCK_TITLES: Record<LessonBlockType, string> = {
  text: "Текст",
  matching: "Сопоставление",
  fill_gaps: "Пропуски в тексте",
  quiz_single: "Тест",
  image: "Картинка",
  video: "Видео",
  audio: "Аудио",
  note: "Заметка",
  link: "Ссылка",
  divider: "Разделитель"
}

/** Кнопки «+» в блоке: заливка по типу блока без обводки (как в превью). */
function accentAddIconButtonClass(type: LessonBlockType) {
  return cn("h-9 w-9 shrink-0 rounded-xl border-0 shadow-none", blockTypeAccentFillClass[type])
}
/** Однострочные поля — высота как у полей в сетках блоков (48px). */
const INPUT_SURFACE_CLASS =
  "h-12 min-h-12 border-0 bg-background text-card-foreground shadow-none focus-visible:border-0 focus-visible:shadow-none"
const TEXTAREA_SURFACE_CLASS =
  "border-0 bg-background/90 shadow-none focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0 dark:bg-input/45"
/** Поля с китайским учебным текстом — 20px через `styles/ds-figma-tokens.css` (.lesson-cjk-text). */
const LESSON_CJK_TEXT_CLASS = "lesson-cjk-text"
const TEACHER_HELP: Record<LessonBlockType, string[]> = {
  text: [
    "Добавьте теорию или пример, который ученик должен прочитать.",
    "Необязательно: добавьте мини-вопросы Правда/Ложь, чтобы проверить понимание."
  ],
  matching: [
    "Каждая строка «Слева → Справа» — это правильная пара.",
    "У ученика варианты справа перемешиваются автоматически."
  ],
  fill_gaps: [
    "Пишите текст целиком и выделяйте пропуски как [слово].",
    "Слова из скобок автоматически попадут в банк и перемешаются у ученика."
  ],
  quiz_single: [
    "Отметьте правильный вариант круглой галочкой слева.",
    "У ученика можно выбрать только один ответ."
  ],
  image: [
    "Добавьте прямую ссылку на изображение и, по желанию, подпись.",
    "Подпись поможет ученику понять контекст задания."
  ],
  video: [
    "Вставьте YouTube/Vimeo ссылку или прямую ссылку на видеофайл.",
    "При необходимости добавьте подпись с тем, на что обратить внимание."
  ],
  audio: [
    "Можно вставить ссылку на аудио или записать голосовое прямо здесь.",
    "Добавьте транскрипт/подпись, чтобы ученику было легче понять запись."
  ],
  note: [
    "Короткая заметка перед заданием: правила, подсказка, контекст.",
    "Используйте заголовок, чтобы ученик сразу понял, о чём блок."
  ],
  link: [
    "Вставьте внешнюю ссылку на материал (Google Docs, PDF, сайт и т.д.).",
    "Подпишите кнопку действия и коротко объясните, что нужно сделать."
  ],
  divider: [
    "Разделяет этапы урока (например: «Практика», «Финал»).",
    "Полезно для длинных уроков, чтобы ученик не терялся в структуре."
  ]
}

function blockTitle(type: LessonBlockType): string {
  return BLOCK_TITLES[type]
}

function variantTitle(data: Record<string, unknown> | null | undefined): string | null {
  const raw = typeof data?.exercise_variant_label === "string" ? data.exercise_variant_label.trim() : ""
  return raw || null
}

function EditorTooltip({
  title,
  side = "top",
  children
}: {
  title: string
  side?: "top" | "bottom" | "left" | "right"
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        aria-label={title}
        className="max-w-[16rem] text-left"
      >
        <p className="leading-snug">{title}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function TeacherHint({ type }: { type: LessonBlockType }) {
  return (
    <div className="flex justify-end pt-1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Подсказка для преподавателя"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <CircleHelp className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-1.5 p-3 text-xs">
          <p className="font-medium">Подсказка для преподавателя</p>
          {TEACHER_HELP[type].map((line, idx) => (
            <p key={`${type}-hint-${idx}`} className="text-muted-foreground">
              {idx + 1}. {line}
            </p>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

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

function extractBracketAnswers(text: string): string[] {
  const matches = Array.from(text.matchAll(/\[([^[\]]*?)\]/g))
  return matches.map((m) => (m[1] ?? "").trim()).filter(Boolean)
}

function asPairs(value: unknown): MatchingPair[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => ({
    left: asString((row as Record<string, unknown>)?.left),
    right: asString((row as Record<string, unknown>)?.right)
  }))
}

function asTrueFalseQuestions(value: unknown): TrueFalseQuestion[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    prompt: asString((item as Record<string, unknown>)?.prompt),
    answer: Boolean((item as Record<string, unknown>)?.answer)
  }))
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Не удалось прочитать аудио"))
    reader.onloadend = () => resolve(String(reader.result ?? ""))
    reader.readAsDataURL(blob)
  })
}

export function BlockEditors({
  blocks,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  blocks: TeacherLessonBlock[]
  onChange: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}) {
  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">Добавьте первый блок</p>
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          data-lesson-block-editor={block.id}
          className="w-full min-w-0 scroll-mt-28 rounded-[28px] border-0 bg-[var(--input-background)] p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-black text-xs font-semibold tabular-nums text-white">
                {index + 1}
              </span>
              <p className="min-w-0 text-lg font-semibold">{variantTitle(block.data) ?? blockTitle(block.type)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <EditorTooltip side="bottom" title="Выше в уроке">
                <Button type="button" variant="ghost" size="icon" onClick={() => onMoveUp(block.id)} disabled={index === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </EditorTooltip>
              <EditorTooltip side="bottom" title="Ниже в уроке">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveDown(block.id)}
                  disabled={index === blocks.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </EditorTooltip>
              <EditorTooltip side="bottom" title="Удалить блок">
                <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(block.id)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </EditorTooltip>
            </div>
          </div>
          <BlockEditorByType block={block} onChange={onChange} />
        </div>
      ))}
    </div>
  )
}

/** Подсказка к кнопке «Добавить» — ещё одна часть того же типа внутри текущего блока. */
const SEGMENT_ADD_TOOLTIP: Record<LessonBlockType, string> = {
  text: "Добавить в этот блок ещё один текст с отдельными вопросами правда/ложь.",
  matching: "Добавить в этот блок ещё одно задание на сопоставление пар.",
  fill_gaps: "Добавить в этот блок ещё один текст с пропусками и банком слов.",
  quiz_single: "Добавить в этот блок ещё один вопрос с вариантами ответа.",
  image: "Добавить в этот блок ещё одно изображение с подписью.",
  video: "Добавить в этот блок ещё одно видео с подписью.",
  audio: "Добавить в этот блок ещё одну аудиозапись с транскриптом.",
  note: "Добавить в этот блок ещё одну заметку.",
  link: "Добавить в этот блок ещё одну ссылку на материал.",
  divider: "Добавить в этот блок ещё один разделитель этапа."
}

const SEGMENT_SHELL_CLASS =
  "space-y-3 rounded-[20px] border border-border/35 bg-background/40 p-3 sm:p-4"

function SegmentBlockChrome({
  partLabel,
  canRemove,
  onRemove,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown
}: {
  partLabel: string
  canRemove: boolean
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2">
      <p className="text-xs font-medium text-muted-foreground">{partLabel}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        <EditorTooltip side="bottom" title="Выше в блоке">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </EditorTooltip>
        <EditorTooltip side="bottom" title="Ниже в блоке">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDown className="h-4 w-4" />
          </Button>
        </EditorTooltip>
        <EditorTooltip side="bottom" title="Удалить эту часть">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-ds-text-tertiary hover:text-red-400"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label="Удалить часть блока"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </EditorTooltip>
      </div>
    </div>
  )
}

function BlockEditorByType({
  block,
  onChange
}: {
  block: TeacherLessonBlock
  onChange: (id: string, data: Record<string, unknown>) => void
}) {
  const segments = getLessonBlockSegments(block.type, block.data)
  const commit = (next: Record<string, unknown>[]) => onChange(block.id, mergeSegmentsIntoBlockData(next))
  const patchSeg = (idx: number, patch: Record<string, unknown>) =>
    commit(segments.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  const moveSeg = (from: number, to: number) => {
    if (to < 0 || to >= segments.length) return
    const next = [...segments]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit(next)
  }
  const removeSeg = (idx: number) => {
    if (segments.length <= 1) return
    commit(segments.filter((_, i) => i !== idx))
  }
  const addSeg = () => commit([...segments, createDefaultSegmentPayload(block.type)])

  const chrome = (segIdx: number) => (
    <SegmentBlockChrome
      partLabel={`Часть ${segIdx + 1} из ${segments.length}`}
      canRemove={segments.length > 1}
      onRemove={() => removeSeg(segIdx)}
      canMoveUp={segIdx > 0}
      canMoveDown={segIdx < segments.length - 1}
      onMoveUp={() => moveSeg(segIdx, segIdx - 1)}
      onMoveDown={() => moveSeg(segIdx, segIdx + 1)}
    />
  )

  const addAnotherRow = (
    <div className="flex justify-start pt-1">
      <EditorTooltip side="top" title={SEGMENT_ADD_TOOLTIP[block.type]}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-[10px] border-dashed"
          onClick={addSeg}
          aria-label={SEGMENT_ADD_TOOLTIP[block.type]}
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Добавить
        </Button>
      </EditorTooltip>
    </div>
  )

  if (block.type === "text") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => {
          const content = asString(segment.content)
          const questions = asTrueFalseQuestions(segment.questions)
          return (
            <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
              {chrome(segIdx)}
              <Textarea
                value={content}
                onChange={(e) => patchSeg(segIdx, { content: e.target.value })}
                placeholder="Введите текст для блока"
                className={cn("min-h-28", TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
              />
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Вопросы правда / ложь</p>
                  <p className="text-xs text-muted-foreground">
                    Необязательно. Добавьте вопросы, если хотите проверить понимание текста.
                  </p>
                </div>

                {questions.length > 0 ? (
                  <div className="space-y-2">
                    {questions.map((question, idx) => (
                      <div key={`${block.id}-s${segIdx}-tf-${idx}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem_auto]">
                        <Input
                          value={question.prompt}
                          placeholder={`Утверждение ${idx + 1}`}
                          className={cn(INPUT_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
                          onChange={(e) => {
                            const next = [...questions]
                            next[idx] = { ...next[idx], prompt: e.target.value }
                            patchSeg(segIdx, { questions: next })
                          }}
                        />
                        <EditorTooltip side="top" title="Верный ответ при проверке.">
                          <TrueFalseInlineSelect
                            value={question.answer}
                            onChange={(answer) => {
                              if (answer === null) return
                              const next = [...questions]
                              next[idx] = { ...next[idx], answer }
                              patchSeg(segIdx, { questions: next })
                            }}
                          />
                        </EditorTooltip>
                        <EditorTooltip side="left" title="Удалить вопрос">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-ds-text-tertiary hover:text-red-400"
                            aria-label={`Удалить вопрос ${idx + 1}`}
                            onClick={() => patchSeg(segIdx, { questions: questions.filter((_, qIdx) => qIdx !== idx) })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </EditorTooltip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Вопросов нет. Эта часть будет просто информативной.</p>
                )}

                <div className="flex justify-start pt-1">
                  <EditorTooltip side="top" title="Ещё вопрос правда/ложь">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={accentAddIconButtonClass("text")}
                      aria-label="Добавить вопрос правда или ложь"
                      onClick={() => patchSeg(segIdx, { questions: [...questions, { prompt: "", answer: true }] })}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.25} />
                    </Button>
                  </EditorTooltip>
                </div>
              </div>
              {!content && <p className="text-xs text-muted-foreground">Добавьте текст для ученика</p>}
            </div>
          )
        })}
        {addAnotherRow}
        <TeacherHint type="text" />
      </div>
    )
  }

  if (block.type === "matching") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => {
          const pairs = asPairs(segment.pairs)
          const rows = pairs.length > 0 ? pairs : [{ left: "", right: "" }]
          return (
            <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
              {chrome(segIdx)}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
                <span>Слева</span>
                <span>Справа</span>
                <span />
              </div>
              {rows.map((pair, idx) => (
                <div key={`${block.id}-s${segIdx}-p-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    value={pair.left}
                    placeholder="apple / 苹果"
                    className={INPUT_SURFACE_CLASS}
                    onChange={(e) => {
                      const next = [...rows]
                      next[idx] = { ...next[idx], left: e.target.value }
                      patchSeg(segIdx, { pairs: next })
                    }}
                  />
                  <Input
                    value={pair.right}
                    placeholder="яблоко"
                    className={INPUT_SURFACE_CLASS}
                    onChange={(e) => {
                      const next = [...rows]
                      next[idx] = { ...next[idx], right: e.target.value }
                      patchSeg(segIdx, { pairs: next })
                    }}
                  />
                  <EditorTooltip side="left" title="Удалить пару">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-ds-text-tertiary hover:text-red-400"
                      aria-label={`Удалить пару ${idx + 1}`}
                      onClick={() => patchSeg(segIdx, { pairs: rows.filter((_, rowIdx) => rowIdx !== idx) })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </EditorTooltip>
                </div>
              ))}
              {rows.every((row) => !row.left && !row.right) && <p className="text-xs text-muted-foreground">Добавьте пары слов</p>}
              <div className="flex justify-start pt-0.5">
                <EditorTooltip side="top" title="Новая пара">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={accentAddIconButtonClass("matching")}
                    aria-label="Добавить пару сопоставления"
                    onClick={() => patchSeg(segIdx, { pairs: [...rows, { left: "", right: "" }] })}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.25} />
                  </Button>
                </EditorTooltip>
              </div>
            </div>
          )
        })}
        {addAnotherRow}
        <TeacherHint type="matching" />
      </div>
    )
  }

  if (block.type === "fill_gaps") {
    const fillTheme = blockTypeStudentTheme.fill_gaps
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-black/[0.07] bg-background/40 p-3 text-xs text-[rgba(113,113,122,1)]">
          <p>
            1. Напишите текст целиком и выделяйте пропуски квадратными скобками: <code>[слово]</code>.
          </p>
          <p>2. При показе ученику слова из скобок автоматически попадут в банк и перемешаются.</p>
          <p>3. Правильным считается ответ, если слово поставлено в тот же пропуск, где вы его указали в тексте.</p>
        </div>
        {segments.map((segment, segIdx) => {
          const text = asString(segment.text)
          const extractedAnswers = extractBracketAnswers(text)
          return (
            <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
              {chrome(segIdx)}
              <Textarea
                value={text}
                onChange={(e) => {
                  const nextText = e.target.value
                  const autoAnswers = extractBracketAnswers(nextText)
                  patchSeg(segIdx, { text: nextText, answers: autoAnswers })
                }}
                placeholder="Напишите текст. Пропуски помечайте как [слово], например: I like [walking] in the park."
                className={cn(TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
              />
              {extractedAnswers.length > 0 ? (
                <div className={["flex flex-wrap gap-2 rounded-lg border border-dashed p-3 transition-colors", fillTheme.panel].join(" ")}>
                  {extractedAnswers.map((answer, idx) => (
                    <button
                      key={`${block.id}-s${segIdx}-ans-${idx}`}
                      type="button"
                      className={[
                        "lesson-cjk-text rounded-full px-3 py-1.5 font-medium transition-colors shadow-sm border",
                        fillTheme.active,
                        fillTheme.hover
                      ].join(" ")}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Добавьте хотя бы один пропуск в формате <code>[слово]</code>.
                </p>
              )}
            </div>
          )
        })}
        {addAnotherRow}
        <TeacherHint type="fill_gaps" />
      </div>
    )
  }

  if (block.type === "quiz_single") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => {
          const question = asString(segment.question)
          const options = asStringArray(segment.options)
          const correct = Number.isInteger(segment.correct) ? Number(segment.correct) : 0
          const optionRows = options.length > 0 ? options : ["", "", ""]
          return (
            <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
              {chrome(segIdx)}
              <Input
                value={question}
                placeholder="Введите вопрос"
                className={cn(INPUT_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
                onChange={(e) => patchSeg(segIdx, { question: e.target.value })}
              />
              {optionRows.map((option, idx) => (
                <div key={`${block.id}-s${segIdx}-opt-${idx}`} className="flex items-center gap-2">
                  <EditorTooltip side="top" title={correct === idx ? "Верный ответ" : "Сделать верным"}>
                    <button
                      type="button"
                      aria-label={`Отметить вариант ${idx + 1} как правильный`}
                      aria-pressed={correct === idx}
                      onClick={() => patchSeg(segIdx, { options: optionRows, correct: idx })}
                      className={cn(
                        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border-0 transition-colors",
                        correct === idx
                          ? cn(blockTypeAccentFillClass.quiz_single, "shadow-sm")
                          : cn(
                              "bg-white text-muted-foreground shadow-none dark:bg-white dark:text-muted-foreground",
                              "hover:bg-[var(--ds-surface-hover)] hover:text-foreground dark:hover:bg-[var(--ds-surface-hover)]"
                            )
                      )}
                    >
                      <Check className="size-3.5 stroke-[2.25] text-current" aria-hidden />
                    </button>
                  </EditorTooltip>
                  <Input
                    value={option}
                    placeholder={`Вариант ${idx + 1}`}
                    className={cn(INPUT_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
                    onChange={(e) => {
                      const next = [...optionRows]
                      next[idx] = e.target.value
                      patchSeg(segIdx, { options: next, correct: Math.min(correct, next.length - 1) })
                    }}
                  />
                  <EditorTooltip side="left" title={optionRows.length <= 2 ? "Нужно минимум 2 варианта" : "Удалить вариант"}>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-ds-text-tertiary hover:text-red-400"
                        aria-label={`Удалить вариант ${idx + 1}`}
                        onClick={() => {
                          if (optionRows.length <= 2) return
                          const next = optionRows.filter((_, optionIdx) => optionIdx !== idx)
                          const nextCorrect = correct >= next.length ? next.length - 1 : correct === idx ? 0 : correct
                          patchSeg(segIdx, { options: next, correct: Math.max(0, nextCorrect) })
                        }}
                        disabled={optionRows.length <= 2}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  </EditorTooltip>
                </div>
              ))}
              {!question && <p className="text-xs text-muted-foreground">Введите вопрос и варианты</p>}
              <div className="flex justify-start pt-0.5">
                <EditorTooltip side="top" title="Ещё вариант ответа">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={accentAddIconButtonClass("quiz_single")}
                    aria-label="Добавить вариант ответа"
                    onClick={() => patchSeg(segIdx, { options: [...optionRows, ""] })}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.25} />
                  </Button>
                </EditorTooltip>
              </div>
            </div>
          )
        })}
        {addAnotherRow}
        <TeacherHint type="quiz_single" />
      </div>
    )
  }

  if (block.type === "image") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => {
          const url = asString(segment.url)
          const alt = asString(segment.alt)
          const caption = asString(segment.caption)
          return (
            <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
              {chrome(segIdx)}
              <Input
                value={url}
                placeholder="https://… (ссылка на изображение)"
                className={INPUT_SURFACE_CLASS}
                onChange={(e) => patchSeg(segIdx, { url: e.target.value })}
              />
              <Input
                value={alt}
                placeholder="Краткое описание (для доступности)"
                className={INPUT_SURFACE_CLASS}
                onChange={(e) => patchSeg(segIdx, { alt: e.target.value })}
              />
              <Textarea
                value={caption}
                placeholder="Подпись под картинкой (необязательно)"
                className={cn(TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
                onChange={(e) => patchSeg(segIdx, { caption: e.target.value })}
              />
              {url.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element -- произвольный URL от преподавателя
                <img
                  src={url.trim()}
                  alt={alt || "Предпросмотр"}
                  className="max-h-56 w-auto max-w-full rounded-md border border-border object-contain"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Укажите прямую ссылку на файл изображения.</p>
              )}
            </div>
          )
        })}
        {addAnotherRow}
        <TeacherHint type="image" />
      </div>
    )
  }

  if (block.type === "video") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => {
          const url = asString(segment.url)
          const caption = asString(segment.caption)
          return (
            <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
              {chrome(segIdx)}
              <Input
                value={url}
                placeholder="YouTube, Vimeo или прямая ссылка на .mp4 / .webm"
                className={INPUT_SURFACE_CLASS}
                onChange={(e) => patchSeg(segIdx, { url: e.target.value })}
              />
              <Textarea
                value={caption}
                placeholder="Подпись к видео (необязательно)"
                className={cn(TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
                onChange={(e) => patchSeg(segIdx, { caption: e.target.value })}
              />
              {url.trim() ? (
                <InlineLessonVideo url={url.trim()} />
              ) : (
                <p className="text-xs text-muted-foreground">Для YouTube и Vimeo вставьте адрес страницы ролика.</p>
              )}
            </div>
          )
        })}
        {addAnotherRow}
        <TeacherHint type="video" />
      </div>
    )
  }

  if (block.type === "audio") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => (
          <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
            {chrome(segIdx)}
            <AudioBlockEditor segment={segment} onPatch={(patch) => patchSeg(segIdx, patch)} />
          </div>
        ))}
        {addAnotherRow}
        <TeacherHint type="audio" />
      </div>
    )
  }

  if (block.type === "note") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => (
          <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
            {chrome(segIdx)}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <NotebookText className="h-4 w-4" aria-hidden />
              Информационная заметка для ученика
            </div>
            <Input
              value={asString(segment.title)}
              placeholder="Заголовок заметки (например: Перед началом)"
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => patchSeg(segIdx, { title: e.target.value })}
            />
            <Textarea
              value={asString(segment.content)}
              placeholder="Текст заметки"
              className={cn("min-h-24", TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
              onChange={(e) => patchSeg(segIdx, { content: e.target.value })}
            />
          </div>
        ))}
        {addAnotherRow}
        <TeacherHint type="note" />
      </div>
    )
  }

  if (block.type === "link") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => (
          <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
            {chrome(segIdx)}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="h-4 w-4" aria-hidden />
              Внешний материал
            </div>
            <Input
              value={asString(segment.label)}
              placeholder="Текст кнопки (например: Открыть материал)"
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => patchSeg(segIdx, { label: e.target.value })}
            />
            <Input
              value={asString(segment.url)}
              placeholder="https://..."
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => patchSeg(segIdx, { url: e.target.value })}
            />
            <Textarea
              value={asString(segment.hint)}
              placeholder="Подсказка к ссылке (необязательно)"
              className={cn("min-h-20", TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
              onChange={(e) => patchSeg(segIdx, { hint: e.target.value })}
            />
          </div>
        ))}
        {addAnotherRow}
        <TeacherHint type="link" />
      </div>
    )
  }

  if (block.type === "divider") {
    return (
      <div className="space-y-4">
        {segments.map((segment, segIdx) => (
          <div key={`${block.id}-seg-${segIdx}`} className={SEGMENT_SHELL_CLASS}>
            {chrome(segIdx)}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Minus className="h-4 w-4" aria-hidden />
              Визуальный разделитель этапов урока
            </div>
            <Input
              value={asString(segment.label)}
              placeholder="Подпись разделителя (например: Практика)"
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => patchSeg(segIdx, { label: e.target.value })}
            />
          </div>
        ))}
        {addAnotherRow}
        <TeacherHint type="divider" />
      </div>
    )
  }

  const _never: never = block.type
  return _never
}

const LIVE_WAVE_BAR_COUNT = 40

function AudioBlockEditor({
  segment,
  onPatch
}: {
  segment: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const url = asString(segment.url)
  const transcript = asString(segment.transcript)
  const waveformPeaks = asNumberArray(segment.waveform_peaks)
  const audioTheme = blockTypeStudentTheme.audio
  const [isRecording, setIsRecording] = useState(false)
  const [liveBars, setLiveBars] = useState<number[] | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    blobUrlRef.current = url.startsWith("blob:") ? url : null
  }, [url])

  useEffect(() => {
    return () => {
      const last = blobUrlRef.current
      if (last?.startsWith("blob:")) URL.revokeObjectURL(last)
    }
  }, [])

  function stopAnalyserLoop() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    void audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
  }

  async function startRecording() {
    if (isRecording) return
    const previousUrl = asString(segment.url)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const bars: number[] = []
      const chunk = Math.max(1, Math.floor(data.length / LIVE_WAVE_BAR_COUNT))
      for (let i = 0; i < LIVE_WAVE_BAR_COUNT; i++) {
        let sum = 0
        for (let j = 0; j < chunk; j++) sum += data[i * chunk + j] ?? 0
        bars.push(Math.min(1, (sum / chunk / 255) * 2.2))
      }
      setLiveBars(bars)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      stopAnalyserLoop()
      setLiveBars(null)
      const blob = new Blob(chunksRef.current, { type: "audio/webm" })
      void (async () => {
        let peaks: number[] = []
        try {
          peaks = await computeWaveformPeaksFromBlob(blob, LIVE_WAVE_BAR_COUNT)
        } catch {
          peaks = []
        }
        const persistedAudioUrl = await blobToDataUrl(blob).catch(() => "")
        if (previousUrl.startsWith("blob:")) URL.revokeObjectURL(previousUrl)
        onPatch({ url: persistedAudioUrl, waveform_peaks: peaks })
        stream.getTracks().forEach((track) => track.stop())
        setIsRecording(false)
      })()
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return
    mediaRecorderRef.current.stop()
  }

  function clearAudioOnly() {
    const u = asString(segment.url)
    if (u.startsWith("blob:")) URL.revokeObjectURL(u)
    onPatch({ url: "", waveform_peaks: [] })
  }

  function applyDecodedPeaks(next: number[]) {
    onPatch({ waveform_peaks: next })
  }

  return (
    <div className="space-y-2">
      <Input
        value={url}
        placeholder="Ссылка на аудиофайл (https://…)"
        className={INPUT_SURFACE_CLASS}
        onChange={(e) => {
          const next = e.target.value
          const prev = asString(segment.url)
          if (prev.startsWith("blob:") && prev !== next) URL.revokeObjectURL(prev)
          onPatch({ url: next, waveform_peaks: [] })
        }}
      />
      {url.startsWith("blob:") ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Это временная локальная ссылка. Перезапишите голосовое или вставьте постоянную ссылку, иначе у ученика аудио может не открыться.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        <EditorTooltip title="Записать голосовое">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-ds-text-tertiary hover:text-foreground"
            aria-label="Записать голосовое"
            onClick={() => void startRecording()}
            disabled={isRecording}
          >
            <Mic className="h-5 w-5 shrink-0" aria-hidden />
          </Button>
        </EditorTooltip>
        <EditorTooltip title="Остановить запись">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "text-ds-text-tertiary hover:text-foreground",
              isRecording && "text-foreground"
            )}
            aria-label="Остановить запись"
            onClick={stopRecording}
            disabled={!isRecording}
          >
            <Square className="h-5 w-5 shrink-0" aria-hidden />
          </Button>
        </EditorTooltip>
        {url ? (
          <EditorTooltip title="Удалить аудио">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-ds-text-tertiary hover:text-red-400"
              aria-label="Удалить аудио"
              onClick={clearAudioOnly}
            >
              <X className="h-4 w-4" />
            </Button>
          </EditorTooltip>
        ) : null}
      </div>
      {url || isRecording || liveBars ? (
        <LessonAudioPlayerRow
          src={url}
          peaks={waveformPeaks.length > 0 ? waveformPeaks : null}
          liveBars={liveBars}
          isRecording={isRecording}
          barCount={LIVE_WAVE_BAR_COUNT}
          onDecodedPeaks={applyDecodedPeaks}
          seekable
          volumeControl
          containerClassName={audioTheme.panel}
          buttonClassName={`${audioTheme.active} ${audioTheme.hover}`}
          playedBarClassName="bg-[#7f3c4f] dark:bg-[#ffd9e4]"
          idleBarClassName="bg-muted-foreground/25 dark:bg-muted-foreground/30"
          liveActiveBarClassName="bg-[#7f3c4f]/90 dark:bg-[#ffd9e4]/90"
          liveIdleBarClassName="bg-muted-foreground/35 dark:bg-muted-foreground/40"
          timeClassName={audioTheme.text}
        />
      ) : null}
      <Textarea
        value={transcript}
        placeholder="Транскрипт (подпись к записи)"
        className={cn(TEXTAREA_SURFACE_CLASS, LESSON_CJK_TEXT_CLASS)}
        onChange={(e) => onPatch({ transcript: e.target.value })}
      />
      {!url && !isRecording ? (
        <p className="text-xs text-muted-foreground">
          Вставьте ссылку или запишите голосовое — волна отобразится при записи и после сохранения.
        </p>
      ) : null}
    </div>
  )
}
