"use client"

import { useMemo } from "react"
import { BarChart3, Clock3, MessageSquareText, Sparkles } from "lucide-react"
import type { LatestLessonReport } from "@/lib/lesson-analytics/server"

type LessonAnalyticsCardProps = {
  report: LatestLessonReport
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function statusCopy(status: LatestLessonReport["status"]) {
  if (status === "done") {
    return {
      label: "Отчёт готов",
      tone: "bg-[#edf7ef] text-[#21693f] dark:bg-[#163021] dark:text-[#b7f2c8]",
    }
  }

  if (status === "processing" || status === "awaiting_artifacts") {
    return {
      label: "Разбор готовится",
      tone: "bg-[#f7f1e6] text-[#8f5b11] dark:bg-[#322615] dark:text-[#ffd692]",
    }
  }

  if (status === "failed") {
    return {
      label: "Разбор не завершился",
      tone: "bg-[#fff1f2] text-[#a4384a] dark:bg-[#311b20] dark:text-[#ffb3bf]",
    }
  }

  return {
    label: "Сессия активна",
    tone: "bg-[#eef3ff] text-[#3558a8] dark:bg-[#1b2436] dark:text-[#b8c9ff]",
  }
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[18px] bg-black/[0.035] px-4 py-3 dark:bg-white/[0.06]">
      <p className="text-[12px] font-medium text-ds-text-tertiary dark:text-white/45">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ds-ink dark:text-white">{value ?? "—"}</p>
    </div>
  )
}

export function LessonAnalyticsCard({ report }: LessonAnalyticsCardProps) {
  const status = useMemo(() => statusCopy(report.status), [report.status])
  const startedAt = formatDateTime(report.startedAt)
  const endedAt = formatDateTime(report.endedAt)
  const transcriptPreview = report.transcriptPreview.slice(-4)

  return (
    <section className="mb-6 rounded-[32px] bg-[rgba(255,255,255,0.98)] p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05] backdrop-blur-xl dark:bg-[#171717]/96 dark:ring-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-medium text-ds-text-tertiary dark:text-white/45">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Последний live-разбор
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-ds-ink dark:text-white">Аналитика занятия</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ds-text-secondary dark:text-white/62">
            {report.summary?.trim() || "Как только обработка завершится, здесь появятся сильные стороны, ошибки и персональные рекомендации по уроку."}
          </p>
        </div>

        <div className={`inline-flex rounded-full px-3 py-2 text-sm font-semibold ${status.tone}`}>{status.label}</div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-sm text-ds-text-secondary dark:text-white/62">
        {startedAt ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.035] px-3 py-2 dark:bg-white/[0.06]">
            <Clock3 className="h-4 w-4" aria-hidden />
            Начало: {startedAt}
          </span>
        ) : null}
        {endedAt ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.035] px-3 py-2 dark:bg-white/[0.06]">
            <Clock3 className="h-4 w-4" aria-hidden />
            Конец: {endedAt}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ScorePill label="Грамматика" value={report.grammarScore} />
        <ScorePill label="Словарь" value={report.vocabularyScore} />
        <ScorePill label="Беглость речи" value={report.fluencyScore} />
      </div>

      {report.strengths.length > 0 ? (
        <div className="mt-5 rounded-[24px] bg-black/[0.035] p-4 dark:bg-white/[0.06]">
          <div className="flex items-center gap-2 text-sm font-semibold text-ds-ink dark:text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
            Что уже получается
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.strengths.map((item) => (
              <span
                key={item}
                className="rounded-full bg-white px-3 py-2 text-sm text-ds-ink ring-1 ring-black/[0.05] dark:bg-white/[0.08] dark:text-white dark:ring-white/[0.06]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[24px] bg-black/[0.035] p-4 dark:bg-white/[0.06]">
          <div className="flex items-center gap-2 text-sm font-semibold text-ds-ink dark:text-white">
            <MessageSquareText className="h-4 w-4" aria-hidden />
            Ключевые ошибки
          </div>
          {report.mistakes.length > 0 ? (
            <div className="mt-3 space-y-3">
              {report.mistakes.slice(0, 3).map((mistake, index) => (
                <div key={`${mistake.original}-${index}`} className="rounded-[18px] bg-white px-4 py-3 ring-1 ring-black/[0.05] dark:bg-white/[0.05] dark:ring-white/[0.06]">
                  <p className="text-sm font-semibold text-ds-ink dark:text-white">{mistake.original}</p>
                  <p className="mt-1 text-sm text-ds-text-secondary dark:text-white/68">Правильно: {mistake.correction}</p>
                  <p className="mt-2 text-sm leading-6 text-ds-text-secondary dark:text-white/62">{mistake.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-ds-text-secondary dark:text-white/62">
              Ошибки пока не собраны или разбор ещё не завершён.
            </p>
          )}
        </div>

        <div className="rounded-[24px] bg-black/[0.035] p-4 dark:bg-white/[0.06]">
          <p className="text-sm font-semibold text-ds-ink dark:text-white">Что тренировать дальше</p>
          {report.recommendations.length > 0 ? (
            <div className="mt-3 space-y-2">
              {report.recommendations.map((item) => (
                <p
                  key={item}
                  className="rounded-[18px] bg-white px-4 py-3 text-sm leading-6 text-ds-text-secondary ring-1 ring-black/[0.05] dark:bg-white/[0.05] dark:text-white/68 dark:ring-white/[0.06]"
                >
                  {item}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-ds-text-secondary dark:text-white/62">
              После обработки здесь появятся персональные рекомендации на следующий урок.
            </p>
          )}

          {report.topicsPracticed.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.topicsPracticed.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ds-ink ring-1 ring-black/[0.05] dark:bg-white/[0.08] dark:text-white dark:ring-white/[0.06]"
                >
                  {topic}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {transcriptPreview.length > 0 ? (
        <div className="mt-5 rounded-[24px] bg-black/[0.035] p-4 dark:bg-white/[0.06]">
          <p className="text-sm font-semibold text-ds-ink dark:text-white">Фрагменты транскрипта</p>
          <div className="mt-3 space-y-2">
            {transcriptPreview.map((row, index) => (
              <div
                key={`${row.text}-${index}`}
                className="rounded-[18px] bg-white px-4 py-3 text-sm leading-6 text-ds-text-secondary ring-1 ring-black/[0.05] dark:bg-white/[0.05] dark:text-white/68 dark:ring-white/[0.06]"
              >
                <span className="font-semibold text-ds-ink dark:text-white">
                  {row.speakerLabel?.trim() || row.speakerRole}:
                </span>{" "}
                {row.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
