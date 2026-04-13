"use client"

import { useMemo, useRef, useState } from "react"
import {
  hhmmFromMinutes,
  minutesFromHHMM,
  normalizeIntervals,
  type AvailabilityInterval
} from "@/lib/teacher-availability-template"
import { AvailabilityLayer } from "@/components/schedule/availability-layer"
import { BookingBlock } from "@/components/schedule/booking-block"

const HOUR_HEIGHT = 24
const TOTAL_HEIGHT = HOUR_HEIGHT * 24

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

type DragAction =
  | { type: "create"; startHour: number }
  | { type: "move"; index: number; startHour: number; originStart: number; originEnd: number }
  | { type: "resize-start"; index: number; originEnd: number }
  | { type: "resize-end"; index: number; originStart: number }

export function Timeline({
  intervals,
  onChange,
  showNonCoreHours,
  onToggleNonCoreHours,
  bookedHours,
  bookedEvents,
  onConflict,
  onBookingClick
}: {
  intervals: AvailabilityInterval[]
  onChange: (next: AvailabilityInterval[]) => void
  showNonCoreHours: boolean
  onToggleNonCoreHours: () => void
  bookedHours: Set<number>
  bookedEvents: Array<{ hour: number; label: string; studentName: string; studentId?: string | null }>
  onConflict: (message: string) => void
  onBookingClick?: (booking: { hour: number; label: string; studentName: string; studentId?: string | null }) => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [dragAction, setDragAction] = useState<DragAction | null>(null)
  const [dragCurrentHour, setDragCurrentHour] = useState<number | null>(null)

  const normalized = useMemo(() => normalizeIntervals(intervals), [intervals])

  const yToHour = (clientY: number) => {
    const root = rootRef.current
    if (!root) return 0
    const rect = root.getBoundingClientRect()
    const y = clamp(clientY - rect.top, 0, TOTAL_HEIGHT)
    return clamp(Math.floor(y / HOUR_HEIGHT), 0, 23)
  }

  const visibleHour = (hour: number) => showNonCoreHours || (hour >= 8 && hour < 20)

  const isBookedInRange = (startHour: number, endHour: number) => {
    for (let h = startHour; h < endHour; h++) {
      if (bookedHours.has(h)) return true
    }
    return false
  }

  const applyDrag = () => {
    if (!dragAction || dragCurrentHour == null) return
    if (dragAction.type === "create") {
      const start = Math.min(dragAction.startHour, dragCurrentHour)
      const end = Math.max(dragAction.startHour, dragCurrentHour) + 1
      if (isBookedInRange(start, end)) {
        onConflict("В этом времени уже есть занятие")
        return
      }
      onConflict("")
      onChange(normalizeIntervals([...normalized, { start: hhmmFromMinutes(start * 60), end: hhmmFromMinutes(end * 60) }]))
      return
    }

    if (dragAction.type === "move") {
      const duration = dragAction.originEnd - dragAction.originStart
      const delta = dragCurrentHour - dragAction.startHour
      const nextStart = clamp(dragAction.originStart + delta, 0, 24 - duration)
      const nextEnd = nextStart + duration
      if (isBookedInRange(nextStart, nextEnd)) {
        onConflict("В этом времени уже есть занятие")
        return
      }
      onConflict("")
      const next = normalized.map((i, idx) =>
        idx === dragAction.index
          ? { start: hhmmFromMinutes(nextStart * 60), end: hhmmFromMinutes(nextEnd * 60) }
          : i
      )
      onChange(normalizeIntervals(next))
      return
    }

    if (dragAction.type === "resize-start") {
      const nextStart = clamp(Math.min(dragCurrentHour, dragAction.originEnd - 1), 0, 23)
      if (isBookedInRange(nextStart, dragAction.originEnd)) {
        onConflict("В этом времени уже есть занятие")
        return
      }
      onConflict("")
      const next = normalized.map((i, idx) =>
        idx === dragAction.index
          ? { start: hhmmFromMinutes(nextStart * 60), end: hhmmFromMinutes(dragAction.originEnd * 60) }
          : i
      )
      onChange(normalizeIntervals(next))
      return
    }

    const nextEnd = clamp(Math.max(dragCurrentHour + 1, dragAction.originStart + 1), dragAction.originStart + 1, 24)
    if (isBookedInRange(dragAction.originStart, nextEnd)) {
      onConflict("В этом времени уже есть занятие")
      return
    }
    onConflict("")
    const next = normalized.map((i, idx) =>
      idx === dragAction.index
        ? { start: hhmmFromMinutes(dragAction.originStart * 60), end: hhmmFromMinutes(nextEnd * 60) }
        : i
    )
    onChange(normalizeIntervals(next))
  }

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
          setDragAction({ type: "create", startHour: h })
          setDragCurrentHour(h)
        }}
        onMouseMove={(e) => {
          if (!dragAction) return
          setDragCurrentHour(yToHour(e.clientY))
        }}
        onMouseUp={() => {
          applyDrag()
          setDragAction(null)
          setDragCurrentHour(null)
        }}
        onMouseLeave={() => {
          if (!dragAction) return
          applyDrag()
          setDragAction(null)
          setDragCurrentHour(null)
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

        <AvailabilityLayer intervals={normalized} hourHeight={HOUR_HEIGHT} />
        {normalized.map((i, idx) => {
          const top = (minutesFromHHMM(i.start) / 60) * HOUR_HEIGHT
          const height = ((minutesFromHHMM(i.end) - minutesFromHHMM(i.start)) / 60) * HOUR_HEIGHT
          const startHour = minutesFromHHMM(i.start) / 60
          const endHour = minutesFromHHMM(i.end) / 60
          return (
            <div
              key={`drag-${i.start}-${i.end}-${idx}`}
              className="absolute left-16 right-2 z-10 cursor-move"
              style={{ top, height }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setDragAction({
                  type: "move",
                  index: idx,
                  startHour: yToHour(e.clientY),
                  originStart: startHour,
                  originEnd: endHour
                })
                setDragCurrentHour(yToHour(e.clientY))
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-2 cursor-ns-resize rounded-t-md bg-ds-sage-strong/50"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setDragAction({ type: "resize-start", index: idx, originEnd: endHour })
                  setDragCurrentHour(yToHour(e.clientY))
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize rounded-b-md bg-ds-sage-strong/50"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setDragAction({ type: "resize-end", index: idx, originStart: startHour })
                  setDragCurrentHour(yToHour(e.clientY))
                }}
              />
            </div>
          )
        })}
        {bookedEvents.map((b) => (
          <BookingBlock
            key={`booked-${b.hour}-${b.studentName}`}
            studentName={b.studentName}
            hourLabel={b.label}
            top={b.hour * HOUR_HEIGHT + 1}
            height={HOUR_HEIGHT - 2}
            onClick={() => onBookingClick?.(b)}
          />
        ))}

        {dragAction?.type === "create" && dragCurrentHour !== null ? (
          <div
            className="absolute left-16 right-2 rounded-md border border-ds-sage-strong bg-ds-sage/30"
            style={{
              top: Math.min(dragAction.startHour, dragCurrentHour) * HOUR_HEIGHT,
              height: (Math.abs(dragCurrentHour - dragAction.startHour) + 1) * HOUR_HEIGHT
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
