"use client"

import { startTransition, useState } from "react"
import type { LessonFeedItem, SkillMap, UiAccentKey } from "@/lib/lesson-analytics/server"
import { placeholderImages } from "@/lib/placeholders"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LessonFeed } from "@/components/progress/lesson-feed"
import { SkillRadarChart } from "@/components/progress/skill-radar-chart"

type ProgressOverviewProps = {
  title: string
  subtitle: string
  current: SkillMap
  previous?: SkillMap | null
  sessions: LessonFeedItem[]
  accent?: UiAccentKey | null
  studentName?: string | null
  studentAvatarUrl?: string | null
}

type RangeValue = "1m" | "3m" | "6m"

const RANGE_OPTIONS: Array<{ value: RangeValue; label: string; months: number }> = [
  { value: "1m", label: "1 мес", months: 1 },
  { value: "3m", label: "3 мес", months: 3 },
  { value: "6m", label: "6 мес", months: 6 },
]

const SKILL_LABELS: Array<{ key: keyof SkillMap; label: string }> = [
  { key: "speaking", label: "Говорение" },
  { key: "phrases", label: "Фразы" },
  { key: "vocabulary", label: "Лексика" },
  { key: "listening", label: "Аудирование" },
  { key: "grammar", label: "Грамматика" },
  { key: "reading", label: "Чтение" },
]

const SKILL_AXES = {
  speaking: ["speaking", "pronunciation", "tones", "fluency"],
  phrases: ["phrases", "chengyu", "expressions", "patterns"],
  vocabulary: ["vocabulary", "words", "characters", "hanzi"],
  listening: ["listening", "comprehension"],
  grammar: ["grammar", "particles", "measure_words", "ba_sentence"],
  reading: ["reading", "pinyin"],
} as const

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

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function hasSkillMapData(skillMap: SkillMap | null | undefined): boolean {
  if (!skillMap) return false
  return Object.values(skillMap).some((value) => value > 0)
}

function analyticsReadyCount(sessions: LessonFeedItem[]): number {
  return sessions.filter(
    (session) =>
      Boolean(session.summary?.trim()) ||
      session.mistakes.length > 0 ||
      session.strengths.length > 0 ||
      session.recommendations.length > 0 ||
      session.topicsPracticed.length > 0
  ).length
}

function formatCompactDate(value: string | null): string {
  if (!value) return "без даты"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "без даты"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(date)
}

function levelLabel(value: number): string {
  if (value >= 75) return "сильная зона"
  if (value >= 45) return "растёт"
  if (value > 0) return "нужно подтянуть"
  return "ещё нет данных"
}

