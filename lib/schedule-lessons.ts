/** Модель переносимых занятий в расписании (демо + localStorage). Дата слота — dateKey YYYY-MM-DD. */

import { getAppNow } from "@/lib/app-time"
import { SCHEDULE_POLICY } from "@/lib/schedule/policy"
import { calendarWeekdayFromDateKey } from "@/lib/schedule/calendar-ymd"
import { firstFollowingMoveDateKeyForLesson } from "@/lib/schedule/following-series"
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
  /** Ссылка на видеозвонок преподавателя (из profiles.online_meeting_url) */
  onlineMeetingUrl?: string
}

const STORAGE_KEY = "chinachild-schedule-lessons-v2"

export const MS_24H = SCHEDULE_POLICY.studentMinLeadMs
export const MS_7D = 7 * MS_24H
/** Окно выбора нового слота учеником — не более 7 суток вперёд. */
export const MS_STUDENT_RESCHEDULE_MAX_HORIZON = SCHEDULE_POLICY.studentSingleBookingHorizonDays * MS_24H

/** Горизонт выбора якоря еженедельного бронирования: до +14 суток от «сейчас» (школа). */
export const MS_STUDENT_WEEKLY_BOOK_ANCHOR_MAX_HORIZON = SCHEDULE_POLICY.studentWeeklyAnchorHorizonDays * MS_24H

/** Регулярный перенос: горизонт шаблона / первого фактического слота — до ~6 недель от «сейчас». */
export const MS_STUDENT_FOLLOWING_RESCHEDULE_TARGET_HORIZON = SCHEDULE_POLICY.studentFollowingRescheduleHorizonDays * MS_24H
type WallNow = { dateKey: string; time: string }

export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function currentWallNow(now: Date = getAppNow()): WallNow {
  return {
    dateKey: dateKeyFromDate(now),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  }
}

function wallEpochMs(dateKey: string, timeHHMM: string): number {
  const [y, mo, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  const t = normalizeScheduleSlotTime(timeHHMM)
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10))
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return Number.NaN
  return Date.UTC(y, mo - 1, d, hh, mm, 0, 0)
}

/** Локальная полуночь Y-M-D в браузере (демо/localStorage). */
export function parseLessonStart(dateKey: string, timeHHMM: string): Date {
  const [Y, M, D] = dateKey.split("-").map((x) => parseInt(x, 10))
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10))
  return new Date(Y, M - 1, D, h, m, 0, 0)
}

/** UTC-полдень по календарной дате слота (подписи дня недели без сдвига TZ). */
export function schoolCalendarAnchorUtc(dateKey: string): Date {
  const [y, mo, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (![y, mo, d].every((n) => Number.isFinite(n))) return new Date(NaN)
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
}

/** Момент слота в локальном wall-clock (dateKey + timeHHMM), без пересчётов TZ. */
export function lessonWallClockEpochMs(dateKey: string, timeHHMM: string): number {
  return wallEpochMs(dateKey, timeHHMM)
}

/** «Сейчас» в локальном wall-clock устройства, без пересчётов TZ. */
export function localWallClockNowEpochMs(): number {
  const now = currentWallNow()
  return wallEpochMs(now.dateKey, now.time)
}

export function formatSchoolCalendarWeekdayLongRu(dateKey: string): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" }).format(schoolCalendarAnchorUtc(dateKey))
}

/** Уже началось или прошло (по шкале школы). */
export function isLessonPastOrStarted(dateKey: string, timeStr: string): boolean {
  const start = lessonWallClockEpochMs(dateKey, timeStr)
  return localWallClockNowEpochMs() >= start
}

/**
 * Перенос с карточки разрешён только для будущих занятий и если до начала строго больше 24 часов (шкала школы).
 */
export function canRescheduleLesson(dateKey: string, timeStr: string): boolean {
  const start = wallEpochMs(dateKey, timeStr)
  const nowWall = currentWallNow()
  const now = wallEpochMs(nowWall.dateKey, nowWall.time)
  if (now >= start) return false
  return now < start - MS_24H
}

/**
 * Слот можно выбрать как новое время только если до начала строго больше 24 ч
 * и в пределах горизонта планирования.
 */
export function isValidRescheduleTargetSlot(dateKey: string, timeStr: string, nowWall?: WallNow): boolean {
  const slotMs = wallEpochMs(dateKey, timeStr)
  const nowRef = nowWall ?? currentWallNow()
  const nowMs = wallEpochMs(nowRef.dateKey, nowRef.time)
  if (Number.isNaN(slotMs)) return false
  if (slotMs <= nowMs + MS_24H) return false
  if (slotMs > nowMs + MS_STUDENT_RESCHEDULE_MAX_HORIZON) return false
  return true
}

/**
 * Слот в общем списке «свободно у преподавателя» для демо/подсветки: строго в будущем, в пределах 7 суток (без отсечки +24 ч).
 * Для бронирования учеником используйте {@link isValidRescheduleTargetSlot} (разово) и {@link isValidStudentWeeklyBookingAnchorSlot} (еженедельно).
 */
