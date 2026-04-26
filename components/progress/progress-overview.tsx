import type { LessonFeedItem, SkillMap } from "@/lib/lesson-analytics/server"
import { LessonFeed } from "@/components/progress/lesson-feed"

type ProgressOverviewProps = {
  title: string
  subtitle: string
  current: SkillMap
  previous?: SkillMap | null
  sessions: LessonFeedItem[]
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

export function ProgressOverview({
  title,
  subtitle,
  current,
  previous,
  sessions,
}: ProgressOverviewProps) {
  const latestSession = sessions[0] ?? null
  const readyReports = analyticsReadyCount(sessions)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,1460px)] space-y-5">
        <section className="flex flex-col gap-4 rounded-[34px] border border-black/[0.06] bg-white/[0.94] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[54rem]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                Lesson Insights
              </p>
              <h1 className="mt-3 text-[32px] font-bold leading-[1.02] text-ds-ink sm:text-[46px]">{title}</h1>
              <p className="mt-4 text-[15px] leading-7 text-ds-text-secondary">{subtitle}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-full border border-black/[0.06] bg-[var(--ds-neutral-row)] px-4 py-3 text-sm text-ds-text-secondary">
                <span className="font-semibold text-ds-ink">{readyReports}</span> готовых отчётов
              </div>
              <div className="rounded-full border border-black/[0.06] bg-[var(--ds-neutral-row)] px-4 py-3 text-sm text-ds-text-secondary">
                Последний урок:{" "}
                <span className="font-semibold text-ds-ink">
                  {formatCompactDate(latestSession?.endedAt ?? latestSession?.startedAt ?? null)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <LessonFeed sessions={sessions} current={current} previous={previous} />
      </div>
    </div>
  )
}
