import { NextRequest, NextResponse } from "next/server"
import { SCHEDULE_WALL_CLOCK_TIMEZONE, wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { addOneDayYmd } from "@/lib/schedule/date-ymd"
import { resolveTeacherIdFromStudentSlots } from "@/lib/schedule/resolve-teacher-from-student-slots"
import { wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import { intervalsToHourlyStatuses, type WeeklyTemplate } from "@/lib/teacher-availability-template"
import { createServerSupabaseClient } from "@/lib/supabase/server"

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
    if (!teacherId) {
      const fromLessons = await resolveTeacherIdFromStudentSlots(supabase, me.id)
      if (fromLessons) teacherId = fromLessons
    }
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

  // Для ученика: источник доступности — weekly template (зелёная зона) + реальные блокировки из teacher_schedule_slots.
  // Если слот в шаблоне свободен и в таблице нет busy/booked, он должен показываться даже без materialized free-строки.
  const { data: templateRow } = await supabase
    .from("teacher_schedule_templates")
    .select("weekly_template")
    .eq("teacher_id", teacherId)
    .maybeSingle<{ weekly_template: WeeklyTemplate | null }>()
  const weeklyTemplate = (templateRow?.weekly_template ?? {}) as WeeklyTemplate
  const weekdayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const
  const hourlyByWeekday = new Map<string, ReturnType<typeof intervalsToHourlyStatuses>>()
  for (const weekdayKey of weekdayOrder) {
    hourlyByWeekday.set(weekdayKey, intervalsToHourlyStatuses(weeklyTemplate?.[weekdayKey] ?? []))
  }
  const rowBySlotAt = new Map(rows.map((row) => [row.slot_at, row] as const))
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const startDateKey = wallClockFromSlotAt(from.toISOString()).dateKey
  const endDateKey = wallClockFromSlotAt(new Date(Math.max(fromMs, toMs - 1)).toISOString()).dateKey
  const result: typeof rows = []
  let dateKey = startDateKey
  while (dateKey <= endDateKey) {
    const weekday = weekdayOrder[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]
    const hourly = hourlyByWeekday.get(weekday) ?? []
    for (let hour = 0; hour < 24; hour++) {
      if (hourly[hour] !== "free") continue
      const time = `${String(hour).padStart(2, "0")}:00`
      const slotAt = wallClockSlotAtIso(dateKey, time, SCHEDULE_WALL_CLOCK_TIMEZONE)
      const slotMs = new Date(slotAt).getTime()
      if (Number.isNaN(slotMs) || slotMs < fromMs || slotMs >= toMs) continue
      const existing = rowBySlotAt.get(slotAt)
      if (existing?.status === "booked" || existing?.status === "busy") continue
      result.push(
        existing ?? {
          teacher_id: teacherId,
          slot_at: slotAt,
          status: "free",
          booked_student_id: null
        }
      )
    }
    dateKey = addOneDayYmd(dateKey)
  }
  result.sort((a, b) => a.slot_at.localeCompare(b.slot_at))
  return NextResponse.json({ slots: result })
}
