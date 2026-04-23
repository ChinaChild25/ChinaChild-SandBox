import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"

/**
 * Календарные date_key / time урока в часовом поясе школы.
 * При наличии `slot_at` он единственный источник истины (как в API external-lesson):
 * клиентские date_key/time могут расходиться с таймзоной просмотра.
 */
export function lessonWallKeysFromBody(lesson: {
  slot_at?: string | null
  date_key?: string | null
  time?: string | null
}): { dateKey: string; time: string } {
  if (lesson.slot_at?.trim()) {
    const w = wallClockFromSlotAt(lesson.slot_at)
    return { dateKey: w.dateKey, time: normalizeScheduleSlotTime(w.time) }
  }
  const dk = lesson.date_key?.trim()
  const tt = lesson.time?.trim()
  if (dk && tt) return { dateKey: dk, time: normalizeScheduleSlotTime(tt) }
  return { dateKey: "1970-01-01", time: "00:00" }
}
