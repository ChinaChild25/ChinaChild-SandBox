import { NextResponse } from "next/server"
import { wallClockFromSlotAt, wallClockSlotIsStrictlyAfterNow } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  lesson?: {
    slot_at: string
    student_id?: string
    title?: string
  }
  status?: "lesson" | "completed" | "charged_absence" | "late_cancel"
}

type ProfileLite = { id: string; role: "teacher" | "curator" | "student"; full_name?: string | null }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null
  const lesson = body?.lesson
  const status = body?.status === "late_cancel" ? "charged_absence" : body?.status
  if (!lesson?.slot_at || !lesson.student_id || !status) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const { dateKey, time: wallTime } = wallClockFromSlotAt(lesson.slot_at)
  const time = normalizeScheduleSlotTime(wallTime)
  if (
    (status === "completed" || status === "charged_absence") &&
    wallClockSlotIsStrictlyAfterNow(dateKey, time)
  ) {
    return NextResponse.json({ error: "Future lessons cannot be marked as completed" }, { status: 400 })
  }
  const title = lesson.title?.trim() || "Занятие"

  const { error } = await supabase.from("student_schedule_slots").upsert(
    {
      student_id: lesson.student_id,
      date_key: dateKey,
      time,
      title,
      type: status,
      teacher_name: me.full_name ?? null
    },
    { onConflict: "student_id,date_key,time" }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