export function isValidStudentBookingTargetSlot(dateKey: string, timeStr: string): boolean {
  const slotMs = wallEpochMs(dateKey, timeStr)
  const now = currentWallNow()
  const nowMs = wallEpochMs(now.dateKey, now.time)
  if (Number.isNaN(slotMs)) return false
  if (slotMs <= nowMs) return false
  if (slotMs > nowMs + MS_STUDENT_RESCHEDULE_MAX_HORIZON) return false
  return true
}

/**
 * Якорь еженедельного бронирования: та же отсечка +24 ч, что для разового переноса — первый урок
 * совпадает с выбранной календарной датой (иначе «среда» вела бы на ближайшую среду без полных суток до урока, а фактический старт — через неделю).
 */
export function isValidStudentWeeklyBookingAnchorSlot(dateKey: string, timeStr: string, nowWall?: WallNow): boolean {
  const slotMs = wallEpochMs(dateKey, timeStr)
  const nowRef = nowWall ?? currentWallNow()
  const nowMs = wallEpochMs(nowRef.dateKey, nowRef.time)
  if (Number.isNaN(slotMs)) return false
  if (slotMs <= nowMs + MS_24H) return false
  if (slotMs > nowMs + MS_STUDENT_WEEKLY_BOOK_ANCHOR_MAX_HORIZON) return false
  return true
}

/**
 * Слот в сетке «свободно у преподавателя» для шага выбора времени регулярного переноса:
 * календарная дата+время шаблона строго в будущем (без +24 ч — см. {@link isValidFollowingRescheduleTargetForLesson}).
 */
export function isValidFollowingRescheduleTemplateSlot(dateKey: string, timeStr: string): boolean {
  const slotMs = wallEpochMs(dateKey, timeStr)
  const now = currentWallNow()
  const nowMs = wallEpochMs(now.dateKey, now.time)
  if (Number.isNaN(slotMs)) return false
  if (slotMs <= nowMs) return false
  if (slotMs > nowMs + MS_STUDENT_FOLLOWING_RESCHEDULE_TARGET_HORIZON) return false
  return true
}

/**
 * Регулярный перенос: +24 ч от «сейчас» проверяем по **первому фактическому** слоту этой карточки
 * после сдвига дня недели (чт→ср = +6 дней к дате урока), а не по выбранной на календаре дате шаблона.
 */
export function isValidFollowingRescheduleTargetForLesson(
  lessonDateKey: string,
  templatePickerDateKey: string,
  toTime: string,
  nowWall?: WallNow
): boolean {
  const firstDate = firstFollowingMoveDateKeyForLesson(lessonDateKey, templatePickerDateKey)
  const slotMs = wallEpochMs(firstDate, toTime)
  const nowRef = nowWall ?? currentWallNow()
  const nowMs = wallEpochMs(nowRef.dateKey, nowRef.time)
  if (Number.isNaN(slotMs)) return false
  if (slotMs <= nowMs + MS_24H) return false
  if (slotMs > nowMs + MS_STUDENT_FOLLOWING_RESCHEDULE_TARGET_HORIZON) return false
  return true
}

/**
 * Времена по дням недели для шага «выберите день недели» при регулярном переносе:
 * только те часы, для которых есть календарная дата в `dateSlots` и проходит {@link isValidFollowingRescheduleTargetForLesson}.
 */
export function followingRescheduleSelectableTimesByWeekday(
  dateSlots: Record<string, string[]>,
  lessonDateKey: string,
  minDateKey: string | null
): Record<number, string[]> {
  const map: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const [dateKey, slots] of Object.entries(dateSlots)) {
    if (minDateKey && dateKey < minDateKey) continue
    const weekday = calendarWeekdayFromDateKey(dateKey)
    for (const slot of slots) {
      const t = normalizeScheduleSlotTime(slot)
      if (!isValidFollowingRescheduleTargetForLesson(lessonDateKey, dateKey, t)) continue
      if (!map[weekday].includes(slot)) map[weekday].push(slot)
    }
  }
  for (const wd of Object.keys(map)) {
    map[Number(wd)].sort()
  }
  return map
}

function wallComparableKey(dateKey: string, timeHHMM: string): string {
  return `${dateKey}T${normalizeScheduleSlotTime(timeHHMM)}`
}

/**
 * Преподаватель: перенос будущего занятия без требования «до начала > 24 ч».
 */
export function canTeacherRescheduleLesson(
  dateKey: string,
  timeStr: string,
  _timeZone: string = SCHEDULE_WALL_CLOCK_TIMEZONE,
  nowWall?: WallNow
): boolean {
  const nowRef = nowWall ?? currentWallNow()
  const nowDateKey = nowRef.dateKey
  const nowTime = nowRef.time
  return wallComparableKey(dateKey, timeStr) > wallComparableKey(nowDateKey, nowTime)
}

/**
 * Новый слот для переноса преподавателем: строго в будущем.
 * Верхнего ограничения по горизонту нет.
 */
export function isValidTeacherRescheduleTargetSlot(
  dateKey: string,
  timeStr: string,
  _timeZone: string = SCHEDULE_WALL_CLOCK_TIMEZONE,
  nowWall?: WallNow
): boolean {
  const nowRef = nowWall ?? currentWallNow()
  const nowDateKey = nowRef.dateKey
  const nowTime = nowRef.time
  return wallComparableKey(dateKey, timeStr) > wallComparableKey(nowDateKey, nowTime)
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
