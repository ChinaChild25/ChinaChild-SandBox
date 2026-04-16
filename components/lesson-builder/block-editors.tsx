"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Check, CircleHelp, Mic, Plus, Square, Trash2, X } from "lucide-react"
import type { LessonBlockType, TeacherLessonBlock } from "@/lib/types"
import { computeWaveformPeaksFromBlob } from "@/lib/audio-waveform"
import { InlineLessonVideo } from "@/components/lesson-builder/inline-lesson-video"
import { LessonAudioPlayerRow } from "@/components/lesson-builder/lesson-audio-waveform"
import { blockTypeStudentTheme } from "@/components/lesson-builder/block-theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type MatchingPair = { left: string; right: string }
type TrueFalseQuestion = { prompt: string; answer: boolean }

const BLOCK_TITLES: Record<LessonBlockType, string> = {
  text: "Текст",
  matching: "Сопоставление",
  fill_gaps: "Пропуски в тексте",
  quiz_single: "Тест",
  image: "Картинка",
  video: "Видео",
  audio: "Аудио"
}

const ACTION_BUTTON_CLASS =
  "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
/** Кнопки «+»: заметный тёмный плюс на ghost-подложке */
const ICON_ADD_BUTTON_CLASS =
  "shrink-0 text-zinc-800 hover:bg-black/[0.07] hover:text-zinc-950 dark:text-zinc-100 dark:hover:bg-white/12 dark:hover:text-white"
/** Однострочные поля — высота как у полей в сетках блоков (48px). */
const INPUT_SURFACE_CLASS = "h-12 min-h-12 bg-background/90 border-border/70 dark:bg-input/45"
const TEXTAREA_SURFACE_CLASS = "bg-background/90 border-border/70 dark:bg-input/45"
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
  ]
}

