import { NextRequest, NextResponse } from "next/server"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
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
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me) return NextResponse.json({ error: "Profile not found" }, { status: 403 })

  const teacherIdFromQuery = req.nextUrl.searchParams.get("teacher_id")?.trim() ?? ""
  let teacherId = teacherIdFromQuery
  if (!teacherId) {
    teacherId = me.role === "teacher" || me.role === "curator" ? me.id : me.assigned_teacher_id ?? ""
  }
  if (!teacherId) return NextResponse.json({ slots: [] })

  if ((me.role === "teacher" || me.role === "curator") && teacherId !== me.id && me.role !== "curator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (me.role === "student" && teacherId !== me.assigned_teacher_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  if (me.role === "student") query = query.eq("status", "free")

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const slots = (data ?? []) as Array<{
    teacher_id: string
    slot_at: string
    status: "free" | "busy" | "booked"
    booked_student_id: string | null
  }>
  const bookedIds = [...new Set(slots.map((s) => s.booked_student_id).filter((x): x is string => Boolean(x)))]
  const bookedNameById = new Map<string, string>()
  const bookedAvatarById = new Map<string, string>()
  if (bookedIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, avatar_url")
      .in("id", bookedIds)
    for (const p of profiles ?? []) {
      const row = p as {
        id: string
        first_name: string | null
        last_name: string | null
        full_name: string | null
        avatar_url: string | null
      }
      const name =
        row.full_name?.trim() ||
        [row.first_name?.trim() ?? "", row.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
        "Ученик"
      bookedNameById.set(row.id, name)
      bookedAvatarById.set(row.id, row.avatar_url?.trim() || "")
    }
  }

  const fromKey = toLocalDateKey(from)
  const toKey = toLocalDateKey(addDaysForDateKey(to, -1))
  const { data: assignedStudents } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url")
    .eq("assigned_teacher_id", teacherId)
    .eq("role", "student")

  const studentIds = (assignedStudents ?? []).map((s) => (s as { id: string }).id)
  const studentNameById = new Map<string, string>()
  const studentAvatarById = new Map<string, string>()
  for (const s of assignedStudents ?? []) {
    const row = s as {
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string | null
      avatar_url?: string | null
    }
    const name =
      row.full_name?.trim() ||
      [row.first_name?.trim() ?? "", row.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
      "Ученик"
    studentNameById.set(row.id, name)
    studentAvatarById.set(row.id, row.avatar_url?.trim() || "")
  }

  let studentLessons: Array<{ student_id: string; date_key: string; time: string; title: string; type: string | null }> = []
  if (studentIds.length > 0) {
    const { data: lessons } = await supabase
      .from("student_schedule_slots")
      .select("student_id, date_key, time, title, type")
      .in("student_id", studentIds)
      .gte("date_key", fromKey)
      .lte("date_key", toKey)
    studentLessons = (lessons ?? []) as Array<{ student_id: string; date_key: string; time: string; title: string; type: string | null }>
  }

  const externalByKey = new Map<string, {
    student_id: string
    student_name: string
    student_avatar_url?: string
    title: string
    type: string
    slot_at: string
    date_key: string
    time: string
  }>()

  for (const lesson of studentLessons) {
    const key = `${lesson.student_id}|${lesson.date_key}|${lesson.time}`
    externalByKey.set(key, {
      student_id: lesson.student_id,
      student_name: studentNameById.get(lesson.student_id) ?? "Ученик",
      student_avatar_url: studentAvatarById.get(lesson.student_id) || undefined,
      title: lesson.title,
      type: lesson.type ?? "lesson",
      slot_at: `${lesson.date_key}T${lesson.time}:00`,
      date_key: lesson.date_key,
      time: lesson.time
    })
  }

  // Fallback: ensure each booked teacher slot is reflected in external lessons.
  for (const s of slots) {
    if (s.status !== "booked" || !s.booked_student_id) continue
    const { dateKey, time } = wallClockFromSlotAt(s.slot_at)
    const key = `${s.booked_student_id}|${dateKey}|${time}`
    if (externalByKey.has(key)) continue
    externalByKey.set(key, {
      student_id: s.booked_student_id,
      student_name: bookedNameById.get(s.booked_student_id) ?? "Ученик",
      student_avatar_url: bookedAvatarById.get(s.booked_student_id) || undefined,
      title: "Занятие",
      type: "lesson",
      slot_at: `${dateKey}T${time}:00`,
      date_key: dateKey,
      time
    })
  }

  return NextResponse.json({
    slots: slots.map((s) => ({
      ...s,
      booked_student_name: s.booked_student_id ? bookedNameById.get(s.booked_student_id) ?? "Ученик" : null
    })),
    external_lessons: Array.from(externalByKey.values())
  })
}

function addDaysForDateKey(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toLocalDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
