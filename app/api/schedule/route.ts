import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { addDays, startOfLocalDay } from "@/lib/teacher-schedule"
import { emptyWeeklyTemplate, intervalsToHourlyStatuses, type WeeklyTemplate, weekdayFromDate } from "@/lib/teacher-availability-template"

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

  // Student fallback: synthesize free slots from teacher weekly template
  // when not all free rows are materialized in teacher_schedule_slots.
  const slotByIso = new Map(rows.map((r) => [r.slot_at, r]))
  const { data: tmpl } = await supabase
    .from("teacher_schedule_templates")
    .select("weekly_template")
    .eq("teacher_id", teacherId)
    .maybeSingle<{ weekly_template: WeeklyTemplate | null }>()
  const weekly = (tmpl?.weekly_template as WeeklyTemplate | null) ?? emptyWeeklyTemplate()

  const synthesized: Array<{
    teacher_id: string
    slot_at: string
    status: "free"
    booked_student_id: null
  }> = []

  const cursor = startOfLocalDay(from)
  const end = startOfLocalDay(to)
  while (cursor < end) {
    const weekday = weekdayFromDate(cursor)
    const hourly = intervalsToHourlyStatuses(weekly[weekday] ?? [])
    for (let hour = 0; hour < 24; hour++) {
      const at = new Date(cursor)
      at.setHours(hour, 0, 0, 0)
      const iso = at.toISOString()
      const row = slotByIso.get(iso)
      const templateIsFree = hourly[hour] === "free"
      const rowIsBooked = row?.status === "booked"
      const rowIsFree = row?.status === "free"
      // Student should see regular teacher availability (template "free") and one-off free slots,
      // while booked slots are always excluded.
      const isFreeForStudent = !rowIsBooked && (rowIsFree || templateIsFree)
      if (isFreeForStudent) {
        synthesized.push({
          teacher_id: teacherId,
          slot_at: iso,
          status: "free",
          booked_student_id: null
        })
      }
    }
    const next = addDays(cursor, 1)
    cursor.setTime(next.getTime())
  }

  return NextResponse.json({ slots: synthesized })
}
