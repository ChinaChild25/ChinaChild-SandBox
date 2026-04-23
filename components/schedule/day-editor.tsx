"use client"

import { useState } from "react"
import { Timeline } from "@/components/schedule/timeline"
import {
  normalizeIntervals,
  type AvailabilityInterval
} from "@/lib/teacher-availability-template"

export function DayEditor({
  dayLabel,
  dayDateLabel,
  intervals,
  bookedHours,
  bookedEvents,
  conflictMessage,
  showNonCoreHours,
  onToggleNonCoreHours,
  onChangeIntervals,
  onSetWorking,
  onClear,
  onConflict,
  onOpenStudentCard,
  onRescheduleBooking
}: {
  dayLabel: string
  dayDateLabel: string
  intervals: AvailabilityInterval[]
  bookedHours: Set<number>
  bookedEvents: Array<{ hour: number; label: string; studentName: string }>
  conflictMessage: string | null
  showNonCoreHours: boolean
  onToggleNonCoreHours: () => void
  onChangeIntervals: (next: AvailabilityInterval[]) => void
  onSetWorking: (working: boolean) => void
  onClear: () => void
  onConflict: (message: string | null) => void
  onOpenStudentCard?: (studentId?: string | null) => void
  onRescheduleBooking?: (booking: { hour: number; label: string; studentName: string; studentId?: string | null }) => void
}) {
  const working = intervals.length > 0
  const [bookingMenu, setBookingMenu] = useState<{
    hour: number
    label: string
    studentName: string
    studentId?: string | null
  } | null>(null)

  return (
    <section className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface p-4 dark:border-white/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ds-ink">
            {dayLabel}, {dayDateLabel}
          </h2>
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
        bookedEvents={bookedEvents}
        showNonCoreHours={showNonCoreHours}
        onToggleNonCoreHours={onToggleNonCoreHours}
        onChange={(next) => {
          const normalized = normalizeIntervals(next)
          const hasConflict = Array.from(bookedHours).some((h) => {
            const inRange = normalized.some((i) => {
              const start = Number.parseInt(i.start.slice(0, 2), 10)
              const end = Number.parseInt(i.end.slice(0, 2), 10)
              return h >= start && h < end
            })
            return !inRange
          })
          if (hasConflict) {
            onConflict("В этом времени уже есть занятие")
            return
          }
          onConflict(null)
          onChangeIntervals(normalized)
        }}
        onConflict={(msg) => onConflict(msg)}
        onBookingClick={(booking) => setBookingMenu(booking)}
      />
      {conflictMessage ? (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          {conflictMessage}
        </div>
      ) : null}
      {bookingMenu ? (
        <div className="mt-2 rounded-md border border-black/10 bg-ds-surface p-2 shadow-sm dark:border-white/10">
          <p className="mb-2 text-[12px] font-medium text-ds-ink">
            {bookingMenu.studentName} — {bookingMenu.label}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ds-neutral-pill px-3 py-1 text-[12px]"
              onClick={() => onRescheduleBooking?.(bookingMenu)}
            >
              Перенести занятие
            </button>
            <button
              type="button"
              className="ds-neutral-pill px-3 py-1 text-[12px]"
              onClick={() => onOpenStudentCard?.(bookingMenu.studentId)}
            >
              Открыть карточку ученика
            </button>
            <button
              type="button"
              className="px-2 py-1 text-[12px] text-ds-text-secondary"
              onClick={() => setBookingMenu(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-1">
        <p className="text-[12px] font-medium text-ds-ink">Интервалы дня</p>
        {intervals.length === 0 ? (
          <p className="text-[12px] text-ds-text-secondary">День выходной.</p>
        ) : (
          intervals.map((i, idx) => (
            <div
              key={`${i.start}-${i.end}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-md border border-black/10 px-2 py-1.5 text-[12px] dark:border-white/10"
            >
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  step={3600}
                  value={i.start}
                  onChange={(e) =>
                    onChangeIntervals(
                      intervals.map((x, ix) => (ix === idx ? { ...x, start: e.target.value } : x))
                    )
                  }
                  className="rounded border border-black/10 bg-transparent px-1 py-0.5 text-[12px] dark:border-white/15"
                />
                <span>—</span>
                <input
                  type="time"
                  step={3600}
                  value={i.end}
                  onChange={(e) =>
                    onChangeIntervals(intervals.map((x, ix) => (ix === idx ? { ...x, end: e.target.value } : x)))
                  }
                  className="rounded border border-black/10 bg-transparent px-1 py-0.5 text-[12px] dark:border-white/15"
                />
              </div>
              <button
                type="button"
                className="text-[11px] text-destructive"
                onClick={() => onChangeIntervals(intervals.filter((_, ix) => ix !== idx))}
              >
                Удалить
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
