import { NextResponse } from "next/server"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "teacher" | "curator" | "student"
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

type CreateEventBody = {
  weekdays?: number[]
  hour?: number
  weeks?: number
  start_date_key?: string
  status?: "busy" | "booked"
  student_id?: string | null
  title?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateEventBody | null
  const weekdays = (body?.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  const hour = Number(body?.hour ?? 10)
  const weeks = Math.min(26, Math.max(1, Number(body?.weeks ?? 12)))
  const startDateKeyRaw = body?.start_date_key?.trim() ?? ""
  const status = body?.status === "booked" ? "booked" : "busy"
  const studentId = body?.student_id ?? null
  const title = body?.title?.trim() || "Занятие"

  if (weekdays.length === 0) return NextResponse.json({ error: "weekdays are required" }, { status: 400 })
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return NextResponse.json({ error: "hour is invalid" }, { status: 400 })
  if (status === "booked" && !studentId) return NextResponse.json({ error: "student_id is required for booked slots" }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, full_name")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const startDate = parseDateKey(startDateKeyRaw) ?? new Date()
  startDate.setHours(0, 0, 0, 0)
  const weekStart = startOfWeekMonday(startDate)
  const payload: Array<{ teacher_id: string; slot_at: string; status: "busy" | "booked"; booked_student_id: string | null }> = []
  const studentSchedulePayload: Array<{ student_id: string; date_key: string; time: string; title: string; type: "lesson"; teacher_name: string | null }> = []
  const teacherName =
    me.full_name?.trim() ||
    [me.first_name?.trim() ?? "", me.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    "Преподаватель"

  for (let week = 0; week < weeks; week++) {
    for (const dayOfWeek of weekdays) {
      const base = new Date(weekStart)
      const mondayBasedIndex = (dayOfWeek + 6) % 7
      base.setDate(base.getDate() + week * 7 + mondayBasedIndex)
      base.setHours(hour, 0, 0, 0)
      if (base < startDate) continue
      payload.push({
        teacher_id: me.id,
        slot_at: base.toISOString(),
        status,
        booked_student_id: status === "booked" ? studentId : null
      })
      if (status === "booked" && studentId) {
        studentSchedulePayload.push({
          student_id: studentId,
          date_key: base.toISOString().slice(0, 10),
          time: `${String(base.getHours()).padStart(2, "0")}:00`,
          title,
          type: "lesson",
          teacher_name: teacherName
        })
      }
    }
  }

  if (payload.length === 0) return NextResponse.json({ created: 0 })

  const slotAts = payload.map((p) => p.slot_at)
  const { data: existing } = await supabase
    .from("teacher_schedule_slots")
    .select("slot_at, status")
    .eq("teacher_id", me.id)
    .in("slot_at", slotAts)

  const bookedSet = new Set((existing ?? []).filter((x) => x.status === "booked").map((x) => x.slot_at))
  const safePayload = payload.filter((p) => !bookedSet.has(p.slot_at))

  if (safePayload.length > 0) {
    const { error } = await supabase.from("teacher_schedule_slots").upsert(safePayload, { onConflict: "teacher_id,slot_at" })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  let studentWarning: string | null = null
  let studentLessonsCreated = 0
  if (status === "booked" && studentSchedulePayload.length > 0) {
    const { error: studentErr } = await supabase
      .from("student_schedule_slots")
      .upsert(studentSchedulePayload, { onConflict: "student_id,date_key,time" })
    if (studentErr) {
      studentWarning = studentErr.message
    } else {
      studentLessonsCreated = studentSchedulePayload.length
    }
  }

  if (status === "booked" && studentId) {
    void reconcileStudentScheduleFireAndForget(supabase, studentId)
  }

  return NextResponse.json({
    created: safePayload.length,
    studentLessonsCreated,
    skippedBooked: bookedSet.size,
    warning: studentWarning
  })
}

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfWeekMonday(ref: Date): Date {
  const d = new Date(ref)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
