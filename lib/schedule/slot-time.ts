/** Единый формат времени слота для ключей и строк БД: «9:00» → «09:00», минуты сохраняем. */
export function normalizeScheduleSlotTime(raw: string): string {
  const t = raw.trim()
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  return `${String(Number.parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`
}

/**
 * Значение для `teacher_schedule_slots.slot_at` в «настенных» часах школы (без Z/смещения),
 * чтобы на Vercel (UTC) не сдвигалось отображение и ключи совпадали с `wallClockFromSlotAt`.
 */
export function wallClockSlotAtIso(dateKey: string, timeHHMM: string): string {
  return `${dateKey}T${normalizeScheduleSlotTime(timeHHMM)}:00`
}