function blockTitle(type: LessonBlockType): string {
  return BLOCK_TITLES[type]
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
      <TooltipContent side={side} sideOffset={6} className="max-w-[16rem] px-2.5 py-1.5 text-left text-xs font-normal">
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

export function createDefaultBlockData(type: LessonBlockType): Record<string, unknown> {
  switch (type) {
    case "text":
      return { content: "", questions: [] }
    case "matching":
      return { pairs: [{ left: "", right: "" }] }
    case "fill_gaps":
      return { text: "[]", answers: [""] }
    case "quiz_single":
      return { question: "", options: ["", "", ""], correct: 0 }
    case "image":
      return { url: "", alt: "", caption: "" }
    case "video":
      return { url: "", caption: "" }
    case "audio":
      return { url: "", transcript: "" }
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
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
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-lg border border-border bg-transparent p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{blockTitle(block.type)}</p>
            <div className="flex items-center gap-1">
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

function BlockEditorByType({
  block,
  onChange
}: {
  block: TeacherLessonBlock
  onChange: (id: string, data: Record<string, unknown>) => void
}) {
  if (block.type === "text") {
    const content = asString(block.data.content)
    const questions = asTrueFalseQuestions(block.data.questions)
    return (
      <div className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => onChange(block.id, { ...block.data, content: e.target.value })}
          placeholder="Введите текст для блока"
          className={`min-h-28 ${TEXTAREA_SURFACE_CLASS}`}
        />
        <div className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-3">
          <div>
            <p className="text-sm font-medium">Вопросы правда / ложь</p>
            <p className="text-xs text-muted-foreground">Необязательно. Добавьте вопросы, если хотите проверить понимание текста.</p>
          </div>

          {questions.length > 0 ? (
            <div className="space-y-2">
              {questions.map((question, idx) => (
                <div key={`${block.id}-tf-question-${idx}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem_auto]">
                  <Input
                    value={question.prompt}
                    placeholder={`Утверждение ${idx + 1}`}
                    className={INPUT_SURFACE_CLASS}
                    onChange={(e) => {
                      const next = [...questions]
                      next[idx] = { ...next[idx], prompt: e.target.value }
                      onChange(block.id, { ...block.data, questions: next })
                    }}
                  />
                  <Select
                    value={question.answer ? "true" : "false"}
                    onValueChange={(value) => {
                      const next = [...questions]
                      next[idx] = { ...next[idx], answer: value === "true" }
                      onChange(block.id, { ...block.data, questions: next })
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SelectTrigger className={`${INPUT_SURFACE_CLASS} w-full`}>
                          <SelectValue placeholder="Выберите ответ" />
                        </SelectTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6} className="max-w-[14rem] px-2.5 py-1.5 text-left text-xs leading-snug">
                        <p>Верный ответ при проверке.</p>
                      </TooltipContent>
                    </Tooltip>
                    <SelectContent>
                      <SelectItem value="true">Правда</SelectItem>
                      <SelectItem value="false">Ложь</SelectItem>
                    </SelectContent>
                  </Select>
                  <EditorTooltip side="left" title="Удалить вопрос">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-ds-text-tertiary hover:text-red-400"
                      aria-label={`Удалить вопрос ${idx + 1}`}
                      onClick={() => onChange(block.id, { ...block.data, questions: questions.filter((_, qIdx) => qIdx !== idx) })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </EditorTooltip>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Вопросов нет. Блок будет просто информативным.</p>
          )}

          <div className="flex justify-start pt-1">
            <EditorTooltip side="top" title="Ещё вопрос правда/ложь">
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className={ICON_ADD_BUTTON_CLASS}
                aria-label="Добавить вопрос правда или ложь"
                onClick={() =>
                  onChange(block.id, {
                    ...block.data,
                    questions: [...questions, { prompt: "", answer: true }]
                  })
                }
              >
                <Plus className="size-6 stroke-[2.25]" />
              </Button>
            </EditorTooltip>
          </div>
        </div>
        {!content && <p className="text-xs text-muted-foreground">Добавьте текст для ученика</p>}
        <TeacherHint type="text" />
      </div>
    )
  }

  if (block.type === "matching") {
    const pairs = asPairs(block.data.pairs)
    const rows = pairs.length > 0 ? pairs : [{ left: "", right: "" }]
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
          <span>Слева</span>
          <span>Справа</span>
          <span />
        </div>
        {rows.map((pair, idx) => (
          <div key={`${block.id}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              value={pair.left}
              placeholder="apple / 苹果"
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...next[idx], left: e.target.value }
                onChange(block.id, { ...block.data, pairs: next })
              }}
            />
            <Input
              value={pair.right}
              placeholder="яблоко"
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...next[idx], right: e.target.value }
                onChange(block.id, { ...block.data, pairs: next })
              }}
            />
            <EditorTooltip side="left" title="Удалить пару">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-ds-text-tertiary hover:text-red-400"
                aria-label={`Удалить пару ${idx + 1}`}
                onClick={() => onChange(block.id, { ...block.data, pairs: rows.filter((_, rowIdx) => rowIdx !== idx) })}
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
              variant="ghost"
              size="icon-lg"
              className={ICON_ADD_BUTTON_CLASS}
              aria-label="Добавить пару сопоставления"
              onClick={() => onChange(block.id, { ...block.data, pairs: [...rows, { left: "", right: "" }] })}
            >
              <Plus className="size-6 stroke-[2.25]" />
            </Button>
          </EditorTooltip>
        </div>
        <TeacherHint type="matching" />
      </div>
    )
  }

  if (block.type === "fill_gaps") {
    const text = asString(block.data.text)
    const extractedAnswers = extractBracketAnswers(text)
    const fillTheme = blockTypeStudentTheme.fill_gaps
    return (
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => {
            const nextText = e.target.value
            const autoAnswers = extractBracketAnswers(nextText)
            onChange(block.id, { ...block.data, text: nextText, answers: autoAnswers })
          }}
          placeholder="Напишите текст. Пропуски помечайте как [слово], например: I like [walking] in the park."
          className={TEXTAREA_SURFACE_CLASS}
        />
        <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
          <p>1. Напишите текст целиком и выделяйте пропуски квадратными скобками: <code>[слово]</code>.</p>
          <p>2. При показе ученику слова из скобок автоматически попадут в банк и перемешаются.</p>
          <p>3. Правильным считается ответ, если слово поставлено в тот же пропуск, где вы его указали в тексте.</p>
        </div>
        {extractedAnswers.length > 0 ? (
          <div className={["flex flex-wrap gap-2 rounded-lg border border-dashed p-3 transition-colors", fillTheme.panel].join(" ")}>
            {extractedAnswers.map((answer, idx) => (
              <button
                key={`${block.id}-auto-answer-${idx}`}
                type="button"
                className={["rounded-full px-3 py-1.5 text-sm font-medium transition-colors shadow-sm border", fillTheme.active, fillTheme.hover].join(" ")}
              >
                {answer}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Добавьте хотя бы один пропуск в формате <code>[слово]</code>.</p>
        )}
        <TeacherHint type="fill_gaps" />
      </div>
    )
  }

  if (block.type === "quiz_single") {
    const question = asString(block.data.question)
    const options = asStringArray(block.data.options)
    const correct = Number.isInteger(block.data.correct) ? Number(block.data.correct) : 0
    const optionRows = options.length > 0 ? options : ["", "", ""]
    const correctMarkTheme = blockTypeStudentTheme.matching
    return (
      <div className="space-y-2">
        <Input
          value={question}
          placeholder="Введите вопрос"
          className={INPUT_SURFACE_CLASS}
          onChange={(e) => onChange(block.id, { ...block.data, question: e.target.value })}
        />
        {optionRows.map((option, idx) => (
          <div key={`${block.id}-option-${idx}`} className="flex items-center gap-2">
            <EditorTooltip side="top" title={correct === idx ? "Верный ответ" : "Сделать верным"}>
              <button
                type="button"
                aria-label={`Отметить вариант ${idx + 1} как правильный`}
                aria-pressed={correct === idx}
                onClick={() => onChange(block.id, { ...block.data, options: optionRows, correct: idx })}
                className={[
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  correct === idx
                    ? [correctMarkTheme.active, correctMarkTheme.hover, "shadow-sm"].join(" ")
                    : "border-zinc-200/90 bg-zinc-50 text-zinc-400 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/55 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                ].join(" ")}
              >
                <Check className="size-2.5 stroke-[2.5] text-current" aria-hidden />
              </button>
            </EditorTooltip>
            <Input
              value={option}
              placeholder={`Вариант ${idx + 1}`}
              className={INPUT_SURFACE_CLASS}
              onChange={(e) => {
                const next = [...optionRows]
                next[idx] = e.target.value
                onChange(block.id, { ...block.data, options: next, correct: Math.min(correct, next.length - 1) })
              }}
            />
            <EditorTooltip
              side="left"
              title={optionRows.length <= 2 ? "Нужно минимум 2 варианта" : "Удалить вариант"}
            >
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
                    onChange(block.id, { ...block.data, options: next, correct: Math.max(0, nextCorrect) })
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
              variant="ghost"
              size="icon-lg"
              className={ICON_ADD_BUTTON_CLASS}
              aria-label="Добавить вариант ответа"
              onClick={() => onChange(block.id, { ...block.data, options: [...optionRows, ""] })}
            >
              <Plus className="size-6 stroke-[2.25]" />
            </Button>
          </EditorTooltip>
        </div>
        <TeacherHint type="quiz_single" />
      </div>
    )
  }

  if (block.type === "image") {
    const url = asString(block.data.url)
    const alt = asString(block.data.alt)
    const caption = asString(block.data.caption)
    return (
      <div className="space-y-2">
        <Input
          value={url}
          placeholder="https://… (ссылка на изображение)"
          className={INPUT_SURFACE_CLASS}
          onChange={(e) => onChange(block.id, { ...block.data, url: e.target.value })}
        />
        <Input
          value={alt}
          placeholder="Краткое описание (для доступности)"
          className={INPUT_SURFACE_CLASS}
          onChange={(e) => onChange(block.id, { ...block.data, alt: e.target.value })}
        />
        <Textarea
          value={caption}
          placeholder="Подпись под картинкой (необязательно)"
          className={TEXTAREA_SURFACE_CLASS}
          onChange={(e) => onChange(block.id, { ...block.data, caption: e.target.value })}
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
        <TeacherHint type="image" />
      </div>
    )
  }

  if (block.type === "video") {
    const url = asString(block.data.url)
    const caption = asString(block.data.caption)
    return (
      <div className="space-y-2">
        <Input
          value={url}
          placeholder="YouTube, Vimeo или прямая ссылка на .mp4 / .webm"
          className={INPUT_SURFACE_CLASS}
          onChange={(e) => onChange(block.id, { ...block.data, url: e.target.value })}
        />
        <Textarea
          value={caption}
          placeholder="Подпись к видео (необязательно)"
          className={TEXTAREA_SURFACE_CLASS}
          onChange={(e) => onChange(block.id, { ...block.data, caption: e.target.value })}
        />
        {url.trim() ? (
          <InlineLessonVideo url={url.trim()} />
        ) : (
          <p className="text-xs text-muted-foreground">Для YouTube и Vimeo вставьте адрес страницы ролика.</p>
        )}
        <TeacherHint type="video" />
      </div>
    )
  }

  if (block.type === "audio") {
    return <AudioBlockEditor block={block} onChange={onChange} />
  }

  const _never: never = block.type
  return _never
}

const LIVE_WAVE_BAR_COUNT = 40

function AudioBlockEditor({
  block,
  onChange
}: {
  block: TeacherLessonBlock
  onChange: (id: string, data: Record<string, unknown>) => void
}) {
  const url = asString(block.data.url)
  const transcript = asString(block.data.transcript)
  const waveformPeaks = asNumberArray(block.data.waveform_peaks)
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
    const previousUrl = asString(block.data.url)
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
        onChange(block.id, { ...block.data, url: persistedAudioUrl, waveform_peaks: peaks })
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
    const u = asString(block.data.url)
    if (u.startsWith("blob:")) URL.revokeObjectURL(u)
    onChange(block.id, { ...block.data, url: "", waveform_peaks: [] })
  }

  function applyDecodedPeaks(next: number[]) {
    onChange(block.id, { ...block.data, waveform_peaks: next })
  }

  return (
    <div className="space-y-2">
      <Input
        value={url}
        placeholder="Ссылка на аудиофайл (https://…)"
        className={INPUT_SURFACE_CLASS}
        onChange={(e) => {
          const next = e.target.value
          const prev = asString(block.data.url)
          if (prev.startsWith("blob:") && prev !== next) URL.revokeObjectURL(prev)
          onChange(block.id, { ...block.data, url: next, waveform_peaks: [] })
        }}
      />
      {url.startsWith("blob:") ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Это временная локальная ссылка. Перезапишите голосовое или вставьте постоянную ссылку, иначе у ученика аудио может не открыться.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <EditorTooltip title="Запись с микрофона">
          <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} onClick={() => void startRecording()} disabled={isRecording}>
            <Mic className="mr-1 h-4 w-4" />
            Записать голосовое
          </Button>
        </EditorTooltip>
        <EditorTooltip title="Завершить запись">
          <span className="inline-flex">
            <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} onClick={stopRecording} disabled={!isRecording}>
              <Square className="mr-1 h-4 w-4" />
              Остановить
            </Button>
          </span>
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
          containerClassName={audioTheme.panel}
          buttonClassName={`border shadow-sm ${audioTheme.active} ${audioTheme.hover}`}
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
        className={TEXTAREA_SURFACE_CLASS}
        onChange={(e) => onChange(block.id, { ...block.data, transcript: e.target.value })}
      />
      {!url && !isRecording ? (
        <p className="text-xs text-muted-foreground">Вставьте ссылку или запишите голосовое — волна отобразится при записи и после сохранения.</p>
      ) : null}
      <TeacherHint type="audio" />
    </div>
  )
}