function initials(name: string | null | undefined): string {
  const cleaned = (name ?? "").trim()
  if (!cleaned) return "У"

  return cleaned
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
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

function hasSessionSkillSignal(session: LessonFeedItem): boolean {
  return (
    session.grammarScore !== null ||
    session.vocabularyScore !== null ||
    session.fluencyScore !== null ||
    session.speakingRatio !== null ||
    session.topicsPracticed.length > 0
  )
}

function sessionTimestamp(session: LessonFeedItem): number | null {
  const value = session.endedAt ?? session.startedAt
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function filterSessionsByMonths(sessions: LessonFeedItem[], months: number): LessonFeedItem[] {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffMs = cutoff.getTime()

  return sessions.filter((session) => {
    const timestamp = sessionTimestamp(session)
    return timestamp !== null && timestamp >= cutoffMs
  })
}

export function ProgressOverview({
  title,
  subtitle,
  current,
  previous,
  sessions,
  accent,
  studentName,
  studentAvatarUrl,
}: ProgressOverviewProps) {
  const [selectedRange, setSelectedRange] = useState<RangeValue>("1m")

  const latestSession = sessions[0] ?? null
  const readyReports = analyticsReadyCount(sessions)
  const fallbackStudentName = studentName?.trim() || latestSession?.studentName?.trim() || "Ученик"
  const fallbackStudentAvatar = studentAvatarUrl?.trim() || latestSession?.studentAvatarUrl?.trim() || placeholderImages.studentAvatar

  const analyticsSessions = sessions.filter(hasSessionSkillSignal)
  const selectedRangeConfig = RANGE_OPTIONS.find((option) => option.value === selectedRange) ?? RANGE_OPTIONS[0]
  const rangeSessions = filterSessionsByMonths(analyticsSessions, selectedRangeConfig.months)
  const scopedSessions = rangeSessions.length > 0 ? rangeSessions : analyticsSessions

  const rangeCurrentSession = scopedSessions[0] ?? null
  const rangeBaselineSession = scopedSessions.length > 1 ? scopedSessions[scopedSessions.length - 1] : null
  const heroCurrent = rangeCurrentSession ? buildSkillMapFromSession(rangeCurrentSession) : current
  const heroPrevious = rangeBaselineSession
    ? buildSkillMapFromSession(rangeBaselineSession)
    : previous ?? null
  const heroHasComparison = hasSkillMapData(heroPrevious)
  const showingFallbackRange = rangeSessions.length === 0 && analyticsSessions.length > 0

  return (
    <div className="ds-figma-page font-[family:var(--ds-font-sans)]" data-progress-accent={accent ?? "sage"}>
      <div className="mx-auto w-full max-w-[min(100%,1460px)] space-y-6">
        <section className="overflow-hidden rounded-[40px] border border-black/[0.06] bg-[var(--ds-surface)]/95 px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-8 sm:py-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(340px,0.92fr)_minmax(0,1.08fr)] xl:items-center">
            <div className="order-2 space-y-6 xl:order-1">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar className="h-14 w-14 ring-1 ring-black/[0.06] dark:ring-white/10">
                  <AvatarImage src={fallbackStudentAvatar} alt={fallbackStudentName} className="object-cover" />
                  <AvatarFallback className="bg-[var(--ds-neutral-row)] text-[14px] font-semibold text-ds-ink">
                    {initials(fallbackStudentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ds-text-tertiary">Успеваемость</p>
                  <p className="truncate text-[18px] font-semibold text-ds-ink">{fallbackStudentName}</p>
                </div>
              </div>

              <div>
                <h1 className="text-[30px] font-bold leading-[1.05] text-ds-ink sm:text-[42px]">{title}</h1>
                <p className="mt-4 max-w-[40rem] text-[15px] leading-7 text-ds-text-secondary">{subtitle}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-0 bg-[var(--ds-neutral-row)] px-3 py-1.5 text-[12px] font-semibold text-ds-ink shadow-none"
                >
                  {readyReports} готовых разборов
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-0 bg-[var(--ds-neutral-row)] px-3 py-1.5 text-[12px] font-semibold text-ds-ink shadow-none"
                >
                  Последнее обновление: {formatCompactDate(latestSession?.endedAt ?? latestSession?.startedAt ?? null)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => {
                  const active = option.value === selectedRange

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => startTransition(() => setSelectedRange(option.value))}
                      className={[
                        "inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold transition-all duration-200",
                        active
                          ? "bg-[#111111] text-white shadow-[0_12px_24px_rgba(15,23,42,0.12)] dark:bg-white dark:text-[#141414]"
                          : "bg-[var(--ds-neutral-row)] text-ds-text-secondary hover:-translate-y-0.5 hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-ink",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {SKILL_LABELS.map((axis) => (
                  <div
                    key={axis.key}
                    className="rounded-[24px] bg-[var(--ds-neutral-row)] px-4 py-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold text-ds-ink">{axis.label}</p>
                      <span className="text-[14px] font-semibold text-ds-ink">{heroCurrent[axis.key]}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-ds-text-secondary">{levelLabel(heroCurrent[axis.key])}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 rounded-[34px] bg-[linear-gradient(180deg,var(--progress-accent-surface),var(--progress-accent-secondary-soft))] p-4 sm:p-6 xl:order-2">
              <SkillRadarChart current={heroCurrent} previous={heroPrevious} mode="hero" />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 text-[13px] text-ds-text-secondary">
                <span>Карта развития за {selectedRangeConfig.label.toLowerCase()}</span>
                <span>
                  {heroHasComparison ? "Сравнение с началом периода" : "Первая точка сравнения"}
                </span>
              </div>

              {showingFallbackRange ? (
                <p className="mt-3 px-2 text-[13px] leading-6 text-ds-text-secondary">
                  За выбранный период новых уроков пока нет, поэтому сверху показан последний доступный срез.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <LessonFeed sessions={sessions} current={heroCurrent} previous={heroPrevious} accent={accent} />
      </div>
    </div>
  )
}
