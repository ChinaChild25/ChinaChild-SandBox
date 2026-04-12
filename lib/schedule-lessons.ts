/** Модель переносимых занятий в расписании (апрель 2026, демо + localStorage). */

import { getAppNow } from "@/lib/app-time"

export const SCHEDULE_DEFAULT_TEACHER = "Анастасия Пономарева"

export const SCHEDULE_YEAR = 2026
export const SCHEDULE_MONTH_APRIL = 3 // 0-based

export const SCHEDULE_SLOT_TIMES = ["18:00", "19:00", "20:00"] as const
export type ScheduleSlotTime = (typeof SCHEDULE_SLOT_TIMES)[number]

export type ScheduledLesson = {
  id: string
  day: number
  /** "HH:mm" */
  time: ScheduleSlotTime | string
  title: string
  type: "lesson"
  teacher?: string
}

const STORAGE_KEY = "chinachild-schedule-lessons-v1"

export const MS_24H = 24 * 60 * 60 * 1000

export function isApril2026(d: Date): boolean {
  return d.getFullYear() === SCHEDULE_YEAR && d.getMonth() === SCHEDULE_MONTH_APRIL
}

export function dateFromAprilDay(day: number): Date {
  return new Date(SCHEDULE_YEAR, SCHEDULE_MONTH_APRIL, day)
}

export function parseLessonStart(day: number, timeHHMM: string): Date {
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10))
  const d = dateFromAprilDay(day)
  d.setHours(h, m, 0, 0)
  return d
}

/** Уже началось или прошло (по времени приложения) */
export function isLessonPastOrStarted(day: number, timeStr: string): boolean {
  const start = parseLessonStart(day, timeStr)
  return getAppNow().getTime() >= start.getTime()
}

/**
 * Перенос разрешён только для будущих занятий и если до начала строго больше 24 часов.
 */
export function canRescheduleLesson(day: number, timeStr: string): boolean {
  const start = parseLessonStart(day, timeStr)
  const now = getAppNow().getTime()
  if (now >= start.getTime()) return false
  return now < start.getTime() - MS_24H
}

/** Пн и пт в 19:00 — стартовое расписание */
export function buildInitialAprilLessons(): ScheduledLesson[] {
  const out: ScheduledLesson[] = []
  for (let d = 1; d <= 30; d++) {
    const dt = dateFromAprilDay(d)
    const dow = dt.getDay()
    if (dow !== 1 && dow !== 5) continue
    out.push({
      id: `lesson-apr-${d}-19`,
      day: d,
      time: "19:00",
      title: "Урок китайского",
      type: "lesson",
      teacher: SCHEDULE_DEFAULT_TEACHER
    })
  }
  return out
}

function isScheduledLesson(x: unknown): x is ScheduledLesson {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.day === "number" &&
    typeof o.time === "string" &&
    typeof o.title === "string" &&
    o.type === "lesson"
  )
}

export function readStoredLessons(): ScheduledLesson[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const ok = parsed.filter(isScheduledLesson)
    return ok.length > 0 ? ok : null
  } catch {
    return null
  }
}

export function writeStoredLessons(lessons: ScheduledLesson[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons))
  } catch {
    /* ignore */
  }
}

export function findLessonAt(lessons: ScheduledLesson[], day: number, time: string) {
  return lessons.find((l) => l.day === day && l.time === time) ?? null
}
