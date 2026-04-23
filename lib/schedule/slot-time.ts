import { SCHEDULE_WALL_CLOCK_TIMEZONE } from "@/lib/schedule-display-tz"

/** Единый формат времени слота для ключей и строк БД: «9:00» → «09:00», минуты сохраняем. */
export function normalizeScheduleSlotTime(raw: string): string {
  const t = raw.trim()
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  return `${String(Number.parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`
}

/**
 * UTC instant (`…Z`) для `timestamptz` в Postgres: настенные `dateKey` + `time` в IANA-зоне.
 * Без этого Postgres воспринимает «2026-04-16T09:00:00» как 09:00 UTC → в Москве на сетке 12:00.
 */
export function wallClockWallTimeToDbIso(dateKey: string, timeHHMM: string, timeZone: string): string {
  const t = normalizeScheduleSlotTime(timeHHMM)
  const [y, mo, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  const [h, mi] = t.split(":").map((x) => parseInt(x, 10))
  if (![y, mo, d, h, mi].every((n) => Number.isFinite(n))) {
    return `${dateKey}T${t}:00`
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "numeric",
    hour12: false
  })

  let guessMs = Date.UTC(y, mo - 1, d, h, mi, 0)

  for (let i = 0; i < 24; i++) {
    const parts = formatter.formatToParts(new Date(guessMs))
    const get = (type: Intl.DateTimeFormatPart["type"]) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN)
    const py = get("year")
    const pm = get("month")
    const pd = get("day")
    const ph = get("hour")
    const pmin = get("minute")
    if (py === y && pm === mo && pd === d && ph === h && pmin === mi) {
      return new Date(guessMs).toISOString()
    }
    const wantDayStart = Date.UTC(y, mo - 1, d)
    const gotDayStart = Date.UTC(py, pm - 1, pd)
    const dayDiffMin = (wantDayStart - gotDayStart) / (60 * 1000)
    const wantMinFromMidnight = h * 60 + mi
    const gotMinFromMidnight = ph * 60 + pmin
    guessMs += (dayDiffMin + wantMinFromMidnight - gotMinFromMidnight) * 60 * 1000
  }

  return new Date(guessMs).toISOString()
}

/** Для записи в БД; `timeZone` — зона календаря преподавателя (как в шаблоне). */
export function wallClockSlotAtIso(dateKey: string, timeHHMM: string, timeZone = SCHEDULE_WALL_CLOCK_TIMEZONE): string {
  return wallClockWallTimeToDbIso(dateKey, timeHHMM, timeZone)
}

/**
 * Два значения `timestamptz` из БД и из клиента могут отличаться строкой (`Z` vs `+00:00`, мс),
 * но обозначать один момент — из‑за этого ломались проверки «уже на месте» и дедуп после серийного переноса.
 */
export function timestamptzInstantEqual(a: string, b: string): boolean {
  const ta = new Date(a.trim()).getTime()
  const tb = new Date(b.trim()).getTime()
  return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb
}

export function timestamptzInstantKey(iso: string): string {
  const t = new Date(iso.trim()).getTime()
  return Number.isFinite(t) ? String(t) : iso.trim()
}
