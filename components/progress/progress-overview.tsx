import type { LessonFeedItem, SkillMap, UiAccentKey } from "@/lib/lesson-analytics/server"
import { LessonFeed } from "@/components/progress/lesson-feed"
import { SkillRadarChart } from "@/components/progress/skill-radar-chart"
import { Badge } from "@/components/ui/badge"

type ProgressOverviewProps = {
  title: string
  subtitle: string
  current: SkillMap
  previous?: SkillMap | null
  sessions: LessonFeedItem[]
  accent?: UiAccentKey | null
}

const SKILL_LABELS: Array<{ key: keyof SkillMap; label: string }> = [
  { key: "speaking", label: "Говорение" },
  { key: "phrases", label: "Фразы" },
  { key: "vocabulary", label: "Лексика" },
  { key: "listening", label: "Аудирование" },
  { key: "grammar", label: "Грамматика" },
  { key: "reading", label: "Чтение" },
]

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

export function ProgressOverview({
  title,
  subtitle,
  current,
  previous,
  sessions,
  accent,
}: ProgressOverviewProps) {
  const latestSession = sessions[0] ?? null
  const readyReports = analyticsReadyCount(sessions)

  return (
    <div className="ds-figma-page font-[family:var(--ds-font-sans)]" data-progress-accent={accent ?? "sage"}>
      <div className="mx-auto w-full max-w-[min(100%,1460px)] space-y-6">
        <section className="overflow-hidden rounded-[40px] border border-black/[0.06] bg-[var(--ds-surface)]/95 px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-8 sm:py-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(340px,0.92fr)_minmax(0,1.08fr)] xl:items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-semibold text-ds-text-tertiary">
                  Успеваемость
                </p>
                <h1 className="mt-3 text-[30px] font-bold leading-[1.05] text-ds-ink sm:text-[42px]">{title}</h1>
                <p className="mt-4 max-w-[40rem] text-[15px] leading-7 text-ds-text-secondary">{subtitle}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-0 bg-[var(--ds-neutral-row)] px-3 py-1.5 text-[12px] font-semibold text-ds-ink shadow-none">
                  {readyReports} готовых разборов
                </Badge>
                <Badge variant="outline" className="rounded-full border-0 bg-[var(--ds-neutral-row)] px-3 py-1.5 text-[12px] font-semibold text-ds-ink shadow-none">
                  Последнее обновление: {formatCompactDate(latestSession?.endedAt ?? latestSession?.startedAt ?? null)}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {SKILL_LABELS.map((axis) => (
                  <div key={axis.key} className="rounded-[24px] bg-[var(--ds-neutral-row)] px-4 py-4 transition-transform duration-300 hover:-translate-y-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold text-ds-ink">{axis.label}</p>
                      <span className="text-[14px] font-semibold text-ds-ink">{current[axis.key]}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-ds-text-secondary">{levelLabel(current[axis.key])}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] bg-[linear-gradient(180deg,var(--progress-accent-surface),var(--progress-accent-secondary-soft))] p-4 sm:p-6">
              <SkillRadarChart current={current} previous={previous} mode="hero" />
            </div>
          </div>
        </section>

        <LessonFeed sessions={sessions} current={current} previous={previous} />
      </div>
    </div>
  )
}
