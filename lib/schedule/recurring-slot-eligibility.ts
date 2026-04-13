import { addDaysToDateKey, firstRecurringSlotDateKey, mondayDateKeyOfWeekContaining } from "./calendar-ymd"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "./slot-time"

/** Момент начала первого слота по правилам create-event (может быть в прошлом). */
export function firstScheduledSlotInstantMs(
  startYmd: string,
  weekdays: number[],
  weeks: number,
  timeHHMM: string,
  timeZone: string
): number | null {
  if (weekdays.length === 0) return null
  const firstKey = firstRecurringSlotDateKey(startYmd, weekdays, weeks)
  if (!firstKey) return null
  const wallTime = normalizeScheduleSlotTime(timeHHMM)
  const iso = wallClockSlotAtIso(firstKey, wallTime, timeZone)
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

export function isFirstScheduledSlotInPast(
  startYmd: string,
  weekdays: number[],
  weeks: number,
  hour: number,
  timeZone: string,
  nowMs: number = Date.now()
): boolean {
  const wallTime = normalizeScheduleSlotTime(`${String(hour).padStart(2, "0")}:00`)
  const ms = firstScheduledSlotInstantMs(startYmd, weekdays, weeks, wallTime, timeZone)
  return ms !== null && ms < nowMs
}

/**
 * Минимальная дата YYYY-MM-DD (как в API), с которой первый же слот по шаблону ещё не наступил
 * в `timeZone` для `wallTime`.
 */
export function nextEligibleStartDateKey(
  startYmd: string,
  weekdays: number[],
  timeHHMM: string,
  timeZone: string,
  nowMs: number = Date.now()
): string | null {
  const wallTime = normalizeScheduleSlotTime(timeHHMM)
  const weekMonday = mondayDateKeyOfWeekContaining(startYmd)
  const days = [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
  if (days.length === 0) return null
  let bestMs = Infinity
  let bestKey: string | null = null
  for (let week = 0; week < 52; week++) {
    for (const dayOfWeek of days) {
      const mondayBasedIndex = (dayOfWeek + 6) % 7
      const dateKey = addDaysToDateKey(weekMonday, week * 7 + mondayBasedIndex)
      if (dateKey < startYmd) continue
      const slotMs = new Date(wallClockSlotAtIso(dateKey, wallTime, timeZone)).getTime()
      if (!Number.isNaN(slotMs) && slotMs >= nowMs && slotMs < bestMs) {
        bestMs = slotMs
        bestKey = dateKey
      }
    }
  }
  return bestKey
}
