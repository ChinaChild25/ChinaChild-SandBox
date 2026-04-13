/** Модель переносимых занятий в расписании (демо + localStorage). Дата слота — dateKey YYYY-MM-DD. */

import { getAppNow } from "@/lib/app-time"
import { SCHEDULE_WALL_CLOCK_TIMEZONE, wallClockFromDateInSchoolTz } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import { TEACHER_HOURLY_SLOTS } from "@/lib/teacher-schedule"

export const SCHEDULE_DEFAULT_TEACHER = "Чжао Ли"

export const SCHEDULE_YEAR = 2026
export const SCHEDULE_MONTH_APRIL = 3 // 0-based

export const SCHEDULE_SLOT_TIMES = ["18:00", "19:00", "20:00"] as const
export type ScheduleSlotTime = (typeof SCHEDULE_SLOT_TIMES)[number]
export const TEACHER_SCHEDULE_SLOT_TIMES: string[] = TEACHER_HOURLY_SLOTS

export type ScheduledLesson = {
  id: string
  /** Календарный день слота, локальная дата: YYYY-MM-DD */
  dateKey: string
  /** "HH:mm" */
  time: ScheduleSlotTime | string
  title: string
  type: "lesson"
  teacher?: string
  teacherId?: string
  teacherAvatarUrl?: string
}

const STORAGE_KEY = "chinachild-schedule-lessons-v2"

export const MS_24H = 24 * 60 * 60 * 1000
export const MS_7D = 7 * MS_24H
/** Окно выбора нового слота учеником — как запрос слотов в ЛК (см. openLesson /api/schedule …+21d). */
export const MS_STUDENT_RESCHEDULE_MAX_HORIZON = 21 * MS_24H

export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function parseLessonStart(dateKey: string, timeHHMM: string): Date {
  const [Y, M, D] = dateKey.split("-").map((x) => parseInt(x, 10))
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10))
  return new Date(Y, M - 1, D, h, m, 0, 0)
}

/** Уже началось или прошло (по времени приложения) */
export function isLessonPastOrStarted(dateKey: string, timeStr: string): boolean {
  const start = parseLessonStart(dateKey, timeStr)
  return getAppNow().getTime() >= start.getTime()
}

/**
 * Перенос с карточки разрешён только для будущих занятий и если до начала строго больше 24 часов.
 */
export function canRescheduleLesson(dateKey: string, timeStr: string): boolean {
  const start = parseLessonStart(dateKey, timeStr)
  const now = getAppNow().getTime()
  if (now >= start.getTime()) return false
  return now < start.getTime() - MS_24H
}

/**
 * UTC-моменты слота и «сейчас» в одной шкале: настенные dateKey+time в SCHEDULE_WALL_CLOCK_TIMEZONE,
 * как у ответа API и wallClockFromSlotAt. Иначе parseLessonStart (локаль браузера) расходится с ключами слотов.
 */
function scheduleNowUtcMs(): number {
  const { dateKey, time } = wallClockFromDateInSchoolTz(getAppNow())
  const t = normalizeScheduleSlotTime(time)
  return new Date(wallClockSlotAtIso(dateKey, t, SCHEDULE_WALL_CLOCK_TIMEZONE)).getTime()
}

/**
 * Слот можно выбрать как новое время только если до начала строго больше 24 ч
 * и в пределах горизонта планирования.
 */
export function isValidRescheduleTargetSlot(dateKey: string, timeStr: string): boolean {
  const tz = SCHEDULE_WALL_CLOCK_TIMEZONE
  const t = normalizeScheduleSlotTime(timeStr)
  const slotMs = new Date(wallClockSlotAtIso(dateKey, t, tz)).getTime()
  const nowMs = scheduleNowUtcMs()
  if (Number.isNaN(slotMs)) return false
  if (slotMs <= nowMs + MS_24H) return false
  if (slotMs > nowMs + MS_STUDENT_RESCHEDULE_MAX_HORIZON) return false
  return true
}

/**
 * Преподаватель: перенос будущего занятия без требования «до начала > 24 ч».
 */
export function canTeacherRescheduleLesson(dateKey: string, timeStr: string): boolean {
  const start = parseLessonStart(dateKey, timeStr)
  return getAppNow().getTime() < start.getTime()
}

/**
 * Новый слот для переноса преподавателем: строго в будущем, не позже чем через 7 суток от «сейчас».
 */
export function isValidTeacherRescheduleTargetSlot(dateKey: string, timeStr: string): boolean {
  const start = parseLessonStart(dateKey, timeStr).getTime()
  const now = getAppNow().getTime()
  if (start <= now) return false
  if (start > now + MS_7D) return false
  return true
}

/** Пн и пт в 19:00 — стартовое расписание (апрель 2026) */
export function buildInitialAprilLessons(): ScheduledLesson[] {
  const out: ScheduledLesson[] = []
  for (let d = 1; d <= 30; d++) {
    const dt = new Date(SCHEDULE_YEAR, SCHEDULE_MONTH_APRIL, d)
    const dow = dt.getDay()
    if (dow !== 1 && dow !== 5) continue
    const dateKey = dateKeyFromDate(dt)
    out.push({
      id: `lesson-${dateKey}-19`,
      dateKey,
      time: "19:00",
      title: "Урок китайского",
      type: "lesson",
      teacher: SCHEDULE_DEFAULT_TEACHER
    })
  }
  return out
}

function migrateLegacyTeacher(name: string | undefined): string | undefined {
  if (!name) return SCHEDULE_DEFAULT_TEACHER
  if (name === "Анастасия Пономарева" || name === "Ли Вэй") return SCHEDULE_DEFAULT_TEACHER
  return name
}

function normalizeLessonFromStorage(o: Record<string, unknown>): ScheduledLesson | null {
  if (
    typeof o.id !== "string" ||
    typeof o.time !== "string" ||
    typeof o.title !== "string" ||
    o.type !== "lesson"
  ) {
    return null
  }
  let dateKey: string | undefined
  if (typeof o.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.dateKey)) {
    dateKey = o.dateKey
  } else if (typeof o.day === "number") {
    const m = String(SCHEDULE_MONTH_APRIL + 1).padStart(2, "0")
    const d = String(o.day).padStart(2, "0")
    dateKey = `${SCHEDULE_YEAR}-${m}-${d}`
  }
  if (!dateKey) return null
  const teacher = migrateLegacyTeacher(typeof o.teacher === "string" ? o.teacher : undefined)
  return {
    id: o.id,
    dateKey,
    time: o.time,
    title: o.title,
    type: "lesson",
    teacher
  }
}

export function readStoredLessons(): ScheduledLesson[] | null {
  if (typeof window === "undefined") return null
  try {
    const tryKeys = [STORAGE_KEY, "chinachild-schedule-lessons-v1"]
    for (const key of tryKeys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length === 0) continue
      const ok: ScheduledLesson[] = []
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue
        const n = normalizeLessonFromStorage(item as Record<string, unknown>)
        if (n) ok.push(n)
      }
      if (ok.length > 0) return ok
    }
    return null
  } catch {
    return null
  }
}

export function writeStoredLessons(lessons: ScheduledLesson[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons))
    localStorage.removeItem("chinachild-schedule-lessons-v1")
  } catch {
    /* ignore */
  }
}

export function findLessonAt(lessons: ScheduledLesson[], dateKey: string, time: string) {
  return lessons.find((l) => l.dateKey === dateKey && l.time === time) ?? null
}
