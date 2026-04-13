/**
 * Единое «настенное» время расписания школы (по умолчанию Europe/Moscow).
 *
 * В БД часто лежит `slot_at` без часового пояса: `2026-04-21T13:00:00`.
 * В Node на Vercel это читается как **локаль сервера (UTC)** → 13:00 UTC → при переводе в Москву
 * получается 16:00 и расходится с кабинетом ученика, где показывают `date_key` + `time` из строк.
 *
 * Правило:
 * - есть `Z` или смещение `±hh:mm` → однозначный момент времени → форматируем в SCHEDULE_WALL_CLOCK_TIMEZONE;
 * - иначе → считаем, что в строке уже **локальное время школы** (как в student_schedule_slots), без пересчёта через UTC.
 */
export const SCHEDULE_WALL_CLOCK_TIMEZONE =
  (typeof process !== "undefined" && process.env.SCHEDULE_DISPLAY_TIMEZONE?.trim()) || "Europe/Moscow"

/** Строка задаёт момент в UTC/смещении (не «наивная» дата из календаря). */
export function slotAtHasExplicitTimezone(iso: string): boolean {
  const t = iso.trim()
  if (!t) return false
  if (/Z$/i.test(t)) return true
  return /[+-]\d{2}(?::\d{2})?$/.test(t) || /[+-]\d{4}$/.test(t)
}

/**
 * `2026-04-21T13:00` / `2026-04-21 13:00:00` — трактуем как календарь школы (wall clock).
 */
export function wallClockFromNaiveSlotString(iso: string): { dateKey: string; time: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?/.exec(iso.trim())
  if (!m) return null
  const h = Number.parseInt(m[4], 10)
  const min = Number.parseInt(m[5], 10)
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  return {
    dateKey: `${m[1]}-${m[2]}-${m[3]}`,
    time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
  }
}

export function wallClockFromDateInSchoolTz(instant: Date): { dateKey: string; time: string } {
  if (Number.isNaN(instant.getTime())) {
    return { dateKey: "1970-01-01", time: "00:00" }
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_WALL_CLOCK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(instant)

  const pick = (t: Intl.DateTimeFormatPart["type"]) => parts.find((p) => p.type === t)?.value ?? ""

  const y = pick("year")
  const mo = pick("month")
  const d = pick("day")
  const h = pick("hour")
  const min = pick("minute")
  const dateKey = `${y}-${mo}-${d}`
  const hourNum = Number.parseInt(h, 10)
  const minNum = Number.parseInt(min, 10)
  const time = `${String(Number.isFinite(hourNum) ? hourNum : 0).padStart(2, "0")}:${String(Number.isFinite(minNum) ? minNum : 0).padStart(2, "0")}`
  return { dateKey, time }
}

/** Сравнение настенных даты/времени в часовом поясе школы (строки с нулевым дополнением сортируются хронологически). */
export function wallClockSlotIsStrictlyAfterNow(dateKey: string, time: string): boolean {
  const now = wallClockFromDateInSchoolTz(new Date())
  return `${dateKey}T${time}` > `${now.dateKey}T${now.time}`
}

export function wallClockFromSlotAt(iso: string): { dateKey: string; time: string } {
  const trimmed = iso.trim()
  if (!trimmed) return { dateKey: "1970-01-01", time: "00:00" }

  if (!slotAtHasExplicitTimezone(trimmed)) {
    const naive = wallClockFromNaiveSlotString(trimmed)
    if (naive) return naive
  }

  const instant = new Date(trimmed)
  if (Number.isNaN(instant.getTime())) {
    return { dateKey: "1970-01-01", time: "00:00" }
  }
  return wallClockFromDateInSchoolTz(instant)
}
