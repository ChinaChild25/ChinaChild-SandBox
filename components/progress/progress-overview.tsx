import type { LessonFeedItem, SkillMap } from "@/lib/lesson-analytics/server"
import { LessonFeed } from "@/components/progress/lesson-feed"
import { SkillRadarChart } from "@/components/progress/skill-radar-chart"

type ProgressOverviewProps = {
  title: string
  subtitle: string
  current: SkillMap
  previous?: SkillMap | null
  sessions: LessonFeedItem[]
}

function formatCompactDate(value: string | null): string {
  if (!value) return "Пока нет"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Пока нет"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date)
}

function averageSessionScore(sessions: LessonFeedItem[]): number | null {
  const scores = sessions.map((session) => session.averageScore).filter((value): value is number => value !== null)
  if (scores.length === 0) return null
  return Math.round(scores.reduce((total, value) => total + value, 0) / scores.length)
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

function HeroStat({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-[24px] bg-white/[0.78] px-4 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.04] backdrop-blur dark:bg-white/[0.06] dark:ring-white/[0.06]">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ds-text-tertiary">{label}</p>
      <p className="mt-3 text-[30px] font-semibold leading-none text-ds-ink dark:text-white">{value}</p>
      <p className="mt-2 text-[13px] leading-6 text-ds-text-secondary dark:text-white/[0.68]">{description}</p>
    </div>
  )
}

export function ProgressOverview({
  title,
  subtitle,
  current,
  previous,
  sessions,
}: ProgressOverviewProps) {
  const completedReports = analyticsReadyCount(sessions)
  const averageScore = averageSessionScore(sessions)
  const lastSession = sessions[0] ?? null

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,1440px)] space-y-6">
        <section className="overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,rgba(245,197,66,0.12),rgba(147,197,253,0.18),rgba(255,255,255,0.94))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05] dark:bg-[linear-gradient(135deg,rgba(245,197,66,0.08),rgba(147,197,253,0.12),rgba(20,20,24,0.95))] dark:ring-white/[0.06] sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">Успеваемость</p>
                <h1 className="mt-3 text-[34px] font-bold leading-[1.02] text-ds-ink dark:text-white sm:text-[48px]">
                  {title}
                </h1>
                <p className="mt-4 max-w-[42rem] text-[15px] leading-7 text-ds-text-secondary dark:text-white/[0.70]">
                  {subtitle}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroStat
                  label="Разобрано"
                  value={String(completedReports)}
                  description="уроков уже превратились в AI-отчёты с ошибками, рекомендациями и темами"
                />
                <HeroStat
                  label="Средний балл"
                  value={averageScore !== null ? String(averageScore) : "—"}
                  description="среднее по грамматике, словарю и беглости из последних готовых разборов"
                />
                <HeroStat
                  label="Последний урок"
                  value={formatCompactDate(lastSession?.endedAt ?? lastSession?.startedAt ?? null)}
                  description="карта обновляется после каждого нового live-занятия и последующей обработки"
                />
              </div>
            </div>

            <div className="rounded-[30px] bg-white/[0.72] p-3 ring-1 ring-black/[0.04] backdrop-blur dark:bg-white/[0.04] dark:ring-white/[0.06] sm:p-5">
              <SkillRadarChart current={current} previous={previous} />
            </div>
          </div>
        </section>

        <LessonFeed sessions={sessions} />
      </div>
    </div>
  )
}
