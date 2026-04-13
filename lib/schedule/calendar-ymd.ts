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

function ymdFromUtc(ref: Date): string {
  return `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}-${String(ref.getUTCDate()).padStart(2, "0")}`
}

export function utcTodayYmd(): string {
  const n = new Date()
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`
}
