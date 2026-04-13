"use client"

import { useMemo, useRef, useState } from "react"
import {
  hhmmFromMinutes,
  minutesFromHHMM,
  normalizeIntervals,
  type AvailabilityInterval
} from "@/lib/teacher-availability-template"

const HOUR_HEIGHT = 24
const TOTAL_HOURS = 24
const TOTAL_HEIGHT = HOUR_HEIGHT * TOTAL_HOURS

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function Timeline({
  intervals,
  onChange,
  showNonCoreHours,
  onToggleNonCoreHours,
  bookedHours
}: {
  intervals: AvailabilityInterval[]
  onChange: (next: AvailabilityInterval[]) => void
  showNonCoreHours: boolean
  onToggleNonCoreHours: () => void
  bookedHours: Set<number>
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [dragStartHour, setDragStartHour] = useState<number | null>(null)
  const [dragEndHour, setDragEndHour] = useState<number | null>(null)

  const normalized = useMemo(() => normalizeIntervals(intervals), [intervals])

  const yToHour = (clientY: number) => {
    const root = rootRef.current
    if (!root) return 0
    const rect = root.getBoundingClientRect()
    const y = clamp(clientY - rect.top, 0, TOTAL_HEIGHT)
    return clamp(Math.floor(y / HOUR_HEIGHT), 0, 23)
  }

  const visibleHour = (hour: number) => showNonCoreHours || (hour >= 8 && hour < 20)

  return (
    <div className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface p-3 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-medium text-ds-ink">Таймлайн дня</p>
        <button
          type="button"
          className="text-[12px] text-ds-text-secondary underline underline-offset-2"
          onClick={onToggleNonCoreHours}
        >
          {showNonCoreHours ? "Скрыть ранние/поздние часы" : "Показать ранние/поздние часы"}
        </button>
      </div>

      <div
        ref={rootRef}
        className="relative overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
        style={{ height: TOTAL_HEIGHT }}
        onMouseDown={(e) => {
          const h = yToHour(e.clientY)
          if (bookedHours.has(h)) return
          setDragStartHour(h)
          setDragEndHour(h)
        }}
        onMouseMove={(e) => {
          if (dragStartHour === null) return
          setDragEndHour(yToHour(e.clientY))
        }}
        onMouseUp={() => {
          if (dragStartHour === null || dragEndHour === null) return
          const start = Math.min(dragStartHour, dragEndHour)
          const end = Math.max(dragStartHour, dragEndHour) + 1
          onChange(normalizeIntervals([...normalized, { start: hhmmFromMinutes(start * 60), end: hhmmFromMinutes(end * 60) }]))
          setDragStartHour(null)
          setDragEndHour(null)
        }}
        onMouseLeave={() => {
          if (dragStartHour === null) return
          setDragStartHour(null)
          setDragEndHour(null)
        }}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={`h-${hour}`}
            className={`absolute left-0 right-0 border-b border-black/8 text-[10px] ${visibleHour(hour) ? "" : "opacity-35"} ${
              hour >= 8 && hour < 20 ? "bg-ds-sage/10" : ""
            }`}
            style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          >
            <span className="absolute left-2 top-1 text-ds-text-tertiary">{String(hour).padStart(2, "0")}:00</span>
          </div>
        ))}

        {normalized.map((i, idx) => {
          const top = (minutesFromHHMM(i.start) / 60) * HOUR_HEIGHT
          const height = ((minutesFromHHMM(i.end) - minutesFromHHMM(i.start)) / 60) * HOUR_HEIGHT
          return (
            <div
              key={`${i.start}-${i.end}-${idx}`}
              className="absolute left-16 right-2 rounded-md border border-ds-sage-strong bg-ds-sage/45 px-2 py-1 text-[11px] text-ds-ink"
              style={{ top, height }}
            >
              <div className="flex items-center justify-between">
                <span>
                  {i.start}–{i.end}
                </span>
                <button
                  type="button"
                  className="text-[10px] text-ds-text-secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(normalized.filter((_, x) => x !== idx))
                  }}
                >
                  удалить
                </button>
              </div>
            </div>
          )
        })}

        {dragStartHour !== null && dragEndHour !== null ? (
          <div
            className="absolute left-16 right-2 rounded-md border border-ds-sage-strong bg-ds-sage/30"
            style={{
              top: Math.min(dragStartHour, dragEndHour) * HOUR_HEIGHT,
              height: (Math.abs(dragEndHour - dragStartHour) + 1) * HOUR_HEIGHT
            }}
          />
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-ds-text-tertiary">
        Потяните мышью по шкале, чтобы добавить интервал доступности.
      </p>
    </div>
  )
}
