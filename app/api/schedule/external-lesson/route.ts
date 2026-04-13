import { NextResponse } from "next/server"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  action?: "cancel" | "reschedule"
  lesson?: { slot_at: string; date_key?: string; time?: string; student_id?: string; title?: string }
  to_date_key?: string
  to_hour?: number
  scope?: "single" | "following"
}

type ProfileLite = { id: string; role: "teacher" | "curator" | "student" }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null
  const action = body?.action
  const scope = body?.scope === "following" ? "following" : "single"
  const lesson = body?.lesson
  if (!action || !lesson?.slot_at || !lesson.student_id) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const oldDate = new Date(lesson.slot_at)
  const oldDateKey = lesson.date_key?.trim() || toLocalDateKey(oldDate)
  const oldTime = lesson.time?.trim() || `${String(oldDate.getHours()).padStart(2, "0")}:00`
  const oldWeekday = oldDate.getDay()
  const title = lesson.title || "Занятие"
  const studentId = lesson.student_id
  let mutated = false

  try {
  if (action === "cancel" && scope === "single") {
    const { error: delErr } = await supabase
      .from("student_schedule_slots")
      .delete()
      .eq("student_id", lesson.student_id)
      .eq("date_key", oldDateKey)
      .eq("time", oldTime)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    await supabase
      .from("teacher_schedule_slots")
      .upsert(
        {
          teacher_id: me.id,
          slot_at: new Date(`${oldDateKey}T${oldTime}:00`).toISOString(),
          status: "free",
          booked_student_id: null
        },
        { onConflict: "teacher_id,slot_at" }
      )
    mutated = true
    return NextResponse.json({ ok: true })
  }
  if (action === "cancel" && scope === "following") {
    const { data: chainRows, error: chainErr } = await supabase
      .from("student_schedule_slots")
      .select("date_key, time")
      .eq("student_id", lesson.student_id)
      .eq("title", title)
      .eq("time", oldTime)
      .gte("date_key", oldDateKey)
    if (chainErr) return NextResponse.json({ error: chainErr.message }, { status: 400 })
    for (const row of chainRows ?? []) {
      const d = new Date(`${row.date_key}T00:00:00`)
      if (d.getDay() !== oldWeekday) continue
      await supabase
        .from("student_schedule_slots")
        .delete()
        .eq("student_id", lesson.student_id)
        .eq("date_key", row.date_key)
        .eq("time", row.time)
      await supabase
        .from("teacher_schedule_slots")
        .upsert(
          {
            teacher_id: me.id,
            slot_at: new Date(`${row.date_key}T${row.time}:00`).toISOString(),
            status: "free",
            booked_student_id: null
          },
          { onConflict: "teacher_id,slot_at" }
        )
    }
    mutated = true
    return NextResponse.json({ ok: true })
  }

  const toDateKey = body?.to_date_key
  const toHour = Number(body?.to_hour)
  if (!toDateKey || Number.isNaN(toHour) || toHour < 0 || toHour > 23) {
    return NextResponse.json({ error: "Invalid reschedule target" }, { status: 400 })
  }
  const toTime = `${String(toHour).padStart(2, "0")}:00`

  if (scope === "single") {
    const { error: delErr } = await supabase
      .from("student_schedule_slots")
      .delete()
      .eq("student_id", lesson.student_id)
      .eq("date_key", oldDateKey)
      .eq("time", oldTime)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    await supabase
      .from("teacher_schedule_slots")
      .upsert(
        {
          teacher_id: me.id,
          slot_at: new Date(`${oldDateKey}T${oldTime}:00`).toISOString(),
          status: "free",
          booked_student_id: null
        },
        { onConflict: "teacher_id,slot_at" }
      )

    const { error: insErr } = await supabase.from("student_schedule_slots").upsert({
      student_id: lesson.student_id,
      date_key: toDateKey,
      time: toTime,
      title,
      type: "lesson",
      teacher_name: null
    }, { onConflict: "student_id,date_key,time" })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
    await supabase
      .from("teacher_schedule_slots")
      .upsert(
        {
          teacher_id: me.id,
          slot_at: new Date(`${toDateKey}T${toTime}:00`).toISOString(),
          status: "booked",
          booked_student_id: lesson.student_id
        },
        { onConflict: "teacher_id,slot_at" }
      )
    mutated = true
    return NextResponse.json({ ok: true })
  }

  const oldStart = new Date(`${oldDateKey}T00:00:00`)
  const newStart = new Date(`${toDateKey}T00:00:00`)
  const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000))
  const { data: chainRows, error: chainErr } = await supabase
    .from("student_schedule_slots")
    .select("date_key, time")
    .eq("student_id", lesson.student_id)
    .eq("title", title)
    .eq("time", oldTime)
    .gte("date_key", oldDateKey)
  if (chainErr) return NextResponse.json({ error: chainErr.message }, { status: 400 })

  for (const row of chainRows ?? []) {
    const baseDate = new Date(`${row.date_key}T00:00:00`)
    if (baseDate.getDay() !== oldWeekday) continue
    const targetDate = new Date(baseDate)
    targetDate.setDate(targetDate.getDate() + deltaDays)
    await supabase
      .from("student_schedule_slots")
      .delete()
      .eq("student_id", lesson.student_id)
      .eq("date_key", row.date_key)
      .eq("time", row.time)
    await supabase
      .from("teacher_schedule_slots")
      .upsert(
        {
          teacher_id: me.id,
          slot_at: new Date(`${row.date_key}T${row.time}:00`).toISOString(),
          status: "free",
          booked_student_id: null
        },
        { onConflict: "teacher_id,slot_at" }
      )
    await supabase.from("student_schedule_slots").upsert({
      student_id: lesson.student_id,
      date_key: toLocalDateKey(targetDate),
      time: toTime,
      title,
      type: "lesson",
      teacher_name: null
    }, { onConflict: "student_id,date_key,time" })
    await supabase
      .from("teacher_schedule_slots")
      .upsert(
        {
          teacher_id: me.id,
          slot_at: new Date(`${toLocalDateKey(targetDate)}T${toTime}:00`).toISOString(),
          status: "booked",
          booked_student_id: lesson.student_id
        },
        { onConflict: "teacher_id,slot_at" }
      )
  }

  mutated = true
  return NextResponse.json({ ok: true })
  } finally {
    if (mutated) void reconcileStudentScheduleFireAndForget(supabase, studentId)
  }
}

function toLocalDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
