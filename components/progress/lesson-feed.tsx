"use client"

import { useEffect, useState } from "react"
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Bookmark,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Grid2x2,
  GraduationCap,
  Languages,
  LineChart,
  Mic,
  Sparkles,
  Target,
  Volume2,
} from "lucide-react"
import type { LessonFeedItem, SkillMap } from "@/lib/lesson-analytics/server"
import { cn } from "@/lib/utils"
import { SkillRadarChart } from "@/components/progress/skill-radar-chart"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

const INSIGHT_TABS: Array<{ value: InsightTab; label: string; icon?: typeof Grid2x2 }> = [
  { value: "overview", label: "Overview", icon: Grid2x2 },
  { value: "recap", label: "Recap" },
  { value: "progress", label: "Progress" },
  { value: "feedback", label: "Feedback" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "practice", label: "Practice" },
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

function createEmptySkillMap(): SkillMap {
  return {
    speaking: 0,
    phrases: 0,
    vocabulary: 0,
    listening: 0,
    grammar: 0,
    reading: 0,
  }
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
  const pieces = ["Китайский"]
  if (session.teacherName) pieces.push(session.teacherName)
  pieces.push(formatSessionDateTime(session.endedAt ?? session.startedAt))
  return pieces.join(" · ")
}

function formatSpeakingRatio(value: number | null): string {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `${value}`
  return "0"
}

function statusTone(session: LessonFeedItem): string {
  if (session.status === "failed") return "border-[#f2ced5] bg-[#fff3f5] text-[#a33f53]"
  if (analyticsReady(session)) return "border-[#d7dce8] bg-white text-ds-ink"
  return "border-[#f0d7a6] bg-[#fff7eb] text-[#935d15]"
}

function statusLabel(session: LessonFeedItem): string {
  if (session.status === "failed") return "Разбор не завершён"
  if (analyticsReady(session)) return "Отчёт готов"
  return "Анализ готовится..."
}

function buildTopicList(session: LessonFeedItem): string[] {
  if (session.topicsPracticed.length > 0) return session.topicsPracticed.slice(0, 6)

  const fallback = new Set<string>()
  if (session.mistakes.some((item) => item.type === "grammar")) fallback.add("Разбор грамматики")
  if (session.mistakes.some((item) => item.type === "vocabulary")) fallback.add("Работа над лексикой")
  if (session.mistakes.some((item) => item.type === "tones" || item.type === "pronunciation")) {
    fallback.add("Произношение и тоны")
  }
  if (session.transcript.length > 0) fallback.add("Диалог по уроку")

  return [...fallback].slice(0, 6)
}

function buildVocabularyItems(session: LessonFeedItem): VocabularyItem[] {
  const items: VocabularyItem[] = []
  const seen = new Set<string>()

  for (const mistake of session.mistakes) {
    const phrase = mistake.correction.trim()
    const fingerprint = `mistake:${phrase.toLowerCase()}`
    if (!phrase || seen.has(fingerprint)) continue
    seen.add(fingerprint)
    items.push({
      id: fingerprint,
      phrase,
      hskLevel: mistake.hsk_level,
      note: mistake.explanation,
      sourceLabel: `Исправление: ${mistake.original}`,
    })
  }

  for (const topic of session.topicsPracticed) {
    const phrase = topic.trim()
    const fingerprint = `topic:${phrase.toLowerCase()}`
    if (!phrase || seen.has(fingerprint)) continue
    seen.add(fingerprint)
    items.push({
      id: fingerprint,
      phrase,
      hskLevel: null,
      note: "Тема или языковой паттерн, который появился в этом уроке.",
      sourceLabel: "Тема урока",
    })
  }

  return items.slice(0, 12)
}

function buildPracticeItems(session: LessonFeedItem): PracticeItem[] {
  const items: PracticeItem[] = []

  session.recommendations.forEach((recommendation, index) => {
    items.push({
      id: `recommendation-${index}`,
      title: recommendation,
      description: "Личная рекомендация на следующий короткий цикл повторения.",
      bullets: session.topicsPracticed.slice(0, 2).map((topic) => `Сделайте 2-3 фразы на тему «${topic}».`),
    })
  })

  session.mistakes.slice(0, 3).forEach((mistake, index) => {
    items.push({
      id: `mistake-${index}`,
      title: `Отработайте фразу: ${mistake.correction}`,
      description: `Исправьте и повторите то место, где раньше было: ${mistake.original}`,
      bullets: [mistake.explanation, `Составьте ещё одну новую фразу с таким же паттерном.`],
    })
  })

  if (items.length === 0 && session.topicsPracticed.length > 0) {
    session.topicsPracticed.slice(0, 3).forEach((topic, index) => {
      items.push({
        id: `topic-${index}`,
        title: `Повторите тему «${topic}»`,
        description: "Небольшая самостоятельная практика до следующего звонка.",
        bullets: ["Сделайте 3 коротких примера вслух.", "Повторите лексику и 1 диалог на эту тему."],
      })
    })
  }

  return items.slice(0, 6)
}

function splitFeedback(session: LessonFeedItem): {
  positive: string[]
  improvement: LessonFeedItem["mistakes"]
} {
  return {
    positive: session.strengths.slice(0, 6),
    improvement: session.mistakes.slice(0, 6),
  }
}

function transcriptPreview(session: LessonFeedItem): LessonFeedItem["transcript"] {
  return session.transcript.filter((segment) => segment.text.trim()).slice(0, 8)
}

function TranscriptTone({ speakerRole }: { speakerRole: LessonFeedItem["transcript"][number]["speakerRole"] }) {
  if (speakerRole === "student") return <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[#F5C542]" />
  if (speakerRole === "teacher") return <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[#93C5FD]" />
  return <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-black/20" />
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white px-5 py-5 shadow-[0_12px_34px_rgba(15,23,42,0.04)]">
      <p className="text-[13px] font-medium text-ds-text-secondary">{label}</p>
      <p className="mt-4 text-[38px] font-semibold leading-none text-ds-ink">{value}</p>
      <p className="mt-3 text-[14px] leading-6 text-ds-text-secondary">{detail}</p>
    </div>
  )
}

function EmptyLessonInsights() {
  return (
    <div className="rounded-[40px] border border-black/[0.06] bg-white/[0.95] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <h2 className="text-[28px] font-semibold text-ds-ink">Пока нет lesson insights</h2>
      <p className="mt-3 max-w-[42rem] text-[15px] leading-7 text-ds-text-secondary">
        Когда после звонка появятся транскрипция и AI-разбор, здесь откроется история уроков с табами, графиками,
        ошибками, словарём и полной расшифровкой.
      </p>
    </div>
  )
}

function InsightPreviewCard({
  title,
  subtitle,
  onOpen,
  children,
}: {
  title: string
  subtitle: string
  onOpen: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-[30px] border border-black/[0.08] bg-white p-5 text-left shadow-[0_12px_36px_rgba(15,23,42,0.04)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold text-ds-ink">{title}</h3>
          <p className="mt-1 text-[14px] leading-6 text-ds-text-secondary">{subtitle}</p>
        </div>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-ds-text-tertiary transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-5">{children}</div>
    </button>
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
          className="h-auto min-h-[54px] max-w-full justify-between gap-3 rounded-[18px] border border-black/[0.08] bg-white px-4 py-3 shadow-none"
        >
          <div className="min-w-0 text-left">
            <p className="truncate text-[16px] font-semibold text-ds-ink">{selectedSession.title}</p>
            <p className="truncate text-[13px] text-ds-text-secondary">
              {formatSessionDateTime(selectedSession.endedAt ?? selectedSession.startedAt)}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-ds-text-tertiary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[min(92vw,420px)] rounded-[26px] border border-black/[0.08] bg-white p-2 shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
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
                    "flex w-full items-start gap-4 rounded-[22px] px-4 py-4 text-left transition-colors",
                    selected ? "bg-[var(--ds-neutral-row)]" : "hover:bg-[var(--ds-neutral-row)]"
                  )}
                >
                  <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#d9e8ff,#f7dbe9)]">
                    <Sparkles className="h-5 w-5 text-ds-ink" />
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

export function LessonFeed({ sessions, current, previous }: LessonFeedProps) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.sessionId ?? "")
  const [activeTab, setActiveTab] = useState<InsightTab>("overview")

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("")
      setActiveTab("overview")
      return
    }

    const stillExists = sessions.some((session) => session.sessionId === selectedSessionId)
    if (!stillExists) {
      setSelectedSessionId(sessions[0].sessionId)
    }
  }, [selectedSessionId, sessions])

  if (sessions.length === 0) return <EmptyLessonInsights />

  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId) ?? sessions[0]
  const selectedIndex = sessions.findIndex((session) => session.sessionId === selectedSession.sessionId)
  const previousSession = selectedIndex >= 0 ? sessions[selectedIndex + 1] ?? null : null
  const selectedSkillMap = hasSkillMapData(buildSkillMapFromSession(selectedSession))
    ? buildSkillMapFromSession(selectedSession)
    : current
  const previousSkillMap =
    previousSession && hasSkillMapData(buildSkillMapFromSession(previousSession))
      ? buildSkillMapFromSession(previousSession)
      : previous ?? null
  const vocabularyItems = buildVocabularyItems(selectedSession)
  const practiceItems = buildPracticeItems(selectedSession)
  const feedback = splitFeedback(selectedSession)
  const topics = buildTopicList(selectedSession)
  const previewSegments = transcriptPreview(selectedSession)
  const selectedStatusLabel = statusLabel(selectedSession)
  const selectedStatusTone = statusTone(selectedSession)
  const lessonAverageScore = selectedSession.averageScore ?? "—"

  return (
    <div className="overflow-hidden rounded-[42px] border border-black/[0.06] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.07)]">
      <div className="border-b border-black/[0.06] bg-[linear-gradient(90deg,rgba(206,224,255,0.8),rgba(248,220,234,0.8))] px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-ds-ink">
            <Sparkles className="h-4 w-4" />
            Lesson Insights
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-black/[0.08] bg-white/80 px-3 py-1 text-[12px] font-semibold text-ds-ink"
          >
            AI beta
          </Badge>
        </div>
      </div>

      <div className="border-b border-black/[0.06] px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LessonSelector sessions={sessions} selectedSessionId={selectedSession.sessionId} onSelect={setSelectedSessionId} />
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold", selectedStatusTone)}>
            {selectedStatusLabel}
          </Badge>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-[17px] leading-7 text-ds-text-secondary">{formatSessionMeta(selectedSession)}</p>
        <h2 className="mt-3 text-[40px] font-bold leading-[0.98] text-ds-ink sm:text-[64px]">{selectedSession.title}</h2>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InsightTab)} className="mt-8 gap-0">
          <TabsList className="flex h-auto w-full flex-wrap items-end gap-6 rounded-none border-b border-black/[0.08] bg-transparent p-0 text-left">
            {INSIGHT_TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-auto rounded-none border-b-2 border-transparent bg-transparent px-0 pb-4 pt-0 text-[15px] font-semibold text-ds-text-secondary data-[state=active]:border-[#ea7ca6] data-[state=active]:bg-transparent data-[state=active]:text-ds-ink"
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {!Icon ? tab.label : null}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="overview" className="pt-8">
            <div className="space-y-6">
              <p className="max-w-[62rem] text-[18px] leading-8 text-ds-ink">
                {selectedSession.summary?.trim() ||
                  "Этот урок уже появился в истории, но подробная AI-аналитика ещё догружается. Как только обработка завершится, здесь откроются summary, ошибки, рекомендации, словарь и практика."}
              </p>

              <div className="grid gap-5 xl:grid-cols-2">
                <InsightPreviewCard
                  title="Recap"
                  subtitle="Краткий пересказ урока и темы, которые действительно обсуждали в звонке."
                  onOpen={() => setActiveTab("recap")}
                >
                  <div className="space-y-3">
                    {topics.slice(0, 3).map((topic, index) => (
                      <div key={`${topic}-${index}`} className="flex items-start gap-3 rounded-[20px] bg-[var(--ds-neutral-row)] px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-ds-ink">
                          {index + 1}
                        </div>
                        <p className="pt-2 text-[15px] font-medium text-ds-ink">{topic}</p>
                      </div>
                    ))}
                  </div>
                </InsightPreviewCard>

                <InsightPreviewCard
                  title="Progress"
                  subtitle="Баллы урока и карта навыков после разбора этой сессии."
                  onOpen={() => setActiveTab("progress")}
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[22px] bg-[var(--ds-neutral-row)] px-4 py-4">
                      <p className="text-[12px] text-ds-text-secondary">Общий балл</p>
                      <p className="mt-2 text-[30px] font-semibold text-ds-ink">{lessonAverageScore}</p>
                    </div>
                    <div className="rounded-[22px] bg-[var(--ds-neutral-row)] px-4 py-4">
                      <p className="text-[12px] text-ds-text-secondary">Говорил ученик</p>
                      <p className="mt-2 text-[30px] font-semibold text-ds-ink">
                        {formatSpeakingRatio(selectedSession.speakingRatio)}
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-[var(--ds-neutral-row)] px-4 py-4">
                      <p className="text-[12px] text-ds-text-secondary">Темы</p>
                      <p className="mt-2 text-[30px] font-semibold text-ds-ink">{topics.length || "—"}</p>
                    </div>
                  </div>
                </InsightPreviewCard>

                <InsightPreviewCard
                  title="Feedback"
                  subtitle="Что уже получилось и где именно ещё есть ошибки."
                  onOpen={() => setActiveTab("feedback")}
                >
                  <div className="grid gap-3">
                    {feedback.positive[0] ? (
                      <div className="rounded-[20px] border border-[#c8e6d2] bg-[#f3fbf6] px-4 py-3 text-[14px] leading-6 text-[#27553b]">
                        {feedback.positive[0]}
                      </div>
                    ) : null}
                    {feedback.improvement[0] ? (
                      <div className="rounded-[20px] border border-[#f0d9a7] bg-[#fff8eb] px-4 py-3 text-[14px] leading-6 text-[#825617]">
                        {feedback.improvement[0].original} → {feedback.improvement[0].correction}
                      </div>
                    ) : null}
                    {!feedback.positive[0] && !feedback.improvement[0] ? (
                      <p className="text-[14px] leading-6 text-ds-text-secondary">
                        Дождитесь завершения обработки, чтобы здесь появились сильные стороны и точечные исправления.
                      </p>
                    ) : null}
                  </div>
                </InsightPreviewCard>

                <InsightPreviewCard
                  title="Vocabulary"
                  subtitle="Фразы и языковые паттерны, которые появились в lesson insight."
                  onOpen={() => setActiveTab("vocabulary")}
                >
                  <div className="flex flex-wrap gap-2">
                    {vocabularyItems.slice(0, 8).map((item) => (
                      <span
                        key={item.id}
                        className="rounded-[14px] border border-black/[0.08] bg-[var(--ds-neutral-row)] px-3 py-2 text-[14px] font-medium text-ds-ink"
                      >
                        {item.phrase}
                      </span>
                    ))}
                    {vocabularyItems.length === 0 ? (
                      <p className="text-[14px] leading-6 text-ds-text-secondary">
                        Лексика появится после того, как AI соберёт исправления, ключевые выражения и темы урока.
                      </p>
                    ) : null}
                  </div>
                </InsightPreviewCard>

                <InsightPreviewCard
                  title="Practice"
                  subtitle="Следующие конкретные шаги после этого урока."
                  onOpen={() => setActiveTab("practice")}
                >
                  <div className="space-y-3">
                    {practiceItems.slice(0, 2).map((item, index) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-[20px] bg-[var(--ds-neutral-row)] px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-ds-ink">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-ds-ink">{item.title}</p>
                          <p className="mt-1 text-[14px] leading-6 text-ds-text-secondary">{item.description}</p>
                        </div>
                      </div>
                    ))}
                    {practiceItems.length === 0 ? (
                      <p className="text-[14px] leading-6 text-ds-text-secondary">
                        Практика заполнится рекомендациями после финальной обработки отчёта.
                      </p>
                    ) : null}
                  </div>
                </InsightPreviewCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recap" className="pt-8">
            <div className="space-y-10">
              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Summary</h3>
                <p className="mt-4 max-w-[64rem] text-[17px] leading-8 text-ds-ink">
                  {selectedSession.summary?.trim() ||
                    "Краткий пересказ урока появится здесь сразу после завершения AI-обработки звонка."}
                </p>
              </section>

              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Topics discussed</h3>
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
                              "Тема была частью разговора, исправлений и последующего AI-разбора этого урока."}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[15px] leading-7 text-ds-text-secondary">
                      Как только AI отчёт соберёт темы урока, здесь появится структурированный recap разговора.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">Key learnings</h3>
                <Accordion type="single" collapsible className="mt-5 rounded-[28px] border border-black/[0.08] bg-white">
                  {[...feedback.positive.slice(0, 2), ...selectedSession.recommendations.slice(0, 2)].map((item, index) => (
                    <AccordionItem key={`${item}-${index}`} value={`learning-${index}`} className="px-5">
                      <AccordionTrigger className="py-5 text-[16px] font-semibold text-ds-ink hover:no-underline">
                        <span className="flex items-center gap-4">
                          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#d9e8ff,#f7dbe9)]">
                            <BookOpen className="h-5 w-5 text-ds-ink" />
                          </span>
                          <span>{item}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-16 pr-4 text-[14px] leading-7 text-ds-text-secondary">
                        Вернитесь к этой мысли перед следующим уроком: используйте её как мини-фокус для повторения и
                        для самостоятельной устной практики.
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  {feedback.positive.length === 0 && selectedSession.recommendations.length === 0 ? (
                    <div className="px-5 py-5 text-[14px] leading-7 text-ds-text-secondary">
                      Здесь появятся ключевые выводы, когда разбор урока будет полностью готов.
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
                  <ScrollArea className="mt-5 h-[420px] rounded-[28px] border border-black/[0.08] bg-[var(--ds-neutral-row)] p-4">
                    <div className="space-y-3 pr-3">
                      {selectedSession.transcript.map((segment) => (
                        <article
                          key={`${segment.sequence}-${segment.startedAtSec ?? "na"}`}
                          className="rounded-[22px] border border-black/[0.06] bg-white px-4 py-4"
                        >
                          <div className="flex items-start gap-3">
                            <TranscriptTone speakerRole={segment.speakerRole} />
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary">
                                {segment.speakerLabel?.trim() || segment.speakerRole}
                                {segment.startedAtSec !== null ? ` · ${segment.startedAtSec.toFixed(1)}s` : ""}
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
                    Транскрипция ещё не загрузилась. После обработки Daily она появится прямо здесь.
                  </p>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="progress" className="pt-8">
            <div className="space-y-8">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Общий балл" value={String(lessonAverageScore)} detail="Среднее по грамматике, лексике и беглости в этом уроке." />
                <MetricCard
                  label="Грамматика"
                  value={selectedSession.grammarScore !== null ? String(selectedSession.grammarScore) : "—"}
                  detail="Насколько уверенно студент строил конструкции в живом диалоге."
                />
                <MetricCard
                  label="Лексика"
                  value={selectedSession.vocabularyScore !== null ? String(selectedSession.vocabularyScore) : "—"}
                  detail="Насколько богато и точно использовались слова и выражения."
                />
                <MetricCard
                  label="Говорил ученик"
                  value={formatSpeakingRatio(selectedSession.speakingRatio)}
                  detail="Доля времени, в которую говорил ученик, а не преподаватель."
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="rounded-[34px] border border-black/[0.08] bg-[linear-gradient(135deg,rgba(245,197,66,0.12),rgba(147,197,253,0.12),rgba(255,255,255,0.95))] p-5">
                  <SkillRadarChart current={selectedSkillMap} previous={previousSkillMap} />
                </div>

                <div className="rounded-[34px] border border-black/[0.08] bg-[var(--ds-neutral-row)] p-5">
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-ds-ink">
                    <LineChart className="h-4 w-4" />
                    Сравнение по осям
                  </div>
                  <div className="mt-5 space-y-3">
                    {SKILL_LABELS.map((axis) => {
                      const currentValue = selectedSkillMap[axis.key]
                      const previousValue = previousSkillMap?.[axis.key] ?? 0
                      const delta = currentValue - previousValue

                      return (
                        <div
                          key={axis.key}
                          className="flex items-center justify-between rounded-[22px] border border-black/[0.06] bg-white px-4 py-3"
                        >
                          <div>
                            <p className="text-[14px] font-semibold text-ds-ink">{axis.label}</p>
                            <p className="mt-1 text-[13px] text-ds-text-secondary">
                              {previousValue > 0 ? `к прошлому уроку: ${formatDelta(delta)}` : "первая точка сравнения"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[20px] font-semibold text-ds-ink">{currentValue}</p>
                            <p
                              className={cn(
                                "text-[12px] font-semibold",
                                delta > 0 ? "text-[#2d9150]" : delta < 0 ? "text-[#a85c10]" : "text-ds-text-tertiary"
                              )}
                            >
                              {previousValue > 0 ? formatDelta(delta) : "новый"}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="pt-8">
            <div className="grid gap-6 xl:grid-cols-2">
              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">What you did well</h3>
                <div className="mt-5 space-y-4">
                  {feedback.positive.length > 0 ? (
                    feedback.positive.map((item, index) => (
                      <article
                        key={`${item}-${index}`}
                        className="rounded-[28px] border border-[#c9e7d3] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                      >
                        <div className="flex items-center gap-3 text-[14px] text-[#2d9150]">
                          <Sparkles className="h-4 w-4" />
                          <span>Сильная сторона</span>
                        </div>
                        <p className="mt-4 text-[17px] leading-8 text-ds-ink">{item}</p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                      После готового разбора здесь появятся конкретные моменты, которые у ученика уже получаются хорошо.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[22px] font-semibold text-ds-ink">What you can improve</h3>
                <div className="mt-5 space-y-4">
                  {feedback.improvement.length > 0 ? (
                    feedback.improvement.map((mistake, index) => (
                      <article
                        key={`${mistake.original}-${index}`}
                        className="rounded-[28px] border border-[#f0d7a6] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#a26a15]">
                          <CircleAlert className="h-4 w-4" />
                          <span>{mistake.type}</span>
                          <Badge variant="outline" className="border-[#f0d7a6] bg-[#fff8eb] text-[#a26a15]">
                            HSK {mistake.hsk_level}
                          </Badge>
                        </div>
                        <p className="mt-4 text-[17px] leading-8 text-ds-ink">{mistake.original}</p>
                        <p className="mt-3 text-[15px] leading-7 text-ds-text-secondary">
                          <span className="font-semibold text-ds-ink">Правильно:</span> {mistake.correction}
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-ds-text-secondary">{mistake.explanation}</p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                      Когда AI отчёт закончит разбор, здесь появятся спорные фразы, исправления и пояснения по ним.
                    </p>
                  )}
                </div>
              </section>

              <section className="xl:col-span-2">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#4c7fe6]" />
                  <h3 className="text-[22px] font-semibold text-ds-ink">Next focus</h3>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {selectedSession.recommendations.length > 0 ? (
                    selectedSession.recommendations.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-[24px] border border-[#cad7f9] bg-[#f3f7ff] px-5 py-4 text-[15px] leading-7 text-[#2d4d8c]"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                      Блок рекомендаций появится автоматически после финальной AI-обработки урока.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="vocabulary" className="pt-8">
            <div className="space-y-8">
              <section className="rounded-[30px] bg-[var(--ds-neutral-row)] px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#d9e8ff,#f7dbe9)]">
                      <Languages className="h-6 w-6 text-ds-ink" />
                    </div>
                    <div>
                      <h3 className="text-[22px] font-semibold text-ds-ink">Vocabulary</h3>
                      <p className="mt-2 max-w-[40rem] text-[15px] leading-7 text-ds-text-secondary">
                        Здесь собраны слова, фразы и языковые паттерны, которые AI вытащил из исправлений и тем этого урока.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-full border border-black px-5">
                    <Bookmark className="h-4 w-4" />
                    Сохранить слова ({vocabularyItems.length})
                  </Button>
                </div>
              </section>

              {vocabularyItems.length > 0 ? (
                <Accordion type="single" collapsible className="rounded-[30px] border border-black/[0.08] bg-white">
                  {vocabularyItems.map((item) => (
                    <AccordionItem key={item.id} value={item.id} className="px-5">
                      <AccordionTrigger className="py-5 hover:no-underline">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[#d6deee] bg-white">
                            <Volume2 className="h-5 w-5 text-[#4c7fe6]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="truncate text-[17px] font-semibold text-ds-ink">{item.phrase}</span>
                              {item.hskLevel ? (
                                <Badge variant="outline" className="border-black/[0.08] bg-[var(--ds-neutral-row)] text-ds-ink">
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
                <p className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                  Пока AI не собрал лексику для этого урока. После готового отчёта здесь появятся слова и фразы из разбора.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="practice" className="pt-8">
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-ds-text-tertiary" />
                  <h3 className="text-[22px] font-semibold text-ds-ink">Practice</h3>
                </div>
                <p className="mt-3 max-w-[50rem] text-[15px] leading-7 text-ds-text-secondary">
                  Это короткий список того, что полезно повторить после урока, пока материал ещё свежий.
                </p>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                {practiceItems.length > 0 ? (
                  practiceItems.map((item, index) => (
                    <article
                      key={item.id}
                      className="rounded-[30px] border border-black/[0.08] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]"
                    >
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
                                  <CheckCheck className="mt-1 h-4 w-4 shrink-0 text-ds-text-tertiary" />
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
                  <p className="rounded-[28px] border border-black/[0.06] bg-[var(--ds-neutral-row)] px-5 py-5 text-[15px] leading-7 text-ds-text-secondary">
                    После финальной AI-обработки здесь появятся упражнения и следующие шаги именно по этому уроку.
                  </p>
                )}
              </div>

              <section className="rounded-[30px] border border-black/[0.08] bg-[var(--ds-neutral-row)] p-5">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ds-ink">
                  <Mic className="h-4 w-4" />
                  Фрагменты для повторения вслух
                </div>
                {previewSegments.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {previewSegments.map((segment) => (
                      <div key={`${segment.sequence}-${segment.text}`} className="rounded-[22px] bg-white px-4 py-4">
                        <div className="flex items-start gap-3">
                          <TranscriptTone speakerRole={segment.speakerRole} />
                          <div>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary">
                              {segment.speakerLabel?.trim() || segment.speakerRole}
                            </p>
                            <p className="mt-2 text-[15px] leading-7 text-ds-ink">{segment.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-[15px] leading-7 text-ds-text-secondary">
                    После загрузки транскрипции сюда можно будет вернуться и повторить ключевые фразы вслух.
                  </p>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
