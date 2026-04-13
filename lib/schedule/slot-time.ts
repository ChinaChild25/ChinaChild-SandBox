/** Единый формат времени слота для ключей и строк БД: «9:00» → «09:00», минуты сохраняем. */
export function normalizeScheduleSlotTime(raw: string): string {
  const t = raw.trim()
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  return `${String(Number.parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`
}
