import type { SupabaseClient } from "@supabase/supabase-js"
import { getAppNow } from "@/lib/app-time"
import { SCHEDULE_WALL_CLOCK_TIMEZONE, wallClockFromDateInTimeZone } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import {
  emptyWeeklyTemplate,
  intervalsToHourlyStatuses,
  type AvailabilityInterval,
  type WeekdayKey,
  type WeeklyTemplate,
  WEEKDAY_KEYS
} from "@/lib/teacher-availability-template"

/** Ограниченный горизонт, чтобы массовое weekly-бронирование не упиралось в statement timeout. */
export const STUDENT_WEEKLY_BOOKING_MAX_WEEKS = 26

const MS_24H = 24 * 60 * 60 * 1000
const MS_10Y = 10 * 365 * MS_24H

const DEFAULT_STUDENT_OPEN_HOURS: AvailabilityInterval[] = [{ start: "09:00", end: "21:00" }]
const DEFAULT_STUDENT_WEEKLY_IF_NO_TEMPLATE: WeeklyTemplate = {
  sunday: DEFAULT_STUDENT_OPEN_HOURS,
  monday: DEFAULT_STUDENT_OPEN_HOURS,
  tuesday: DEFAULT_STUDENT_OPEN_HOURS,
  wednesday: DEFAULT_STUDENT_OPEN_HOURS,
  thursday: DEFAULT_STUDENT_OPEN_HOURS,
  friday: DEFAULT_STUDENT_OPEN_HOURS,
  saturday: DEFAULT_STUDENT_OPEN_HOURS
}

function weeklyTemplateHasAnyFreeHour(weekly: WeeklyTemplate): boolean {
  for (const k of WEEKDAY_KEYS) {
    if (intervalsToHourlyStatuses(weekly[k] ?? []).some((s) => s === "free")) return true
  }
  return false
}

function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export type WeeklyBookingOccurrence = { dateKey: string; time: string }

/**
 * Список дат для еженедельного бронирования: шаблон доступности + существующие строки teacher_schedule_slots
 * (не занять чужую бронь и не перебить busy).
 */
export async function collectWeeklyBookingOccurrences(
  supabase: SupabaseClient,
  teacherId: string,
  studentId: string,
  firstDateKey: string,
  wallTime: string,
  maxWeeks: number
): Promise<WeeklyBookingOccurrence[]> {
  const timeNorm = normalizeScheduleSlotTime(wallTime)
  const hour = Number.parseInt(timeNorm.slice(0, 2), 10)
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return []

  const { data: tmpl } = await supabase
    .from("teacher_schedule_templates")
    .select("weekly_template, timezone")
    .eq("teacher_id", teacherId)
    .maybeSingle<{ weekly_template: WeeklyTemplate | null; timezone: string | null }>()

  const weeklyFromDb = (tmpl?.weekly_template as WeeklyTemplate | null) ?? emptyWeeklyTemplate()
  const weeklyForSynth = weeklyTemplateHasAnyFreeHour(weeklyFromDb) ? weeklyFromDb : DEFAULT_STUDENT_WEEKLY_IF_NO_TEMPLATE
  const teacherTz = (tmpl?.timezone ?? "").trim() || SCHEDULE_WALL_CLOCK_TIMEZONE

  const nowMs = getAppNow().getTime()
  const out: WeeklyBookingOccurrence[] = []
  const slotAtList: string[] = []

  for (let i = 0; i < maxWeeks; i++) {
    const dateKey = addDaysToDateKey(firstDateKey, i * 7)
    const slotAt = wallClockSlotAtIso(dateKey, timeNorm, SCHEDULE_WALL_CLOCK_TIMEZONE)
    const slotMs = new Date(slotAt).getTime()
    if (Number.isNaN(slotMs)) continue
    if (slotMs <= nowMs) continue
    if (slotMs > nowMs + MS_10Y) break

    const { time: wallInTeacherTz } = wallClockFromDateInTimeZone(new Date(slotMs), teacherTz)
    const wallHour = Number.parseInt(wallInTeacherTz.slice(0, 2), 10)
    if (!Number.isFinite(wallHour) || wallHour < 0 || wallHour > 23) continue
    const dow = new Date(slotMs).toLocaleDateString("en-US", { weekday: "short", timeZone: teacherTz })
    const dowMap: Record<string, WeekdayKey> = {
      Sun: "sunday",
      Mon: "monday",
      Tue: "tuesday",
      Wed: "wednesday",
      Thu: "thursday",
      Fri: "friday",
      Sat: "saturday"
    }
    const wk = dowMap[dow]
    if (!wk) continue
    const hourly = intervalsToHourlyStatuses(weeklyForSynth[wk] ?? [])
    if (hourly[wallHour] !== "free") continue

    slotAtList.push(slotAt)
    out.push({ dateKey, time: timeNorm })
  }

  if (out.length === 0) return []

  const statusBySlotAt = new Map<string, { status: string; booked_student_id: string | null }>()
  for (const part of chunkArray(slotAtList, 100)) {
    const { data: rows, error } = await supabase
      .from("teacher_schedule_slots")
      .select("slot_at, status, booked_student_id")
      .eq("teacher_id", teacherId)
      .in("slot_at", part)
    if (error) throw new Error(error.message)
    for (const r of rows ?? []) {
      const row = r as { slot_at: string; status: string; booked_student_id: string | null }
      statusBySlotAt.set(row.slot_at, { status: row.status, booked_student_id: row.booked_student_id })
    }
  }

  const eligible: WeeklyBookingOccurrence[] = []
  for (let i = 0; i < out.length; i++) {
    const occ = out[i]
    const slotAt = slotAtList[i]
    const row = statusBySlotAt.get(slotAt)
    if (!row) {
      eligible.push(occ)
      continue
    }
    if (row.status === "busy") continue
    if (row.status === "booked") {
      if (row.booked_student_id === studentId) eligible.push(occ)
      continue
    }
    if (row.status === "free") eligible.push(occ)
  }

  return eligible
}

export async function bulkBookWeeklyOccurrences(
  supabase: SupabaseClient,
  teacherId: string,
  studentId: string,
  occurrences: WeeklyBookingOccurrence[]
): Promise<void> {
  if (occurrences.length === 0) return

  const studentRows = occurrences.map((o) => ({
    student_id: studentId,
    date_key: o.dateKey,
    time: o.time,
    title: "Занятие",
    type: "lesson" as const,
    teacher_name: null as string | null
  }))

  const teacherRows = occurrences.map((o) => ({
    teacher_id: teacherId,
    slot_at: wallClockSlotAtIso(o.dateKey, o.time, SCHEDULE_WALL_CLOCK_TIMEZONE),
    status: "booked" as const,
    booked_student_id: studentId
  }))

  for (const part of chunkArray(studentRows, 120)) {
    const { error } = await supabase.from("student_schedule_slots").upsert(part, { onConflict: "student_id,date_key,time" })
    if (error) throw new Error(error.message)
  }
  for (const part of chunkArray(teacherRows, 120)) {
    const { error } = await supabase.from("teacher_schedule_slots").upsert(part, { onConflict: "teacher_id,slot_at" })
    if (error) throw new Error(error.message)
  }
}
