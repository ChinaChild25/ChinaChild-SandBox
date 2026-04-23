/** Арифметика календарных дат YYYY-MM-DD в UTC, без «локали сервера» на слотах. */

export function mondayDateKeyOfWeekContaining(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey
  const ref = new Date(Date.UTC(y, m - 1, d))
  const day = ref.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  ref.setUTCDate(ref.getUTCDate() + diff)
  return ymdFromUtc(ref)
}

export function addDaysToDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey
  const ref = new Date(Date.UTC(y, m - 1, d + delta))
  return ymdFromUtc(ref)
}

/** День недели по календарной дате YYYY-MM-DD (0=вс … 6=сб), только UTC-арифметика даты. */
export function calendarWeekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function ymdFromUtc(ref: Date): string {
  return `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}-${String(ref.getUTCDate()).padStart(2, "0")}`
}

export function utcTodayYmd(): string {
  const n = new Date()
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`
}

/** Первая календарная дата слота при той же логике, что в `create-event` (неделя от понедельника, JS weekday 0=Вс). */
export function firstRecurringSlotDateKey(startYmd: string, weekdays: number[], weeks: number): string | null {
  const weekMonday = mondayDateKeyOfWeekContaining(startYmd)
  const wk = Math.min(26, Math.max(1, Math.floor(weeks)))
  const days = [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
  if (days.length === 0) return null
  let best: string | null = null
  for (let week = 0; week < wk; week++) {
    for (const dayOfWeek of days) {
      const mondayBasedIndex = (dayOfWeek + 6) % 7
      const dateKey = addDaysToDateKey(weekMonday, week * 7 + mondayBasedIndex)
      if (dateKey < startYmd) continue
      if (best === null || dateKey < best) best = dateKey
    }
  }
  return best
}
