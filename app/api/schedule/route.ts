import { NextRequest, NextResponse } from "next/server"
import { SCHEDULE_WALL_CLOCK_TIMEZONE, wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { startOfLocalDay } from "@/lib/teacher-schedule"
import {
  emptyWeeklyTemplate,
  intervalsToHourlyStatuses,
  WEEKDAY_KEYS,
  type WeekdayKey,
  type WeeklyTemplate
} from "@/lib/teacher-availability-template"

type ProfileLite = {
  id: string
  role: "student" | "teacher"
  assigned_teacher_id: string | null
}

function parseDateOr(defaultValue: Date, raw: string | null): Date {
  if (!raw) return defaultValue
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? defaultValue : d
}

function formatYmdInTz(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant)
  const pick = (t: Intl.DateTimeFormatPart["type"]) => parts.find((p) => p.type === t)?.value ?? ""
  return `${pick("year")}-${pick("month")}-${pick("day")}`
}

function addOneDayYmd(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return dateKey
  const x = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  x.setUTCDate(x.getUTCDate() + 1)
  const yy = x.getUTCFullYear()
  const mm = String(x.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(x.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function weekdayKeyFromDateKey(dateKey: string): WeekdayKey {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  const dow = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
  const map: WeekdayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return map[dow]
}

function weeklyTemplateHasAnyFreeHour(weekly: WeeklyTemplate): boolean {
  for (const k of WEEKDAY_KEYS) {
    if (intervalsToHourlyStatuses(weekly[k] ?? []).some((s) => s === "free")) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 403 })

  const teacherIdFromQuery = req.nextUrl.searchParams.get("teacher_id")?.trim() ?? ""
  let teacherId = teacherIdFromQuery
  if (!teacherId && me.role === "student") {
    const { data: booked } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("booked_student_id", me.id)
      .eq("status", "booked")
      .order("slot_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ teacher_id: string }>()
    teacherId = booked?.teacher_id ?? me.assigned_teacher_id ?? ""
  }
  if (!teacherId) {
    teacherId = me.role === "teacher" ? me.id : me.assigned_teacher_id ?? ""
  }
  if (!teacherId) return NextResponse.json({ slots: [] })

  if (me.role === "teacher" && teacherId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (me.role === "student" && me.assigned_teacher_id && teacherId !== me.assigned_teacher_id) {
    const { data: ownBookedWithTeacher } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("booked_student_id", me.id)
      .eq("teacher_id", teacherId)
      .eq("status", "booked")
      .limit(1)
      .maybeSingle<{ teacher_id: string }>()
    if (!ownBookedWithTeacher) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const fromDefault = new Date()
  fromDefault.setHours(0, 0, 0, 0)
  const toDefault = new Date(fromDefault)
  toDefault.setDate(toDefault.getDate() + 7)

  const from = parseDateOr(fromDefault, req.nextUrl.searchParams.get("from"))
  const to = parseDateOr(toDefault, req.nextUrl.searchParams.get("to"))

  let query = supabase
    .from("teacher_schedule_slots")
    .select("teacher_id, slot_at, status, booked_student_id")
    .eq("teacher_id", teacherId)
    .gte("slot_at", from.toISOString())
    .lt("slot_at", to.toISOString())
    .order("slot_at", { ascending: true })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const rows = (data ?? []) as Array<{
    teacher_id: string
    slot_at: string
    status: "free" | "busy" | "booked"
    booked_student_id: string | null
  }>
  if (me.role !== "student") {
    return NextResponse.json({ slots: rows })
  }

  // Слоты для ученика = пересечение «зелёных» часов шаблона доступности преподавателя
  // (weekly_template) с фактическими строками teacher_schedule_slots: не busy и не booked.
  // Так перенос/запись в ЛК совпадают с зелёными ячейками в календаре преподавателя.
  const slotByIso = new Map(rows.map((r) => [r.slot_at, r]))
  const slotByWallKey = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    const w = wallClockFromSlotAt(r.slot_at)
    const tm = normalizeScheduleSlotTime(w.time)
    slotByWallKey.set(`${w.dateKey}|${tm}`, r)
  }

  const { data: tmpl } = await supabase
    .from("teacher_schedule_templates")
    .select("weekly_template, timezone")
    .eq("teacher_id", teacherId)
    .maybeSingle<{ weekly_template: WeeklyTemplate | null; timezone: string | null }>()
  const weekly = (tmpl?.weekly_template as WeeklyTemplate | null) ?? emptyWeeklyTemplate()
  const teacherTz = tmpl?.timezone?.trim() || SCHEDULE_WALL_CLOCK_TIMEZONE

  const synthesized: Array<{
    teacher_id: string
    slot_at: string
    status: "free"
    booked_student_id: null
  }> = []

  const end = startOfLocalDay(to)
  const startKey = formatYmdInTz(from, teacherTz)
  const lastKey = formatYmdInTz(new Date(end.getTime() - 1), teacherTz)

  for (let dk = startKey; dk <= lastKey; dk = addOneDayYmd(dk)) {
    const weekday = weekdayKeyFromDateKey(dk)
    const hourly = intervalsToHourlyStatuses(weekly[weekday] ?? [])
    for (let hour = 0; hour < 24; hour++) {
      const timeStr = `${String(hour).padStart(2, "0")}:00`
      if (hourly[hour] !== "free") continue
      const iso = wallClockSlotAtIso(dk, timeStr, teacherTz)
      const row = slotByIso.get(iso) ?? slotByWallKey.get(`${dk}|${timeStr}`)
      if (row?.status === "busy" || row?.status === "booked") continue
      synthesized.push({
        teacher_id: teacherId,
        slot_at: iso,
        status: "free",
        booked_student_id: null
      })
    }
  }

  // Шаблон в БД пустой / ни одного «зелёного» часа — в календаре преподавателя слоты всё равно могут быть
  // материализованы как free после «Сохранить». Показываем их ученику, иначе перенос невозможен.
  if (synthesized.length === 0 && !weeklyTemplateHasAnyFreeHour(weekly)) {
    const seenIso = new Set<string>()
    for (const r of rows) {
      if (r.status !== "free") continue
      const w = wallClockFromSlotAt(r.slot_at)
      const t = normalizeScheduleSlotTime(w.time)
      const iso = wallClockSlotAtIso(w.dateKey, t, teacherTz)
      if (seenIso.has(iso)) continue
      seenIso.add(iso)
      synthesized.push({
        teacher_id: teacherId,
        slot_at: iso,
        status: "free",
        booked_student_id: null
      })
    }
  }

  return NextResponse.json({ slots: synthesized })
}
