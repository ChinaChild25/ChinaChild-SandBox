"use client"

import { type ReactNode, useEffect, useState } from "react"
import {
  BookOpen,
  Bookmark,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  GraduationCap,
  Grid2x2,
  Languages,
  LineChart,
  Mic,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react"
import type { LessonFeedItem, SkillMap } from "@/lib/lesson-analytics/server"
import { placeholderImages } from "@/lib/placeholders"
import { cn } from "@/lib/utils"
import { SkillRadarChart } from "@/components/progress/skill-radar-chart"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

type LessonFeedProps = {
  sessions: LessonFeedItem[]
  current: SkillMap
  previous?: SkillMap | null
}

type InsightTab = "overview" | "recap" | "progress" | "feedback" | "vocabulary" | "practice"

type VocabularyItem = {
  id: string
  phrase: string
  hskLevel: number | null
  note: string
  sourceLabel: string
}

type PracticeItem = {
  id: string
  title: string
  description: string
  bullets: string[]
}

type LessonMetrics = {
  masteryScore: number | null
  masteryDelta: number | null
  speakingRatioValue: number | null
  speechLevel: string
  speechLevelHint: string
  vocabularySize: number
  vocabularyDelta: number | null
  speechSpeed: number | null
  speechSpeedDelta: number | null
  studentMinutes: number | null
  teacherMinutes: number | null
  sentenceLength: number | null
  sentenceLengthDelta: number | null
}

type ProgressMetricKey =
  | "MasteryScore"
  | "SpeakingLevel"
  | "VocabularySize"
  | "SpeakingSpeed"
  | "SpeakingTime"
  | "SentenceLength"

type MetricHistoryPoint = {
  sessionId: string
  shortDate: string
  fullDate: string
  masteryScore: number | null
  speechLevelScore: number | null
  vocabularySize: number
  speechSpeed: number | null
  studentMinutes: number | null
  teacherMinutes: number | null
  sentenceLength: number | null
}

type ProgressTooltipEntry = {
  dataKey?: string | number
  name?: string | number
  value?: number | string | null
  color?: string
  payload?: MetricHistoryPoint
}

const SKILL_AXES = {
  speaking: ["speaking", "pronunciation", "tones", "fluency"],
  phrases: ["phrases", "chengyu", "expressions", "patterns"],
  vocabulary: ["vocabulary", "words", "characters", "hanzi"],
  listening: ["listening", "comprehension"],
  grammar: ["grammar", "particles", "measure_words", "ba_sentence"],
  reading: ["reading", "pinyin"],
} as const

const SKILL_LABELS: Array<{ key: keyof SkillMap; label: string }> = [
  { key: "speaking", label: "Говорение" },
  { key: "phrases", label: "Фразы" },
  { key: "vocabulary", label: "Лексика" },
  { key: "listening", label: "Аудирование" },
  { key: "grammar", label: "Грамматика" },
  { key: "reading", label: "Чтение" },
]

const INSIGHT_TABS: Array<{
  value: InsightTab
  label: string
  icon?: typeof Grid2x2
  iconOnly?: boolean
}> = [
  { value: "overview", label: "Обзор", icon: Grid2x2, iconOnly: true },
  { value: "recap", label: "Итог" },
  { value: "progress", label: "Прогресс" },
  { value: "feedback", label: "Разбор" },
  { value: "vocabulary", label: "Лексика" },
  { value: "practice", label: "Практика" },
]

function analyticsReady(session: LessonFeedItem): boolean {
  return (
    Boolean(session.summary?.trim()) ||
    session.mistakes.length > 0 ||
    session.strengths.length > 0 ||
    session.recommendations.length > 0 ||
    session.topicsPracticed.length > 0 ||
    session.averageScore !== null
  )
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function hasSkillMapData(skillMap: SkillMap): boolean {
  return Object.values(skillMap).some((value) => value > 0)
}

function normalizeTopicKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

function resolveSkillAxes(topic: string): Array<keyof SkillMap> {
  const normalizedTopic = normalizeTopicKey(topic)
  if (!normalizedTopic) return []

  return (Object.entries(SKILL_AXES) as Array<[keyof SkillMap, readonly string[]]>)
    .filter(([axis, aliases]) =>
      [axis, ...aliases].some((alias) => {
        const normalizedAlias = normalizeTopicKey(alias)
        return (
          normalizedTopic === normalizedAlias ||
          normalizedTopic.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedTopic)
        )
      })
    )
    .map(([axis]) => axis)
}

function buildSkillMapFromSession(session: LessonFeedItem): SkillMap {
  const grammar = clampInt(Number(session.grammarScore), 0, 100)
  const vocabulary = clampInt(Number(session.vocabularyScore), 0, 100)
  const fluency = clampInt(Number(session.fluencyScore), 0, 100)
  const speakingRatioScore = clampInt(clampRatio(Number(session.speakingRatio)) * 100, 0, 100)
  const overall = clampInt((grammar + vocabulary + fluency) / 3, 0, 100)
  const baseline = overall > 0 ? clampInt(overall * 0.45, 12, 100) : 0

  const skillMap: SkillMap = {
    speaking: Math.max(baseline, clampInt(fluency * 0.7 + speakingRatioScore * 0.3, 0, 100)),
    phrases: baseline,
    vocabulary: Math.max(baseline, vocabulary),
    listening: Math.max(baseline, clampInt(overall * 0.7 + speakingRatioScore * 0.3, 0, 100)),
    grammar: Math.max(baseline, grammar),
    reading: Math.max(baseline, clampInt((grammar + vocabulary) / 2, 0, 100)),
  }

  for (const topic of session.topicsPracticed) {
    for (const axis of resolveSkillAxes(topic)) {
      const emphasizedScore =
        axis === "speaking"
          ? clampInt((skillMap.speaking + fluency + overall) / 3, 0, 100)
          : axis === "grammar"
            ? Math.max(grammar, overall)
            : axis === "vocabulary"
              ? Math.max(vocabulary, overall)
              : axis === "listening"
                ? clampInt((skillMap.listening + overall) / 2, 0, 100)
                : axis === "reading"
                  ? clampInt((skillMap.reading + vocabulary) / 2, 0, 100)
                  : clampInt((vocabulary + overall) / 2, 0, 100)

      skillMap[axis] = Math.max(skillMap[axis], emphasizedScore)
    }
  }

  return skillMap
}

function formatSessionDateTime(value: string | null): string {
  if (!value) return "Дата уточняется"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Дата уточняется"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatSessionMeta(session: LessonFeedItem): string {
  const parts = ["Китайский"]
  if (session.teacherName) parts.push(session.teacherName)
  parts.push(formatSessionDateTime(session.endedAt ?? session.startedAt))
  return parts.join(" · ")
}

function formatHistoryShortDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(date)
}

function formatHistoryFullDate(value: string | null): string {
  if (!value) return "Дата уточняется"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Дата уточняется"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

function parseProgressMetricKey(value: string | null | undefined): ProgressMetricKey | null {
  if (
    value === "MasteryScore" ||
    value === "SpeakingLevel" ||
    value === "VocabularySize" ||
    value === "SpeakingSpeed" ||
    value === "SpeakingTime" ||
    value === "SentenceLength"
  ) {
    return value
  }

  return null
}

function buildMetricHistory(sessions: LessonFeedItem[]): MetricHistoryPoint[] {
  const vocabularySet = new Set<string>()

  return sessions.map((session) => {
    const vocabularyItems = buildVocabularyItems(session)
    const metrics = buildLessonMetrics(session, null, vocabularyItems)
    const transcriptTerms = session.transcript
      .filter((segment) => segment.speakerRole === "student")
      .flatMap((segment) => extractTerms(segment.text))
      .filter(Boolean)

    const vocabularyTerms = vocabularyItems.flatMap((item) => extractTerms(item.phrase)).filter(Boolean)
    const lessonTerms = new Set([...transcriptTerms, ...vocabularyTerms])

    for (const term of lessonTerms) {
      vocabularySet.add(term)
    }

    return {
      sessionId: session.sessionId,
      shortDate: formatHistoryShortDate(session.endedAt ?? session.startedAt),
      fullDate: formatHistoryFullDate(session.endedAt ?? session.startedAt),
      masteryScore: metrics.masteryScore,
      speechLevelScore: session.averageScore,
      vocabularySize: vocabularySet.size,
      speechSpeed: metrics.speechSpeed,
      studentMinutes: metrics.studentMinutes,
      teacherMinutes: metrics.teacherMinutes,
      sentenceLength: metrics.sentenceLength,
    }
  })
}

function resolveLevelScale(score: number | null): {
  code: string
  label: string
  bandIndex: number
  stepIndex: number
  rangeStart: number
  rangeEnd: number
} {
  const normalized = clampInt(score ?? 0, 0, 100)
  const bandIndex = Math.min(5, Math.floor(normalized / 17))
  const stepIndex = Math.min(3, Math.floor((normalized % 17) / 4.25))
  const rangeStart = bandIndex * 4 + 1
  const rangeEnd = Math.min(rangeStart + 1, 24)

  const labels = [
    "старт речи",
    "базовая опора",
    "разговорная база",
    "устойчивая речь",
    "уверенный разговор",
    "сильная самостоятельность",
  ]

  return {
    code: `HSK ${bandIndex + 1}.${stepIndex + 1}`,
    label: labels[bandIndex] ?? "рост уровня",
    bandIndex,
    stepIndex,
    rangeStart,
    rangeEnd,
  }
}

function formatSpeakingRatio(value: number | null): string {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}

function formatRuNumber(value: number, maximumFractionDigits = 1): string {
  const needsFraction = Math.abs(value % 1) > 0.001

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: needsFraction ? 1 : 0,
    maximumFractionDigits,
  }).format(value)
}

function formatMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${formatRuNumber(value)} мин`
}

function formatMinutesTick(value: number): string {
  return `${formatRuNumber(value)} мин`
}

function formatPlainMetricValue(dataKey: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"

  if (typeof value !== "number") {
    return String(value)
  }

  switch (dataKey) {
    case "masteryScore":
      return `${Math.round(value)}%`
    case "vocabularySize":
      return value.toLocaleString("ru-RU")
    case "speechSpeed":
      return `${Math.round(value)} сл/мин`
    case "studentMinutes":
    case "teacherMinutes":
      return formatMinutes(value)
    case "sentenceLength":
      return `${Math.round(value)} ${pluralizeRu(Math.round(value), ["слово", "слова", "слов"])}`
    default:
      return formatRuNumber(value)
  }
}

function metricSeriesLabel(dataKey: string): string {
  switch (dataKey) {
    case "masteryScore":
      return "Индекс освоения"
    case "vocabularySize":
      return "Размер словаря"
    case "speechSpeed":
      return "Темп речи"
    case "studentMinutes":
      return "Речь ученика"
    case "teacherMinutes":
      return "Речь преподавателя"
    case "sentenceLength":
      return "Длина реплики"
    default:
      return dataKey
  }
}

function ProgressChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ProgressTooltipEntry[]
}) {
  if (!active || !payload?.length) return null

  const validPayload = payload.filter((entry) => entry.value !== null && entry.value !== undefined)
  if (!validPayload.length) return null

  const dateLabel = validPayload[0]?.payload?.fullDate ?? "Дата уточняется"

  return (
    <div className="min-w-[180px] rounded-[18px] border border-black/[0.08] bg-[var(--ds-surface)] px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
      <p className="text-[13px] font-medium text-ds-text-tertiary">{dateLabel}</p>
      <div className="mt-3 space-y-2">
        {validPayload.map((entry) => {
          const dataKey = String(entry.dataKey ?? entry.name ?? "")
          return (
            <div key={dataKey} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color ?? "var(--progress-accent-strong)" }}
                />
                <span className="truncate text-[13px] text-ds-text-secondary">{metricSeriesLabel(dataKey)}</span>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-ds-ink">
                {formatPlainMetricValue(dataKey, entry.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function initials(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? "").trim()
  if (!cleaned) return fallback
  return cleaned
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
}

function pluralizeRu(value: number, [one, few, many]: [string, string, string]): string {
  const abs = Math.abs(value) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

function formatDelta(value: number | null, suffix = ""): string {
  if (value === null) return "новый"
  if (value > 0) return `+${formatRuNumber(value)}${suffix}`
  if (value < 0) return `${formatRuNumber(value)}${suffix}`
  return `0${suffix}`
}

function extractTerms(text: string): string[] {
  return text.toLowerCase().match(/[\u3400-\u9fff]+|[a-zа-яё0-9]+/giu) ?? []
}

function countTerms(text: string): number {
  return extractTerms(text).length
}

function estimateSessionDurationMinutes(session: LessonFeedItem): number | null {
  const started = session.startedAt ? new Date(session.startedAt).getTime() : Number.NaN
  const ended = session.endedAt ? new Date(session.endedAt).getTime() : Number.NaN

  if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) {
    return Math.max((ended - started) / 60_000, 1)
  }

  const transcriptSeconds = session.transcript.reduce((maxValue, segment) => {
    const candidate = segment.endedAtSec ?? segment.startedAtSec ?? 0
    return Math.max(maxValue, candidate)
  }, 0)

  return transcriptSeconds > 0 ? Math.max(transcriptSeconds / 60, 1) : null
}

function estimateSpeakerMinutes(session: LessonFeedItem, role: "student" | "teacher"): number | null {
  const segments = session.transcript.filter((segment) => segment.speakerRole === role)
  const explicitSeconds = segments.reduce((total, segment) => {
    if (segment.startedAtSec === null || segment.endedAtSec === null) return total
    if (segment.endedAtSec <= segment.startedAtSec) return total
    return total + (segment.endedAtSec - segment.startedAtSec)
  }, 0)

  if (explicitSeconds > 0) return explicitSeconds / 60

  const sessionDuration = estimateSessionDurationMinutes(session)
  if (sessionDuration === null) return null
  if (session.speakingRatio === null) return role === "teacher" ? sessionDuration / 2 : sessionDuration / 2

  const ratio = clampRatio(session.speakingRatio)
  return role === "student" ? sessionDuration * ratio : sessionDuration * (1 - ratio)
}

function resolveSpeechLevel(score: number | null): { value: string; hint: string } {
  if (score === null) {
    return { value: "—", hint: "Недостаточно данных для уровня речи" }
  }

  if (score >= 85) return { value: "HSK 4+", hint: "Речь звучит уверенно и свободнее обычного" }
  if (score >= 72) return { value: "HSK 3", hint: "Речь уже уверенная, но ещё растёт в точности" }
  if (score >= 58) return { value: "HSK 2", hint: "База сформирована, нужен следующий словарный рывок" }
  return { value: "HSK 1", hint: "Фундамент строится, важно закреплять шаблоны" }
}

function buildVocabularyItems(session: LessonFeedItem): VocabularyItem[] {
  const items: VocabularyItem[] = []
  const seen = new Set<string>()

  for (const mistake of session.mistakes) {
    const phrase = mistake.correction.trim()
    const id = `mistake:${phrase.toLowerCase()}`
    if (!phrase || seen.has(id)) continue
    seen.add(id)
    items.push({
      id,
      phrase,
      hskLevel: mistake.hsk_level,
      note: mistake.explanation,
      sourceLabel: `Исправление: ${mistake.original}`,
    })
  }

  for (const topic of session.topicsPracticed) {
    const phrase = topic.trim()
    const id = `topic:${phrase.toLowerCase()}`
    if (!phrase || seen.has(id)) continue
    seen.add(id)
    items.push({
      id,
      phrase,
      hskLevel: null,
      note: "Тема или паттерн, который действительно появился в этом уроке.",
      sourceLabel: "Тема урока",
    })
  }

  return items.slice(0, 14)
}

function buildPracticeItems(session: LessonFeedItem): PracticeItem[] {
  const items: PracticeItem[] = []

  session.recommendations.forEach((recommendation, index) => {
    items.push({
      id: `recommendation-${index}`,
      title: recommendation,
      description: "Это главный следующий фокус после текущего урока.",
      bullets: session.topicsPracticed.slice(0, 2).map((topic) => `Сделайте 2-3 фразы на тему «${topic}».`),
    })
  })

  session.mistakes.slice(0, 3).forEach((mistake, index) => {
    items.push({
      id: `mistake-${index}`,
      title: `Повторите: ${mistake.correction}`,
      description: `Раньше здесь звучало: ${mistake.original}`,
      bullets: [mistake.explanation, "Скажите новую фразу с тем же паттерном ещё 3 раза."],
    })
  })

  return items.slice(0, 6)
}

function buildTopicList(session: LessonFeedItem): string[] {
  if (session.topicsPracticed.length > 0) return session.topicsPracticed.slice(0, 6)

  const topics = new Set<string>()
  if (session.mistakes.some((item) => item.type === "grammar")) topics.add("Грамматические конструкции")
  if (session.mistakes.some((item) => item.type === "vocabulary")) topics.add("Расширение словаря")
  if (session.mistakes.some((item) => item.type === "tones" || item.type === "pronunciation")) {
    topics.add("Произношение и тоны")
  }
  if (session.transcript.length > 0) topics.add("Живой диалог по теме урока")

  return [...topics].slice(0, 6)
}

function splitFeedback(session: LessonFeedItem): {
  strengths: string[]
  mistakes: LessonFeedItem["mistakes"]
} {
  return {
    strengths: session.strengths.slice(0, 6),
    mistakes: session.mistakes.slice(0, 6),
  }
}

function transcriptPreview(session: LessonFeedItem): LessonFeedItem["transcript"] {
  return session.transcript.filter((segment) => segment.text.trim()).slice(0, 8)
}

function buildLessonMetrics(
  session: LessonFeedItem,
  previousSession: LessonFeedItem | null,
  vocabularyItems: VocabularyItem[]
): LessonMetrics {
  const previousVocabularyItems = previousSession ? buildVocabularyItems(previousSession) : []
  const studentSegments = session.transcript.filter((segment) => segment.speakerRole === "student")
  const studentTerms = studentSegments.reduce((total, segment) => total + countTerms(segment.text), 0)
  const studentMinutes = estimateSpeakerMinutes(session, "student")
  const teacherMinutes = estimateSpeakerMinutes(session, "teacher")
  const sentenceLength = studentSegments.length > 0 ? clampInt(studentTerms / studentSegments.length, 1, 999) : null
  const speechSpeed =
    studentMinutes && studentMinutes > 0 ? clampInt(studentTerms / studentMinutes, 0, 999) : null

  const previousStudentSegments = previousSession
    ? previousSession.transcript.filter((segment) => segment.speakerRole === "student")
    : []
  const previousStudentTerms = previousStudentSegments.reduce((total, segment) => total + countTerms(segment.text), 0)
  const previousStudentMinutes = previousSession ? estimateSpeakerMinutes(previousSession, "student") : null
  const previousSentenceLength =
    previousStudentSegments.length > 0 ? clampInt(previousStudentTerms / previousStudentSegments.length, 1, 999) : null
  const previousSpeechSpeed =
    previousStudentMinutes && previousStudentMinutes > 0
      ? clampInt(previousStudentTerms / previousStudentMinutes, 0, 999)
      : null

  const speechLevel = resolveSpeechLevel(session.averageScore)
  const previousAverage = previousSession?.averageScore ?? null

  const transcriptVocabulary = new Set(
    session.transcript
      .filter((segment) => segment.speakerRole === "student")
      .flatMap((segment) => extractTerms(segment.text))
      .filter(Boolean)
  )

  const previousTranscriptVocabulary = new Set(
    (previousSession?.transcript ?? [])
      .filter((segment) => segment.speakerRole === "student")
      .flatMap((segment) => extractTerms(segment.text))
      .filter(Boolean)
  )

  const vocabularySize = vocabularyItems.length > 0 ? vocabularyItems.length : transcriptVocabulary.size
  const previousVocabularySize =
    previousVocabularyItems.length > 0 ? previousVocabularyItems.length : previousTranscriptVocabulary.size
  const totalMinutes =
    studentMinutes !== null && teacherMinutes !== null ? studentMinutes + teacherMinutes : null
  const speakingRatioValue =
    session.speakingRatio !== null
      ? clampRatio(session.speakingRatio)
      : totalMinutes && totalMinutes > 0 && studentMinutes !== null
        ? clampRatio(studentMinutes / totalMinutes)
        : null

  return {
    masteryScore: session.averageScore,
    masteryDelta:
      session.averageScore !== null && previousAverage !== null ? session.averageScore - previousAverage : null,
    speakingRatioValue,
    speechLevel: speechLevel.value,
    speechLevelHint: speechLevel.hint,
    vocabularySize,
    vocabularyDelta: previousSession ? vocabularySize - previousVocabularySize : null,
    speechSpeed,
    speechSpeedDelta: speechSpeed !== null && previousSpeechSpeed !== null ? speechSpeed - previousSpeechSpeed : null,
    studentMinutes,
    teacherMinutes,
    sentenceLength,
    sentenceLengthDelta:
      sentenceLength !== null && previousSentenceLength !== null ? sentenceLength - previousSentenceLength : null,
  }
}

function statusTone(session: LessonFeedItem): string {
  if (session.status === "failed") return "border-0 bg-[color:rgb(168_85_85/0.12)] text-[#a85b5b] dark:text-[#f0b0b0]"
  if (analyticsReady(session)) return "border-0 bg-[var(--ds-neutral-row)] text-ds-ink"
  return "border-0 bg-[color:var(--progress-accent-soft)] text-[color:var(--progress-accent-strong)]"
}

function statusLabel(session: LessonFeedItem): string {
  if (session.status === "failed") return "Разбор не завершён"
  if (analyticsReady(session)) return "Отчёт готов"
  return "Анализ готовится..."
}

function TooltipHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="group inline-flex h-5 w-5 items-center justify-center rounded-full text-ds-text-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:text-ds-ink"
          aria-label={text}
        >
          <CircleHelp className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function DeltaBadge({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-[12px] font-semibold",
        value === null
          ? "bg-[var(--ds-neutral-row)] text-ds-text-tertiary"
          : value > 0
            ? "bg-[color:var(--progress-accent-surface)] text-[color:var(--progress-accent-strong)]"
            : value < 0
              ? "bg-[color:rgb(250_235_214/0.9)] text-[#a96a12] dark:bg-[color:rgb(169_106_18/0.18)] dark:text-[#f0c27a]"
              : "bg-[var(--ds-neutral-row)] text-ds-text-tertiary"
      )}
    >
      {formatDelta(value, suffix)}
    </span>
  )
}

function RingChart({ value }: { value: number | null }) {
  const progress = value === null ? 0 : clampInt(value, 0, 100)

  return (
    <div
      className="relative h-20 w-20 rounded-full"
      style={{
        background: `conic-gradient(var(--progress-accent-strong) ${progress * 3.6}deg, color-mix(in srgb, var(--ds-ink) 10%, transparent) ${progress * 3.6}deg)`,
      }}
    >
      <div className="absolute inset-[9px] rounded-full bg-[var(--ds-surface)]" />
    </div>
  )
}

function LevelBars({ value }: { value: number | null }) {
  const activeBars =
    value === null ? 0 : value >= 85 ? 5 : value >= 72 ? 4 : value >= 58 ? 3 : value >= 42 ? 2 : 1

  return (
    <div className="flex h-16 items-end gap-1">
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-3 rounded-full bg-black/[0.07] transition-all duration-300 dark:bg-white/10",
            bar <= activeBars ? "bg-[color:var(--progress-accent-strong)]" : ""
          )}
          style={{ height: `${18 + bar * 8}px` }}
        />
      ))}
    </div>
  )
}

function TrendLine({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 110 48" className="h-14 w-[110px]" aria-hidden>
      <path
        d={up ? "M4 36 L54 24 L106 10" : "M4 14 L54 24 L106 36"}
        fill="none"
        stroke="var(--progress-accent-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="106" cy={up ? "10" : "36"} r="5.5" fill="var(--ds-surface)" stroke="var(--progress-accent-strong)" strokeWidth="2.5" />
      <path
        d={up ? "M4 36 L54 24 L106 10 L106 48 L4 48 Z" : "M4 14 L54 24 L106 36 L106 48 L4 48 Z"}
        fill="var(--progress-accent-soft)"
      />
    </svg>
  )
}

function Gauge({ value }: { value: number | null }) {
  const progress = value === null ? 0 : clampRatio(value / 200)
  const degrees = 180 * progress

  return (
    <div className="relative h-16 w-28 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-14 rounded-t-full border-[10px] border-b-0 border-black/[0.08] dark:border-white/10" />
      <div
        className="absolute inset-x-0 bottom-0 h-14 rounded-t-full border-[10px] border-b-0 border-transparent"
        style={{
          borderTopColor: "var(--progress-accent-strong)",
          transform: `rotate(${degrees - 180}deg)`,
          transformOrigin: "center bottom",
        }}
      />
    </div>
  )
}

function SpeakerLegend({
  name,
  avatarUrl,
  fallbackLabel,
  align = "start",
  compact = false,
}: {
  name: string | null
  avatarUrl: string | null
  fallbackLabel: string
  align?: "start" | "end"
  compact?: boolean
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", align === "end" ? "justify-end text-right" : "justify-start")}>
      {align === "end" ? (
        <div className="min-w-0">
          <p className={cn("truncate font-medium text-ds-ink", compact ? "text-[13px]" : "text-[12px]")}>{name || fallbackLabel}</p>
          {!compact ? <p className="truncate text-[11px] text-ds-text-tertiary">{fallbackLabel}</p> : null}
        </div>
      ) : null}
      <Avatar className={cn("shrink-0 ring-1 ring-black/[0.06] dark:ring-white/10", compact ? "h-10 w-10" : "h-9 w-9")}>
        <AvatarImage src={avatarUrl || undefined} alt={name || fallbackLabel} className="object-cover" />
        <AvatarFallback className="bg-[var(--ds-neutral-row)] text-[11px] font-semibold text-ds-ink">
          {initials(name, fallbackLabel.slice(0, 2).toUpperCase())}
        </AvatarFallback>
      </Avatar>
      {align === "start" ? (
        <div className="min-w-0">
          <p className={cn("truncate font-medium text-ds-ink", compact ? "text-[13px]" : "text-[12px]")}>{name || fallbackLabel}</p>
          {!compact ? <p className="truncate text-[11px] text-ds-text-tertiary">{fallbackLabel}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function SpeakingSplit({
  studentMinutes,
  teacherMinutes,
  studentName,
  teacherName,
  studentAvatarUrl,
  teacherAvatarUrl,
}: {
  studentMinutes: number | null
  teacherMinutes: number | null
  studentName: string | null
  teacherName: string | null
  studentAvatarUrl: string | null
  teacherAvatarUrl: string | null
}) {
  const student = studentMinutes ?? 0
  const teacher = teacherMinutes ?? 0
  const total = student + teacher
  const studentWidth = total > 0 ? `${(student / total) * 100}%` : "50%"
  const teacherWidth = total > 0 ? `${(teacher / total) * 100}%` : "50%"

  return (
    <div className="w-full">
      <div className="mb-3 grid grid-cols-2 gap-3">
        <SpeakerLegend
          name={studentName}
          avatarUrl={studentAvatarUrl || placeholderImages.studentAvatar}
          fallbackLabel="Ученик"
          compact
        />
        <SpeakerLegend
          name={teacherName}
          avatarUrl={teacherAvatarUrl || placeholderImages.teacherAvatar}
          fallbackLabel="Преподаватель"
          align="end"
          compact
        />
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
        <div className="flex h-full">
          <div className="bg-[color:var(--progress-accent-strong)]" style={{ width: studentWidth }} />
          <div className="bg-[color:var(--progress-accent-secondary)]" style={{ width: teacherWidth }} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px] text-ds-text-secondary">
        <span>{formatMinutes(studentMinutes)}</span>
        <span>{formatMinutes(teacherMinutes)}</span>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  hint,
  value,
  subtitle,
  delta,
  visual,
  onOpen,
  active = false,
  stacked = false,
}: {
  title: string
  hint: string
  value: string
  subtitle: string
  delta: ReactNode
  visual: ReactNode
  onOpen: () => void
  active?: boolean
  stacked?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group w-full rounded-[30px] border border-black/[0.06] bg-[var(--ds-surface)] p-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.04)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:shadow-[0_14px_34px_rgba(0,0,0,0.22)]",
        active &&
          "border-[color:var(--progress-accent-strong)] shadow-[0_18px_42px_color-mix(in_srgb,var(--progress-accent-strong)_18%,transparent)] dark:border-[color:var(--progress-accent)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-semibold text-ds-ink">{title}</p>
          <TooltipHint text={hint} />
        </div>
        <ChevronRight className="mt-1 h-4 w-4 text-ds-text-tertiary transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>

      <div className={cn("mt-6 gap-4", stacked ? "flex flex-col items-start" : "flex items-end justify-between")}>
        <div className={cn(stacked && "w-full")}>
          <div className="flex items-center gap-2">
            <p className="text-[38px] font-semibold leading-none text-ds-ink sm:text-[42px]">{value}</p>
            {delta}
          </div>
          <p className="mt-3 max-w-[15rem] text-[14px] leading-6 text-ds-text-secondary">{subtitle}</p>
        </div>
        <div className={cn(stacked ? "w-full" : "shrink-0")}>{visual}</div>
      </div>
    </button>
  )
}

function TranscriptTone({ speakerRole }: { speakerRole: LessonFeedItem["transcript"][number]["speakerRole"] }) {
  if (speakerRole === "student") return <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--progress-accent-strong)]" />
  if (speakerRole === "teacher") return <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--progress-accent-secondary)]" />
  return <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-black/18" />
}

function EmptyLessonInsights() {
  return (
    <div className="rounded-[40px] border border-black/[0.06] bg-[var(--ds-surface)]/95 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
      <h2 className="text-[28px] font-semibold text-ds-ink">Пока нет разборов уроков</h2>
      <p className="mt-3 max-w-[42rem] text-[15px] leading-7 text-ds-text-secondary">
        Когда после звонка появятся транскрипция и AI-разбор, здесь откроется история уроков с вкладками, графиками,
        ошибками, лексикой и полной расшифровкой.
      </p>
    </div>
  )
}

function LessonSelector({
  sessions,
  selectedSessionId,
  onSelect,
}: {
  sessions: LessonFeedItem[]
  selectedSessionId: string
  onSelect: (sessionId: string) => void
}) {
  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId) ?? sessions[0]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="group h-auto min-h-[54px] max-w-full justify-between gap-3 rounded-[18px] border border-black/[0.08] bg-[var(--ds-surface)] px-4 py-3 shadow-none transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10"
        >
          <div className="min-w-0 text-left">
            <p className="truncate text-[16px] font-semibold text-ds-ink">{selectedSession.title}</p>
            <p className="truncate text-[13px] text-ds-text-secondary">
              {formatSessionDateTime(selectedSession.endedAt ?? selectedSession.startedAt)}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-ds-text-tertiary transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[min(92vw,420px)] rounded-[26px] border border-black/[0.08] bg-[var(--ds-surface)] p-2 shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
      >
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="space-y-1">
            {sessions.map((session) => {
              const selected = session.sessionId === selectedSessionId

              return (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => onSelect(session.sessionId)}
                  className={cn(
                    "group flex w-full items-start gap-4 rounded-[22px] px-4 py-4 text-left transition-colors",
                    selected ? "bg-[var(--ds-neutral-row)]" : "hover:bg-[var(--ds-neutral-row)]"
                  )}
                >
                  <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,var(--progress-accent-soft),var(--progress-accent-secondary-soft))]">
                    <Sparkles className="h-5 w-5 text-[color:var(--progress-accent-strong)] transition-transform duration-200 group-hover:scale-105" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-ds-ink">{session.title}</p>
                    <p className="mt-1 text-[14px] text-ds-text-secondary">
                      {formatSessionDateTime(session.endedAt ?? session.startedAt)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function OverviewCard({
  title,
  onOpen,
  children,
}: {
  title: string
  onOpen: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-[30px] border border-black/[0.08] bg-[var(--ds-surface)] p-5 text-left shadow-[0_12px_36px_rgba(15,23,42,0.04)] transition-transform duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[18px] font-semibold text-ds-ink">{title}</h3>
        <ArrowHint />
      </div>
      <div className="mt-4">{children}</div>
    </button>
  )
}

function ArrowHint() {
  return <ChevronRight className="h-5 w-5 shrink-0 text-ds-text-tertiary transition-transform group-hover:translate-x-0.5" />
}

function TabLabel({
  label,
  iconOnly,
  icon: Icon,
}: {
  label: string
  iconOnly?: boolean
  icon?: typeof Grid2x2
}) {
  if (iconOnly && Icon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center">
            <Icon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      {Icon ? <Icon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105" /> : null}
      <span>{label}</span>
    </>
  )
}

function DetailFact({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="text-[36px] font-semibold leading-none text-ds-ink">{value}</p>
      <p className="mt-2 text-[15px] text-ds-text-secondary">{label}</p>
    </div>
  )
}

function LevelScaleStrip({ score }: { score: number | null }) {
  const level = resolveLevelScale(score)
  const segments = Array.from({ length: 24 }, (_, index) => index + 1)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-6 gap-3 text-[14px] font-semibold text-ds-ink">
        {["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-24 gap-1.5">
        {segments.map((segment) => {
          const active = segment === level.bandIndex * 4 + level.stepIndex + 1
          const inRange = segment >= level.rangeStart && segment <= level.rangeEnd

          return (
            <div
              key={segment}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-[10px] text-[13px] font-semibold transition-colors",
                active
                  ? "bg-[color:var(--progress-accent-strong)] text-white"
                  : inRange
                    ? "bg-[color:var(--progress-accent-soft)] text-[color:var(--progress-accent-strong)]"
                    : "bg-[var(--ds-neutral-row)] text-ds-text-tertiary"
              )}
            >
              {((segment - 1) % 4) + 1}
              {active ? (
                <span className="absolute -top-4 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[10px] border-x-transparent border-t-[color:var(--progress-accent-strong)]" />
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-[15px] text-ds-text-secondary">
        <span>Старт</span>
        <span>Свободная речь</span>
      </div>
    </div>
  )
}

function MetricDetailSheet({
  metric,
  onClose,
  history,
  selectedSession,
  metrics,
}: {
  metric: ProgressMetricKey | null
  onClose: () => void
  history: MetricHistoryPoint[]
  selectedSession: LessonFeedItem
  metrics: LessonMetrics
}) {
  const currentPoint = history[history.length - 1] ?? null
  const previousPoint = history.length > 1 ? history[history.length - 2] : null

  if (!metric || !currentPoint) {
    return (
      <Sheet open={false} onOpenChange={() => undefined}>
        <SheetContent side="right" />
      </Sheet>
    )
  }

  const metricTitle =
    metric === "MasteryScore"
      ? "Индекс освоения"
      : metric === "SpeakingLevel"
        ? "Уровень речи"
        : metric === "VocabularySize"
          ? "Размер словаря"
          : metric === "SpeakingSpeed"
            ? "Темп речи"
            : metric === "SpeakingTime"
              ? "Время речи"
              : "Длина реплики"

  const historyStroke = "var(--ds-ink)"
  const historyFill = "var(--progress-accent-soft)"
  const accent = "var(--progress-accent-strong)"

  const masteryHistory = history.filter((point) => point.masteryScore !== null)
  const vocabularyGrowth = previousPoint ? currentPoint.vocabularySize - previousPoint.vocabularySize : null
  const masteryDelta =
    currentPoint.masteryScore !== null && previousPoint && previousPoint.masteryScore !== null
      ? currentPoint.masteryScore - previousPoint.masteryScore
      : null
  const speakingTimeDelta =
    currentPoint.studentMinutes !== null && previousPoint && previousPoint.studentMinutes !== null
      ? Number((currentPoint.studentMinutes - previousPoint.studentMinutes).toFixed(1))
      : null
  const sentenceDelta =
    currentPoint.sentenceLength !== null && previousPoint && previousPoint.sentenceLength !== null
      ? currentPoint.sentenceLength - previousPoint.sentenceLength
      : null
  const speakingSpeedDelta =
    currentPoint.speechSpeed !== null && previousPoint && previousPoint.speechSpeed !== null
      ? currentPoint.speechSpeed - previousPoint.speechSpeed
      : null

  return (
    <Sheet open={Boolean(metric)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="right"
        sheetTitle={metricTitle}
        className="w-[min(96vw,760px)] max-w-[760px] gap-0 rounded-l-[34px] rounded-r-none border-l border-black/[0.08] bg-[var(--ds-surface)] p-0 shadow-[0_24px_80px_rgba(15,23,42,0.14)] dark:border-white/10 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-black/[0.08] px-7 py-6 dark:border-white/10">
            <SheetTitle className="pr-12 text-[22px] font-semibold text-ds-ink">{metricTitle}</SheetTitle>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-8 px-7 py-8">
              {metric === "MasteryScore" ? (
                <>
                  {masteryHistory.length < 4 ? (
                    <>
                      <div>
                        <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                        <p className="mt-4 text-[46px] font-semibold leading-none text-ds-ink">Недостаточно данных</p>
                        <p className="mt-4 max-w-[34rem] text-[16px] leading-8 text-ds-text-secondary">
                          Мы начнём считать стабильный индекс после четырёх разобранных уроков. Сейчас не хватает ещё{" "}
                          {Math.max(0, 4 - masteryHistory.length)}{" "}
                          {pluralizeRu(Math.max(0, 4 - masteryHistory.length), ["урока", "уроков", "уроков"])}.
                        </p>
                      </div>

                      <div className="h-[260px] rounded-[26px] bg-[var(--ds-neutral-row)] p-5">
                        <div className="flex h-full flex-col justify-between">
                          {[100, 75, 50, 25, 0].map((value) => (
                            <div key={value} className="flex items-center justify-between gap-4">
                              <div className="h-px flex-1 border-t border-dashed border-black/[0.08] dark:border-white/10" />
                              <span className="text-[13px] text-ds-text-tertiary">{value}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                        <div className="mt-4 flex items-center gap-3">
                          <p className="text-[56px] font-semibold leading-none text-ds-ink">{currentPoint.masteryScore}%</p>
                          <DeltaBadge value={masteryDelta} suffix="%" />
                        </div>
                      </div>

                      <div className="h-[260px] rounded-[26px] bg-[var(--ds-neutral-row)] p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={masteryHistory}>
                            <CartesianGrid vertical={false} stroke="var(--progress-grid)" strokeDasharray="4 6" />
                            <XAxis dataKey="shortDate" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                            <YAxis orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} tickFormatter={(value: number) => `${value}%`} />
                            <RechartsTooltip cursor={false} content={<ProgressChartTooltip />} />
                            <Area type="monotone" dataKey="masteryScore" stroke={historyStroke} strokeWidth={3} fill={historyFill} fillOpacity={1} dot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} activeDot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2">
                        <DetailFact
                          value={`${Math.round(masteryHistory.reduce((total, point) => total + (point.masteryScore ?? 0), 0) / masteryHistory.length)}%`}
                          label="Средний индекс освоения"
                        />
                        <DetailFact
                          value={`${Math.max(...masteryHistory.map((point) => point.masteryScore ?? 0))}%`}
                          label="Лучший результат"
                        />
                      </div>
                    </>
                  )}

                  <section>
                    <h4 className="text-[18px] font-semibold text-ds-ink">Как считается индекс</h4>
                    <p className="mt-3 text-[16px] leading-8 text-ds-text-secondary">
                      Индекс освоения собирается из грамматики, лексики и беглости именно по живому уроку. Чем больше
                      стабильных разборов подряд, тем точнее видно, где навык растёт и где проседает.
                    </p>
                  </section>
                </>
              ) : null}

              {metric === "SpeakingLevel" ? (
                <>
                  <div>
                    <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <p className="text-[56px] font-semibold leading-none text-ds-ink">{resolveLevelScale(currentPoint.speechLevelScore).code}</p>
                      <p className="pb-1 text-[30px] font-semibold text-ds-ink">{resolveLevelScale(currentPoint.speechLevelScore).label}</p>
                    </div>
                  </div>

                  <div className="rounded-[26px] bg-[var(--ds-neutral-row)] p-5">
                    <LevelScaleStrip score={currentPoint.speechLevelScore} />
                  </div>

                  <section>
                    <h4 className="text-[18px] font-semibold text-ds-ink">Как считается уровень речи</h4>
                    <p className="mt-3 text-[16px] leading-8 text-ds-text-secondary">
                      Мы смотрим на качество устной речи именно в живом разговоре: насколько уверенно строятся фразы,
                      хватает ли слов и как стабильно звучит ответ без подсказки преподавателя.
                    </p>
                  </section>
                </>
              ) : null}

              {metric === "VocabularySize" ? (
                <>
                  <div>
                    <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <p className="text-[56px] font-semibold leading-none text-ds-ink">{currentPoint.vocabularySize.toLocaleString("ru-RU")}</p>
                      <DeltaBadge value={vocabularyGrowth} />
                    </div>
                  </div>

                  <div className="h-[260px] rounded-[26px] bg-[var(--ds-neutral-row)] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <CartesianGrid vertical={false} stroke="var(--progress-grid)" strokeDasharray="4 6" />
                        <XAxis dataKey="shortDate" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                        <YAxis orientation="right" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                        <RechartsTooltip cursor={false} content={<ProgressChartTooltip />} />
                        <Area type="monotone" dataKey="vocabularySize" stroke={historyStroke} strokeWidth={3} fill={historyFill} fillOpacity={1} dot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} activeDot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <section>
                    <h4 className="text-[18px] font-semibold text-ds-ink">Что входит в размер словаря</h4>
                    <p className="mt-3 text-[16px] leading-8 text-ds-text-secondary">
                      Здесь копятся уникальные слова и выражения из ученических реплик, исправлений и активной лексики
                      урока. Поэтому кривая растёт не от одного красивого ответа, а от устойчивого накопления речи.
                    </p>
                  </section>
                </>
              ) : null}

              {metric === "SpeakingSpeed" ? (
                <>
                  <div>
                    <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <p className="text-[56px] font-semibold leading-none text-ds-ink">
                        {currentPoint.speechSpeed ?? 0} сл/мин
                      </p>
                      <DeltaBadge
                        value={speakingSpeedDelta}
                      />
                    </div>
                    <p className="mt-3 text-[16px] italic text-ds-text-secondary">
                      {currentPoint.speechSpeed !== null && currentPoint.speechSpeed >= 90 && currentPoint.speechSpeed <= 140
                        ? "Рабочий и понятный темп"
                        : "Темп ещё формируется"}
                    </p>
                  </div>

                  <div className="h-[280px] rounded-[26px] bg-[var(--ds-neutral-row)] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={history}>
                        <CartesianGrid vertical={false} stroke="var(--progress-grid)" strokeDasharray="4 6" />
                        <ReferenceArea y1={90} y2={140} fill={historyFill} fillOpacity={0.9} />
                        <XAxis dataKey="shortDate" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                        <YAxis orientation="right" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} tickFormatter={(value: number) => `${value}`} />
                        <RechartsTooltip cursor={false} content={<ProgressChartTooltip />} />
                        <Line type="monotone" dataKey="speechSpeed" stroke={historyStroke} strokeWidth={3} dot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} activeDot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap gap-5 text-[15px] text-ds-text-secondary">
                    <span>Спокойно: 60–90 сл/мин</span>
                    <span>Рабочий темп: 90–140 сл/мин</span>
                    <span>Быстро: 140+ сл/мин</span>
                  </div>

                  <section>
                    <h4 className="text-[18px] font-semibold text-ds-ink">Что показывает темп речи</h4>
                    <p className="mt-3 text-[16px] leading-8 text-ds-text-secondary">
                      Темп показывает, насколько легко ученик собирает ответ без длинных пауз. Слишком низкий темп
                      обычно означает неуверенность, а слишком высокий может бить по чёткости и контролю конструкции.
                    </p>
                  </section>
                </>
              ) : null}

              {metric === "SpeakingTime" ? (
                <>
                  <div>
                    <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <p className="text-[56px] font-semibold leading-none text-ds-ink">
                        {formatMinutes(currentPoint.studentMinutes)}
                      </p>
                      <DeltaBadge value={speakingTimeDelta} suffix=" мин" />
                    </div>
                  </div>

                  <div className="h-[280px] rounded-[26px] bg-[var(--ds-neutral-row)] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={history}>
                        <CartesianGrid vertical={false} stroke="var(--progress-grid)" strokeDasharray="4 6" />
                        <XAxis dataKey="shortDate" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                        <YAxis orientation="right" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} tickFormatter={formatMinutesTick} />
                        <RechartsTooltip cursor={false} content={<ProgressChartTooltip />} />
                        <Bar dataKey="studentMinutes" stackId="speech" fill={accent} radius={[10, 10, 0, 0]} />
                        <Bar dataKey="teacherMinutes" stackId="speech" fill="var(--progress-accent-secondary)" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <SpeakerLegend
                      name={selectedSession.studentName}
                      avatarUrl={selectedSession.studentAvatarUrl || placeholderImages.studentAvatar}
                      fallbackLabel="Ученик"
                    />
                    <SpeakerLegend
                      name={selectedSession.teacherName}
                      avatarUrl={selectedSession.teacherAvatarUrl || placeholderImages.teacherAvatar}
                      fallbackLabel="Преподаватель"
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <DetailFact
                      value={formatMinutes(
                        history.reduce((total, point) => total + (point.studentMinutes ?? 0), 0) / Math.max(history.length, 1)
                      )}
                      label="Среднее время речи ученика"
                    />
                    <DetailFact
                      value={formatMinutes(Math.max(...history.map((point) => point.studentMinutes ?? 0)))}
                      label="Самый разговорный урок"
                    />
                  </div>

                  <section>
                    <h4 className="text-[18px] font-semibold text-ds-ink">Как читать баланс разговора</h4>
                    <p className="mt-3 text-[16px] leading-8 text-ds-text-secondary">
                      Эта метрика показывает, кто реально занимал эфир внутри урока. Идеальный баланс не всегда 50/50:
                      где-то преподаватель объясняет, а где-то ученик должен держать речь почти сам.
                    </p>
                  </section>
                </>
              ) : null}

              {metric === "SentenceLength" ? (
                <>
                  <div>
                    <p className="text-[16px] text-ds-text-secondary">{currentPoint.fullDate}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <p className="text-[56px] font-semibold leading-none text-ds-ink">
                        {currentPoint.sentenceLength ?? 0} {pluralizeRu(currentPoint.sentenceLength ?? 0, ["слово", "слова", "слов"])}
                      </p>
                      <DeltaBadge value={sentenceDelta} />
                    </div>
                  </div>

                  <div className="h-[260px] rounded-[26px] bg-[var(--ds-neutral-row)] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <CartesianGrid vertical={false} stroke="var(--progress-grid)" strokeDasharray="4 6" />
                        <XAxis dataKey="shortDate" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                        <YAxis orientation="right" tickLine={false} axisLine={false} tick={{ fill: "var(--ds-text-tertiary)", fontSize: 13 }} />
                        <RechartsTooltip cursor={false} content={<ProgressChartTooltip />} />
                        <Area type="monotone" dataKey="sentenceLength" stroke={historyStroke} strokeWidth={3} fill={historyFill} fillOpacity={1} dot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} activeDot={{ r: 7, fill: "var(--ds-surface)", stroke: historyStroke, strokeWidth: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <DetailFact
                      value={`${Math.round(
                        history.reduce((total, point) => total + (point.sentenceLength ?? 0), 0) / Math.max(history.length, 1)
                      )} ${pluralizeRu(
                        Math.round(history.reduce((total, point) => total + (point.sentenceLength ?? 0), 0) / Math.max(history.length, 1)),
                        ["слово", "слова", "слов"]
                      )}`}
                      label="Средняя длина реплики"
                    />
                    <DetailFact
                      value={`${Math.max(...history.map((point) => point.sentenceLength ?? 0))} ${pluralizeRu(Math.max(...history.map((point) => point.sentenceLength ?? 0)), ["слово", "слова", "слов"])}`}
                      label="Личный рекорд"
                    />
                  </div>

                  <section>
                    <h4 className="text-[18px] font-semibold text-ds-ink">О чём говорит длина реплики</h4>
                    <p className="mt-3 text-[16px] leading-8 text-ds-text-secondary">
                      Чем длиннее и устойчивее реплика, тем легче ученику связывать слова в полноценный ответ. Рост
                      здесь показывает не только словарь, но и уверенность держать мысль до конца.
                    </p>
                  </section>
                </>
              ) : null}

              <div className="border-t border-black/[0.08] pt-6 dark:border-white/10">
                <p className="text-[16px] text-ds-ink">Полезно ли это объяснение?</p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ds-neutral-row)] text-ds-ink transition-transform duration-200 hover:-translate-y-0.5"
                    aria-label="Полезно"
                  >
                    <ThumbsUp className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ds-neutral-row)] text-ds-ink transition-transform duration-200 hover:-translate-y-0.5"
                    aria-label="Не полезно"
                  >
                    <ThumbsDown className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function LessonFeed({ sessions, current, previous }: LessonFeedProps) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.sessionId ?? "")
  const [activeTab, setActiveTab] = useState<InsightTab>("overview")
  const [activeMetric, setActiveMetric] = useState<ProgressMetricKey | null>(null)

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("")
      setActiveTab("overview")
      setActiveMetric(null)
      return
    }

    const sessionStillExists = sessions.some((session) => session.sessionId === selectedSessionId)
    if (!sessionStillExists) {
      setSelectedSessionId(sessions[0].sessionId)
    }
  }, [selectedSessionId, sessions])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const panel = parseProgressMetricKey(params.get("progress-panel"))
    if (panel) {
      setActiveTab("progress")
      setActiveMetric(panel)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const url = new URL(window.location.href)
    if (activeMetric) {
      url.searchParams.set("progress-panel", activeMetric)
    } else {
      url.searchParams.delete("progress-panel")
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
  }, [activeMetric])

  useEffect(() => {
    if (activeTab !== "progress" && activeMetric) {
      setActiveMetric(null)
    }
  }, [activeMetric, activeTab])

  if (sessions.length === 0) return <EmptyLessonInsights />

  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId) ?? sessions[0]
  const selectedIndex = sessions.findIndex((session) => session.sessionId === selectedSession.sessionId)
  const previousSession = selectedIndex >= 0 ? sessions[selectedIndex + 1] ?? null : null
  const historySessions =
    selectedIndex >= 0 ? sessions.slice(selectedIndex).reverse() : [...sessions].reverse()
  const topics = buildTopicList(selectedSession)
  const feedback = splitFeedback(selectedSession)
  const vocabularyItems = buildVocabularyItems(selectedSession)
  const previewSegments = transcriptPreview(selectedSession)
  const practiceItems = buildPracticeItems(selectedSession)
  const metrics = buildLessonMetrics(selectedSession, previousSession, vocabularyItems)
  const metricHistory = buildMetricHistory(historySessions)
  const selectedSkillMap = hasSkillMapData(buildSkillMapFromSession(selectedSession))
    ? buildSkillMapFromSession(selectedSession)
    : current
  const previousSkillMap =
    previousSession && hasSkillMapData(buildSkillMapFromSession(previousSession))
      ? buildSkillMapFromSession(previousSession)
      : previous ?? null

  return (
    <section className="overflow-hidden rounded-[42px] border border-black/[0.06] bg-[var(--ds-surface)] shadow-[0_28px_90px_rgba(15,23,42,0.07)] dark:border-white/10 dark:shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <div className="border-b border-black/[0.06] bg-[linear-gradient(90deg,var(--progress-accent-gradient-start),var(--progress-accent-gradient-end))] px-5 py-4 dark:border-white/10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ds-surface)]/80 px-3 py-1.5 text-sm font-semibold text-ds-ink backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-[color:var(--progress-accent-strong)] transition-transform duration-200 hover:scale-105" />
            Разбор урока
          </div>
          <Badge
            variant="outline"
            className="rounded-full !border-0 bg-[var(--ds-surface)]/80 px-3 py-1.5 text-[12px] font-semibold text-ds-ink shadow-none backdrop-blur-sm"
          >
            ИИ-бета
          </Badge>
        </div>
      </div>

      <div className="border-b border-black/[0.06] px-5 py-4 dark:border-white/10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LessonSelector sessions={sessions} selectedSessionId={selectedSession.sessionId} onSelect={setSelectedSessionId} />
          <Badge
            variant="outline"
            className={cn("rounded-full !border-0 px-3 py-1.5 text-[12px] font-semibold shadow-none", statusTone(selectedSession))}
          >
            {statusLabel(selectedSession)}
          </Badge>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-[15px] leading-7 text-ds-text-secondary sm:text-[16px]">{formatSessionMeta(selectedSession)}</p>
        <h2 className="mt-3 text-[28px] font-bold leading-[1.05] text-ds-ink sm:text-[36px]">{selectedSession.title}</h2>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InsightTab)} className="mt-8 gap-0">
          <TabsList className="flex h-auto w-full flex-wrap items-end gap-6 rounded-none border-b border-black/[0.08] bg-transparent p-0 text-left dark:border-white/10">
            {INSIGHT_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group relative !h-auto rounded-[16px] !border-0 !bg-transparent px-4 pb-4 pt-3 text-[15px] font-semibold text-ds-text-secondary shadow-none transition-[color,background-color,transform] duration-200 hover:bg-black/[0.04] hover:text-ds-ink dark:hover:bg-white/[0.06] data-[state=active]:!bg-transparent data-[state=active]:text-ds-ink after:absolute after:bottom-[-1px] after:left-4 after:right-4 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-[color:var(--progress-accent-strong)]"
              >
                <TabLabel label={tab.label} icon={tab.icon} iconOnly={tab.iconOnly} />
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="animate-in fade-in-0 slide-in-from-bottom-2 pt-8 duration-300">
            <div className="space-y-6">
              <p className="max-w-[62rem] text-[18px] leading-8 text-ds-ink">
                {selectedSession.summary?.trim() ||
                  "Этот урок уже появился в истории, но подробная аналитика ещё готовится. Как только обработка завершится, здесь откроются итог, графики, ошибки, лексика и практика."}
              </p>

              <Button
                variant="link"
                className="h-auto p-0 text-[17px] font-semibold text-ds-ink"
                onClick={() => setActiveTab("recap")}
              >
                Открыть полный итог урока
              </Button>

              <div className="grid gap-5 xl:grid-cols-2">
                <OverviewCard title="Итог" onOpen={() => setActiveTab("recap")}>
                  <div className="space-y-3 rounded-[24px] bg-[var(--ds-neutral-row)] p-3">
                    {topics.slice(0, 3).map((topic, index) => (
                      <div key={`${topic}-${index}`} className="flex items-start gap-3 rounded-[20px] bg-[var(--ds-surface)] px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ds-neutral-row)] text-[16px] font-semibold text-ds-ink">
                          {index + 1}
                        </div>
                        <p className="pt-2 text-[15px] font-medium text-ds-ink">{topic}</p>
                      </div>
                    ))}
                  </div>
                </OverviewCard>

                <OverviewCard title="Прогресс" onOpen={() => setActiveTab("progress")}>
                  <div className="rounded-[24px] bg-[var(--ds-neutral-row)] p-4">
                    <div className="rounded-[20px] bg-[var(--ds-surface)] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] font-semibold text-ds-ink">Говорил ученик</p>
                        <span className="text-[15px] font-semibold text-ds-ink">
                          {formatSpeakingRatio(metrics.speakingRatioValue)}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="h-4 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
                          <div className="flex h-full">
                            <div
                              className="bg-[color:var(--progress-accent-strong)]"
                              style={{ width: `${clampRatio(metrics.speakingRatioValue ?? 0.5) * 100}%` }}
                            />
                            <div
                              className="bg-[color:var(--progress-accent-secondary)]"
                              style={{ width: `${100 - clampRatio(metrics.speakingRatioValue ?? 0.5) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[13px] text-ds-text-secondary">
                        <span>Ученик</span>
                        <span>Преподаватель</span>
                      </div>
                    </div>
                  </div>
                </OverviewCard>

                <OverviewCard title="Разбор" onOpen={() => setActiveTab("feedback")}>
                  <div className="space-y-3">
                    {feedback.strengths[0] ? (
                      <div className="rounded-[20px] bg-[var(--progress-accent-surface)] px-4 py-3 text-[14px] leading-6 text-[color:var(--progress-accent-strong)]">
                        {feedback.strengths[0]}
                      </div>
                    ) : null}
                    {feedback.mistakes[0] ? (
                      <div className="rounded-[20px] bg-[color:rgb(250_235_214/0.9)] px-4 py-3 text-[14px] leading-6 text-[#825617] dark:bg-[color:rgb(130_86_23/0.16)] dark:text-[#f0c27a]">
                        {feedback.mistakes[0].original} → {feedback.mistakes[0].correction}
                      </div>
                    ) : null}
                  </div>
                </OverviewCard>

                <OverviewCard title="Лексика" onOpen={() => setActiveTab("vocabulary")}>
                  <div className="flex flex-wrap gap-2 rounded-[24px] bg-[var(--ds-neutral-row)] p-3">
                    {vocabularyItems.slice(0, 8).map((item) => (
                      <span
                        key={item.id}
                        className="rounded-[14px] bg-[var(--ds-surface)] px-3 py-2 text-[14px] font-medium text-ds-ink"
                      >
                        {item.phrase}
                      </span>
                    ))}
                    {vocabularyItems.length === 0 ? (
                      <p className="px-2 py-1 text-[14px] leading-6 text-ds-text-secondary">
                        Лексика появится после готового разбора.
                      </p>
                    ) : null}
                  </div>
                </OverviewCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recap" className="animate-in fade-in-0 slide-in-from-bottom-2 pt-8 duration-300">
            <div className="space-y-10">
              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Итог урока</h3>
                <p className="mt-4 max-w-[64rem] text-[17px] leading-8 text-ds-ink">
                  {selectedSession.summary?.trim() ||
                    "Когда обработка завершится, здесь появится сжатый и понятный итог этого урока."}
                </p>
              </section>

              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Что разбирали</h3>
                <div className="mt-5 space-y-5">
                  {topics.length > 0 ? (
                    topics.map((topic, index) => (
                      <div key={`${topic}-${index}`} className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ds-neutral-row)] text-[18px] font-semibold text-ds-ink">
                          {index + 1}
                        </div>
                        <div className="pt-1">
                          <p className="text-[22px] font-semibold text-ds-ink">{topic}</p>
                          <p className="mt-2 text-[15px] leading-7 text-ds-text-secondary">
                            {selectedSession.recommendations[index] ||
                              selectedSession.strengths[index] ||
                              "Тема появилась в разговоре, исправлениях и последующем разборе урока."}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[15px] leading-7 text-ds-text-secondary">
                      Темы урока появятся здесь после завершения AI-аналитики.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Ключевые выводы</h3>
                <Accordion type="single" collapsible className="mt-5 rounded-[28px] border border-black/[0.08] bg-[var(--ds-surface)] dark:border-white/10">
                  {[...feedback.strengths.slice(0, 2), ...selectedSession.recommendations.slice(0, 2)].map((item, index) => (
                      <AccordionItem key={`${item}-${index}`} value={`learning-${index}`} className="px-5">
                        <AccordionTrigger className="py-5 text-[16px] font-semibold text-ds-ink hover:no-underline">
                          <span className="flex items-center gap-4">
                            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--progress-accent-soft),var(--progress-accent-secondary-soft))]">
                              <BookOpen className="h-5 w-5 text-[color:var(--progress-accent-strong)] transition-transform duration-200 group-hover:scale-105" />
                            </span>
                            <span>{item}</span>
                          </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-16 pr-4 text-[14px] leading-7 text-ds-text-secondary">
                        Это одна из мыслей, к которой стоит вернуться перед следующим уроком и в самостоятельной практике.
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  {feedback.strengths.length === 0 && selectedSession.recommendations.length === 0 ? (
                    <div className="px-5 py-5 text-[14px] leading-7 text-ds-text-secondary">
                      Ключевые выводы появятся здесь после завершения разбора.
                    </div>
                  ) : null}
                </Accordion>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-ds-text-tertiary" />
                  <h3 className="text-[22px] font-semibold text-ds-ink">Полная транскрипция</h3>
                </div>
                {selectedSession.transcript.length > 0 ? (
                  <ScrollArea className="mt-5 h-[420px] rounded-[28px] bg-[var(--ds-neutral-row)] p-4">
                    <div className="space-y-3 pr-3">
                      {selectedSession.transcript.map((segment) => (
                        <article key={`${segment.sequence}-${segment.startedAtSec ?? "na"}`} className="rounded-[22px] bg-[var(--ds-surface)] px-4 py-4">
                          <div className="flex items-start gap-3">
                            <TranscriptTone speakerRole={segment.speakerRole} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-ds-text-tertiary">
                                {segment.speakerRole === "student"
                                  ? selectedSession.studentName || segment.speakerLabel?.trim() || "Ученик"
                                  : segment.speakerRole === "teacher"
                                    ? selectedSession.teacherName || segment.speakerLabel?.trim() || "Преподаватель"
                                    : segment.speakerLabel?.trim() || "Система"}
                                {segment.startedAtSec !== null ? ` · ${segment.startedAtSec.toFixed(1)}с` : ""}
                              </p>
                              <p className="mt-2 text-[15px] leading-7 text-ds-ink">{segment.text}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="mt-4 text-[15px] leading-7 text-ds-text-secondary">
                    Транскрипция пока не загрузилась. Она появится сразу после обработки звонка.
                  </p>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="progress" className="animate-in fade-in-0 slide-in-from-bottom-2 pt-8 duration-300">
            <div className="space-y-8">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  title="Индекс освоения"
                  hint="Среднее по грамматике, лексике и беглости именно в этом уроке."
                  value={metrics.masteryScore !== null ? String(metrics.masteryScore) : "—"}
                  subtitle="Насколько уверенно ученик прошёл этот урок в целом."
                  delta={<DeltaBadge value={metrics.masteryDelta} />}
                  visual={<RingChart value={metrics.masteryScore} />}
                  onOpen={() => setActiveMetric("MasteryScore")}
                  active={activeMetric === "MasteryScore"}
                />
                <MetricCard
                  title="Уровень речи"
                  hint="Оценка темпа и качества устной речи по текущей сессии."
                  value={metrics.speechLevel}
                  subtitle={metrics.speechLevelHint}
                  delta={<DeltaBadge value={metrics.masteryDelta} />}
                  visual={<LevelBars value={metrics.masteryScore} />}
                  onOpen={() => setActiveMetric("SpeakingLevel")}
                  active={activeMetric === "SpeakingLevel"}
                />
                <MetricCard
                  title="Лексика урока"
                  hint="Количество слов, фраз и паттернов, которые вошли в lesson insight."
                  value={String(metrics.vocabularySize)}
                  subtitle="Сюда попадают исправления, ключевые выражения и темы."
                  delta={<DeltaBadge value={metrics.vocabularyDelta} />}
                  visual={<TrendLine up={(metrics.vocabularyDelta ?? 0) >= 0} />}
                  onOpen={() => setActiveMetric("VocabularySize")}
                  active={activeMetric === "VocabularySize"}
                />
                <MetricCard
                  title="Темп речи"
                  hint="Оценка количества слов или фраз в минуту у ученика."
                  value={metrics.speechSpeed !== null ? `${metrics.speechSpeed}` : "—"}
                  subtitle="Сколько единиц речи в минуту давал именно ученик."
                  delta={<DeltaBadge value={metrics.speechSpeedDelta} />}
                  visual={<Gauge value={metrics.speechSpeed} />}
                  onOpen={() => setActiveMetric("SpeakingSpeed")}
                  active={activeMetric === "SpeakingSpeed"}
                />
                <MetricCard
                  title="Время речи"
                  hint="Как распределилось время разговора между учеником и преподавателем."
                  value={formatSpeakingRatio(metrics.speakingRatioValue)}
                  subtitle="Баланс живой беседы внутри урока."
                  delta={<DeltaBadge value={metrics.speakingRatioValue !== null ? Math.round((metrics.speakingRatioValue - 0.5) * 100) : null} suffix="%" />}
                  visual={
                    <SpeakingSplit
                      studentMinutes={metrics.studentMinutes}
                      teacherMinutes={metrics.teacherMinutes}
                      studentName={selectedSession.studentName}
                      teacherName={selectedSession.teacherName}
                      studentAvatarUrl={selectedSession.studentAvatarUrl}
                      teacherAvatarUrl={selectedSession.teacherAvatarUrl}
                    />
                  }
                  onOpen={() => setActiveMetric("SpeakingTime")}
                  active={activeMetric === "SpeakingTime"}
                  stacked
                />
                <MetricCard
                  title="Длина реплики"
                  hint="Среднее число слов или фраз в одной реплике ученика."
                  value={metrics.sentenceLength !== null ? `${metrics.sentenceLength}` : "—"}
                  subtitle="Показывает, насколько развернуто студент отвечает."
                  delta={<DeltaBadge value={metrics.sentenceLengthDelta} />}
                  visual={<TrendLine up={(metrics.sentenceLengthDelta ?? 0) >= 0} />}
                  onOpen={() => setActiveMetric("SentenceLength")}
                  active={activeMetric === "SentenceLength"}
                />
              </div>

              <section className="rounded-[34px] bg-[var(--ds-neutral-row)] p-5">
                <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.86fr)_minmax(0,1.14fr)] xl:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-ds-text-tertiary" />
                      <h3 className="text-[22px] font-semibold text-ds-ink">Трекер навыков</h3>
                      <TooltipHint text="Жёлтый слой — текущее состояние, сиреневый — прошлый сопоставимый урок." />
                    </div>
                    <p className="mt-3 max-w-[32rem] text-[15px] leading-7 text-ds-text-secondary">
                      Эта карта меняется после каждого нового звонка и показывает, куда реально сдвинулась речь ученика.
                    </p>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-center gap-3 text-[14px] text-ds-text-secondary">
                        <span className="inline-flex h-4 w-4 rounded-full bg-[color:var(--progress-accent-strong)]" />
                        <span>Текущее состояние после урока</span>
                      </div>
                      <div className="flex items-center gap-3 text-[14px] text-ds-text-secondary">
                        <span className="inline-flex h-4 w-4 rounded-full bg-[color:var(--progress-accent-secondary)]" />
                        <span>Предыдущий сопоставимый урок</span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {SKILL_LABELS.map((axis) => (
                        <div key={axis.key} className="rounded-[22px] bg-[var(--ds-surface)] px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[14px] font-semibold text-ds-ink">{axis.label}</p>
                            <span className="text-[14px] font-semibold text-ds-ink">{selectedSkillMap[axis.key]}</span>
                          </div>
                          <p className="mt-1 text-[13px] text-ds-text-secondary">
                            {previousSkillMap ? `к прошлому уроку: ${formatDelta(selectedSkillMap[axis.key] - previousSkillMap[axis.key])}` : "первая точка сравнения"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[30px] bg-[var(--ds-surface)] p-3 sm:p-5">
                    <SkillRadarChart current={selectedSkillMap} previous={previousSkillMap} mode="panel" />
                  </div>
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="animate-in fade-in-0 slide-in-from-bottom-2 pt-8 duration-300">
            <div className="grid gap-6 xl:grid-cols-2">
              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Что уже получается</h3>
                <div className="mt-5 space-y-4">
                  {feedback.strengths.length > 0 ? (
                    feedback.strengths.map((item, index) => (
                      <article key={`${item}-${index}`} className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-surface)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center gap-3 text-[14px] text-[color:var(--progress-accent-strong)]">
                          <Sparkles className="h-4 w-4 transition-transform duration-200 hover:scale-105" />
                          <span>Сильная сторона</span>
                        </div>
                        <p className="mt-4 text-[17px] leading-8 text-ds-ink">{item}</p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-[28px] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                      После готового разбора здесь появятся сильные стороны именно по этому уроку.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Что поправить</h3>
                <div className="mt-5 space-y-4">
                  {feedback.mistakes.length > 0 ? (
                    feedback.mistakes.map((mistake, index) => (
                      <article key={`${mistake.original}-${index}`} className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-surface)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
                        <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#a26a15] dark:text-[#f0c27a]">
                          <CircleAlert className="h-4 w-4" />
                          <span>{mistake.type}</span>
                          <Badge variant="outline" className="border-0 bg-[var(--ds-neutral-row)] text-ds-ink shadow-none">
                            HSK {mistake.hsk_level}
                          </Badge>
                        </div>
                        <p className="mt-4 text-[17px] leading-8 text-ds-ink">{mistake.original}</p>
                        <p className="mt-3 text-[15px] leading-7 text-ds-text-secondary">
                          <span className="font-semibold text-ds-ink">Исправление:</span> {mistake.correction}
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-ds-text-secondary">{mistake.explanation}</p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-[28px] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                      Когда AI закончит разбор, здесь появятся спорные места, исправления и объяснения.
                    </p>
                  )}
                </div>
              </section>

              <section className="xl:col-span-2">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-ds-text-tertiary" />
                  <h3 className="text-[22px] font-semibold text-ds-ink">Следующий фокус</h3>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {selectedSession.recommendations.length > 0 ? (
                    selectedSession.recommendations.map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-[24px] bg-[var(--progress-accent-secondary-soft)] px-5 py-4 text-[15px] leading-7 text-[color:var(--progress-accent-strong)]">
                        {item}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[28px] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                      Персональные рекомендации по следующему уроку появятся после финального отчёта.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="vocabulary" className="animate-in fade-in-0 slide-in-from-bottom-2 pt-8 duration-300">
            <div className="space-y-8">
              <section className="rounded-[30px] bg-[var(--ds-neutral-row)] px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--progress-accent-soft),var(--progress-accent-secondary-soft))]">
                      <Languages className="h-6 w-6 text-[color:var(--progress-accent-strong)] transition-transform duration-200 hover:scale-105" />
                    </div>
                    <div>
                      <h3 className="text-[22px] font-semibold text-ds-ink">Лексика урока</h3>
                      <p className="mt-2 max-w-[40rem] text-[15px] leading-7 text-ds-text-secondary">
                        Здесь собраны слова, выражения и паттерны, которые появились в исправлениях и темах этого урока.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-full border-black px-5 dark:border-white/10">
                    <Bookmark className="h-4 w-4" />
                    Сохранить все ({vocabularyItems.length})
                  </Button>
                </div>
              </section>

              {vocabularyItems.length > 0 ? (
                <Accordion type="single" collapsible className="rounded-[30px] border border-black/[0.08] bg-[var(--ds-surface)] dark:border-white/10">
                  {vocabularyItems.map((item) => (
                    <AccordionItem key={item.id} value={item.id} className="px-5">
                      <AccordionTrigger className="py-5 hover:no-underline">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/10">
                            <Volume2 className="h-5 w-5 text-[color:var(--progress-accent-strong)] transition-transform duration-200 group-hover:scale-105" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="truncate text-[17px] font-semibold text-ds-ink">{item.phrase}</span>
                              {item.hskLevel ? (
                                <Badge variant="outline" className="border-0 bg-[var(--ds-neutral-row)] text-ds-ink shadow-none">
                                  HSK {item.hskLevel}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pl-[72px] pr-4 text-[15px] leading-7 text-ds-text-secondary">
                        <p>{item.note}</p>
                        <p className="mt-2 text-[13px] text-ds-text-tertiary">{item.sourceLabel}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="rounded-[28px] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                  Пока AI не собрал лексику для этого урока. После готового отчёта здесь появятся слова и выражения.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="practice" className="animate-in fade-in-0 slide-in-from-bottom-2 pt-8 duration-300">
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-ds-text-tertiary" />
                  <h3 className="text-[22px] font-semibold text-ds-ink">Что потренировать</h3>
                </div>
                <p className="mt-3 max-w-[50rem] text-[15px] leading-7 text-ds-text-secondary">
                  Это короткий практический план после урока, чтобы закрепить проблемные места, пока материал ещё свежий.
                </p>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                {practiceItems.length > 0 ? (
                  practiceItems.map((item, index) => (
                    <article key={item.id} className="rounded-[30px] border border-black/[0.06] bg-[var(--ds-surface)] p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] dark:border-white/10 dark:shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ds-neutral-row)] text-[18px] font-semibold text-ds-ink">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[18px] font-semibold text-ds-ink">{item.title}</h4>
                          <p className="mt-2 text-[15px] leading-7 text-ds-text-secondary">{item.description}</p>
                          {item.bullets.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              {item.bullets.map((bullet) => (
                                <div key={bullet} className="flex items-start gap-3 text-[14px] leading-6 text-ds-text-secondary">
                                  <CheckCheck className="mt-1 h-4 w-4 shrink-0 text-[color:var(--progress-accent-strong)] transition-transform duration-200 hover:scale-105" />
                                  <p>{bullet}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-[28px] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                    После завершения AI-разбора здесь появятся следующие шаги именно по этому уроку.
                  </p>
                )}
              </div>

              <section className="rounded-[30px] bg-[var(--ds-neutral-row)] p-5">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ds-ink">
                  <Mic className="h-4 w-4" />
                  Фразы для повторения вслух
                </div>
                {previewSegments.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {previewSegments.map((segment) => (
                      <div key={`${segment.sequence}-${segment.text}`} className="rounded-[22px] bg-[var(--ds-surface)] px-4 py-4">
                        <div className="flex items-start gap-3">
                          <TranscriptTone speakerRole={segment.speakerRole} />
                          <div>
                            <p className="text-[13px] font-medium text-ds-text-tertiary">
                              {segment.speakerRole === "student"
                                ? selectedSession.studentName || segment.speakerLabel?.trim() || "Ученик"
                                : segment.speakerRole === "teacher"
                                  ? selectedSession.teacherName || segment.speakerLabel?.trim() || "Преподаватель"
                                  : segment.speakerLabel?.trim() || "Система"}
                            </p>
                            <p className="mt-2 text-[15px] leading-7 text-ds-ink">{segment.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-[15px] leading-7 text-ds-text-secondary">
                    После загрузки транскрипции сюда можно будет вернуться и быстро повторить ключевые фразы вслух.
                  </p>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <MetricDetailSheet
        metric={activeMetric}
        onClose={() => setActiveMetric(null)}
        history={metricHistory}
        selectedSession={selectedSession}
        metrics={metrics}
      />
    </section>
  )
}
