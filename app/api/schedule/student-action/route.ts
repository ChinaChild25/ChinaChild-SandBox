import { NextResponse } from "next/server"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  action?: "cancel" | "reschedule" | "book"
  teacher_id?: string
  lesson?: { slot_at: string; date_key?: string; time?: string }
  to_date_key?: string
  to_hour?: number
  scope?: "single" | "following"
}

type Me = { id: string; role: "student" | "teacher" | "curator"; assigned_teacher_id: string | null }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.action) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<Me>()
  if (!me || me.role !== "student") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 })
  }
  const requestedTeacherId = body.teacher_id?.trim() || ""
  const { data: booked } = await supabase
    .from("teacher_schedule_slots")
    .select("teacher_id")
    .eq("booked_student_id", me.id)
    .eq("status", "booked")
    .order("slot_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ teacher_id: string }>()
  let teacherId = requestedTeacherId || booked?.teacher_id || me.assigned_teacher_id || ""
  if (!teacherId) {
    return NextResponse.json({ error: "Assigned teacher not found" }, { status: 403 })
  }
  if (requestedTeacherId && requestedTeacherId !== me.assigned_teacher_id) {
    const { data: ownBookedWithTeacher } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("booked_student_id", me.id)
      .eq("teacher_id", requestedTeacherId)
      .eq("status", "booked")
      .limit(1)
      .maybeSingle<{ teacher_id: string }>()
    if (!ownBookedWithTeacher) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const scope = body.scope === "following" ? "following" : "single"
  let mutated = false
  try {
    if (body.action === "book") {
      const toDateKeyValue = body.to_date_key
      const toHour = Number(body.to_hour)
      if (!toDateKeyValue || Number.isNaN(toHour)) {
        return NextResponse.json({ error: "Invalid booking target" }, { status: 400 })
      }
      const toTime = `${String(toHour).padStart(2, "0")}:00`
      if (scope === "single") {
        const booked = await tryBookSlot(supabase, teacherId, me.id, toDateKeyValue, toTime)
        if (!booked) return NextResponse.json({ error: "Slot is not available" }, { status: 409 })
        mutated = true
        return NextResponse.json({ ok: true, booked: 1 })
      }
      let bookedCount = 0
      const start = new Date(`${toDateKeyValue}T00:00:00`)
      for (let i = 0; i < 8; i++) {
        const target = new Date(start)
        target.setDate(target.getDate() + i * 7)
        const ok = await tryBookSlot(supabase, teacherId, me.id, toDateKey(target), toTime)
        if (ok) bookedCount += 1
      }
      if (bookedCount === 0) return NextResponse.json({ error: "No weekly slots available" }, { status: 409 })
      mutated = true
      return NextResponse.json({ ok: true, booked: bookedCount })
    }

    if (!body.lesson?.slot_at) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const oldDate = new Date(body.lesson.slot_at)
    const oldDateKey = body.lesson.date_key?.trim() || toDateKey(oldDate)
    const oldTime = normalizeScheduleSlotTime(
      body.lesson.time?.trim() || `${String(oldDate.getHours()).padStart(2, "0")}:00`
    )

    if (body.action === "cancel") {
      if (scope === "single") {
        await clearSlot(supabase, teacherId, me.id, oldDateKey, oldTime)
        mutated = true
        return NextResponse.json({ ok: true })
      }

      const { data: chainRows } = await supabase
        .from("student_schedule_slots")
        .select("date_key, time, title")
        .eq("student_id", me.id)
        .eq("time", oldTime)
        .gte("date_key", oldDateKey)

      const oldWeekday = new Date(`${oldDateKey}T00:00:00`).getDay()
      for (const row of chainRows ?? []) {
        const weekday = new Date(`${row.date_key}T00:00:00`).getDay()
        if (weekday !== oldWeekday) continue
        await clearSlot(supabase, teacherId, me.id, row.date_key, row.time)
      }
      mutated = true
      return NextResponse.json({ ok: true })
    }

    const toDateKeyValue = body.to_date_key
    const toHour = Number(body.to_hour)
    if (!toDateKeyValue || Number.isNaN(toHour)) {
      return NextResponse.json({ error: "Invalid reschedule target" }, { status: 400 })
    }
    const toTime = `${String(toHour).padStart(2, "0")}:00`

    if (scope === "single") {
      await clearSlot(supabase, teacherId, me.id, oldDateKey, oldTime)
      await bookSlot(supabase, teacherId, me.id, toDateKeyValue, toTime)
      mutated = true
      return NextResponse.json({ ok: true })
    }

    const oldStart = new Date(`${oldDateKey}T00:00:00`)
    const newStart = new Date(`${toDateKeyValue}T00:00:00`)
    const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000))
    const oldWeekday = oldStart.getDay()
    const { data: rows } = await supabase
      .from("student_schedule_slots")
      .select("date_key, time")
      .eq("student_id", me.id)
      .eq("time", oldTime)
      .gte("date_key", oldDateKey)

    for (const row of rows ?? []) {
      const base = new Date(`${row.date_key}T00:00:00`)
      if (base.getDay() !== oldWeekday) continue
      const target = new Date(base)
      target.setDate(target.getDate() + deltaDays)
      await clearSlot(supabase, teacherId, me.id, row.date_key, row.time)
      await bookSlot(supabase, teacherId, me.id, toDateKey(target), toTime)
    }

    mutated = true
    return NextResponse.json({ ok: true })
  } finally {
    if (mutated) void reconcileStudentScheduleFireAndForget(supabase, me.id)
  }
}

