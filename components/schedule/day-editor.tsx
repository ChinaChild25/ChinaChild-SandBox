"use client"

import { Timeline } from "@/components/schedule/timeline"
import {
  normalizeIntervals,
  type AvailabilityInterval
} from "@/lib/teacher-availability-template"

export function DayEditor({
  dayLabel,
  intervals,
  bookedHours,
  showNonCoreHours,
  onToggleNonCoreHours,
  onChangeIntervals,
  onSetWorking,
  onClear
}: {
  dayLabel: string
  intervals: AvailabilityInterval[]
  bookedHours: Set<number>
  showNonCoreHours: boolean
  onToggleNonCoreHours: () => void
  onChangeIntervals: (next: AvailabilityInterval[]) => void
  onSetWorking: (working: boolean) => void
  onClear: () => void
}) {
  const working = intervals.length > 0

  return (
    <section className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface p-4 dark:border-white/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ds-ink">{dayLabel}</h2>
          <p className="text-[12px] text-ds-text-secondary">Редактирование через интервалы</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ds-neutral-pill px-3 py-1.5 text-[12px]"
            onClick={() => onSetWorking(!working)}
          >
            {working ? "Сделать выходным" : "Сделать рабочим"}
          </button>
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={onClear}>
            Очистить день
          </button>
        </div>
      </div>

      <Timeline
        intervals={intervals}
        bookedHours={bookedHours}
        showNonCoreHours={showNonCoreHours}
        onToggleNonCoreHours={onToggleNonCoreHours}
        onChange={(next) => onChangeIntervals(normalizeIntervals(next))}
      />

      <div className="mt-3 space-y-1">
        <p className="text-[12px] font-medium text-ds-ink">Интервалы дня</p>
        {intervals.length === 0 ? (
          <p className="text-[12px] text-ds-text-secondary">День выходной.</p>
        ) : (
          intervals.map((i, idx) => (
            <div key={`${i.start}-${i.end}-${idx}`} className="rounded-md border border-black/10 px-2 py-1.5 text-[12px] dark:border-white/10">
              {i.start}–{i.end}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
