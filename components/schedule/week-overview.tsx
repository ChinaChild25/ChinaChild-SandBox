"use client"

import type { WeeklyTemplate, WeekdayKey } from "@/lib/teacher-availability-template"

const DAYS: Array<{ key: WeekdayKey; short: string; full: string }> = [
  { key: "monday", short: "Пн", full: "Понедельник" },
  { key: "tuesday", short: "Вт", full: "Вторник" },
  { key: "wednesday", short: "Ср", full: "Среда" },
  { key: "thursday", short: "Чт", full: "Четверг" },
  { key: "friday", short: "Пт", full: "Пятница" },
  { key: "saturday", short: "Сб", full: "Суббота" },
  { key: "sunday", short: "Вс", full: "Воскресенье" }
]

function summary(intervals: Array<{ start: string; end: string }>) {
  if (!intervals.length) return "Выходной"
  return intervals.map((i) => `${i.start}–${i.end}`).join(", ")
}

export function WeekOverview({
  template,
  dayStats,
  selectedDay,
  onSelectDay
}: {
  template: WeeklyTemplate
  dayStats: Record<WeekdayKey, { freeHours: number; bookedCount: number }>
  selectedDay: WeekdayKey
  onSelectDay: (day: WeekdayKey) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {DAYS.map((d) => {
        const intervals = template[d.key]
        const stats = dayStats[d.key]
        const active = selectedDay === d.key
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelectDay(d.key)}
            className={`rounded-[var(--ds-radius-xl)] border p-3 text-left transition ${
              active
                ? "border-ds-sage-strong bg-ds-sage/15"
                : "border-black/10 bg-ds-surface hover:bg-[var(--ds-neutral-row)] dark:border-white/10"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ds-ink">{d.short}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  intervals.length ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-700"
                }`}
              >
                {intervals.length ? "Рабочий" : "Выходной"}
              </span>
            </div>
            <p className="line-clamp-3 text-[12px] text-ds-text-secondary">{summary(intervals)}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-ds-text-tertiary">
              <span>Свободно: {stats.freeHours} ч</span>
              <span>Занято: {stats.bookedCount}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export const WEEK_OVERVIEW_DAYS = DAYS