/** Совпадение по настенным date_key/time — в БД `slot_at` может отличаться от `new Date(\`Y-M-DTHH:mm\`).toISOString()` на сервере. */
async function findBookedTeacherSlotAt(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  studentId: string,
  dateKey: string,
  wallTime: string
): Promise<string | null> {
  const wantTime = normalizeScheduleSlotTime(wallTime)
  const { data: rows, error } = await supabase
    .from("teacher_schedule_slots")
    .select("slot_at")
    .eq("teacher_id", teacherId)
    .eq("booked_student_id", studentId)
    .eq("status", "booked")

  if (error || !rows?.length) return null
  for (const r of rows as { slot_at: string }[]) {
    const { dateKey: dk, time: tt } = wallClockFromSlotAt(r.slot_at)
    if (dk === dateKey && normalizeScheduleSlotTime(tt) === wantTime) return r.slot_at
  }
  return null
}

async function clearSlot(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  studentId: string,
  dateKey: string,
  time: string
) {
  const timeNorm = normalizeScheduleSlotTime(time)
  await supabase
    .from("student_schedule_slots")
    .delete()
    .eq("student_id", studentId)
    .eq("date_key", dateKey)
    .eq("time", timeNorm)

  const slotAt =
    (await findBookedTeacherSlotAt(supabase, teacherId, studentId, dateKey, timeNorm)) ??
    new Date(`${dateKey}T${timeNorm}:00`).toISOString()

  await supabase
    .from("teacher_schedule_slots")
    .upsert(
      {
        teacher_id: teacherId,
        slot_at: slotAt,
        status: "free",
        booked_student_id: null
      },
      { onConflict: "teacher_id,slot_at" }
    )
}

async function bookSlot(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  studentId: string,
  dateKey: string,
  time: string
) {
  await supabase
    .from("student_schedule_slots")
    .upsert(
      {
        student_id: studentId,
        date_key: dateKey,
        time,
        title: "Занятие",
        type: "lesson",
        teacher_name: null
      },
      { onConflict: "student_id,date_key,time" }
    )
  await supabase
    .from("teacher_schedule_slots")
    .upsert(
      {
        teacher_id: teacherId,
        slot_at: new Date(`${dateKey}T${time}:00`).toISOString(),
        status: "booked",
        booked_student_id: studentId
      },
      { onConflict: "teacher_id,slot_at" }
    )
}

async function tryBookSlot(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  studentId: string,
  dateKey: string,
  time: string
): Promise<boolean> {
  const slotAt = new Date(`${dateKey}T${time}:00`).toISOString()
  const { data } = await supabase
    .from("teacher_schedule_slots")
    .update({
      status: "booked",
      booked_student_id: studentId
    })
    .eq("teacher_id", teacherId)
    .eq("slot_at", slotAt)
    .eq("status", "free")
    .select("teacher_id")
    .maybeSingle()
  if (!data) return false
  await supabase
    .from("student_schedule_slots")
    .upsert(
      {
        student_id: studentId,
        date_key: dateKey,
        time,
        title: "Занятие",
        type: "lesson",
        teacher_name: null
      },
      { onConflict: "student_id,date_key,time" }
    )
  return true
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
