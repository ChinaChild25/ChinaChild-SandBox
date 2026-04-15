import { addDaysToDateKey, firstRecurringSlotDateKey, mondayDateKeyOfWeekContaining } from "./calendar-ymd"
import { normalizeScheduleSlotTime } from "./slot-time"

/** Первая дата YYYY-MM-DD по шаблону create-event (может быть в прошлом). */
export function firstScheduledSlotDateKey(
  startYmd: string,
  weekdays: number[],
  weeks: number
): string | null {
  if (weekdays.length === 0) return null
  return firstRecurringSlotDateKey(startYmd, weekdays, weeks)
}

export function isFirstScheduledSlotInPast(
  startYmd: string,
  weekdays: number[],
  weeks: number,
  hour: number,
  nowDateKey: string,
  nowTimeHHMM: string
): boolean {
  const firstKey = firstScheduledSlotDateKey(startYmd, weekdays, weeks)
  if (!firstKey) return false
  const nowTime = normalizeScheduleSlotTime(nowTimeHHMM)
  const wallTime = normalizeScheduleSlotTime(`${String(hour).padStart(2, "0")}:00`)
  return `${firstKey}T${wallTime}` < `${nowDateKey}T${nowTime}`
}

/**
 * Минимальная дата YYYY-MM-DD (как в API), с которой первый же слот по шаблону ещё не наступил
 * по локальному wall-clock (без преобразования таймзон) для `wallTime`.
 */
export function nextEligibleStartDateKey(
  startYmd: string,
  weekdays: number[],
  timeHHMM: string,
  nowDateKey: string,
  nowTimeHHMM: string
): string | null {
  const wallTime = normalizeScheduleSlotTime(timeHHMM)
  const nowTime = normalizeScheduleSlotTime(nowTimeHHMM)
  const weekMonday = mondayDateKeyOfWeekContaining(startYmd)
  const days = [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
  if (days.length === 0) return null
  for (let week = 0; week < 52; week++) {
    for (const dayOfWeek of days) {
      const mondayBasedIndex = (dayOfWeek + 6) % 7
      const dateKey = addDaysToDateKey(weekMonday, week * 7 + mondayBasedIndex)
      if (dateKey < startYmd) continue
      if (`${dateKey}T${wallTime}` >= `${nowDateKey}T${nowTime}`) return dateKey
    }
  }
  return null
}
