import { NextResponse } from "next/server"
import { addDaysToDateKey, mondayDateKeyOfWeekContaining, utcTodayYmd } from "@/lib/schedule/calendar-ymd"
import { nextEligibleStartDateKey } from "@/lib/schedule/recurring-slot-eligibility"
import { SCHEDULE_WALL_CLOCK_TIMEZONE } from "@/lib/schedule-display-tz"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
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
  /** IANA, как в настройках календаря преподавателя — для корректного timestamptz в БД */
  timezone?: string
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

  const startYmd = /^\d{4}-\d{2}-\d{2}$/.test(startDateKeyRaw.trim()) ? startDateKeyRaw.trim() : utcTodayYmd()
  const weekMonday = mondayDateKeyOfWeekContaining(startYmd)
  const wallTime = normalizeScheduleSlotTime(`${String(hour).padStart(2, "0")}:00`)
  const timeZone = body?.timezone?.trim() || SCHEDULE_WALL_CLOCK_TIMEZONE

  const payload: Array<{ teacher_id: string; slot_at: string; status: "busy" | "booked"; booked_student_id: string | null }> = []
  const studentSchedulePayload: Array<{ student_id: string; date_key: string; time: string; title: string; type: "lesson"; teacher_name: string | null }> = []
  const teacherName =
    me.full_name?.trim() ||
    [me.first_name?.trim() ?? "", me.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    "Преподаватель"

  const nowMs = Date.now()
  let skippedPastCount = 0

  for (let week = 0; week < weeks; week++) {
    for (const dayOfWeek of weekdays) {
      const mondayBasedIndex = (dayOfWeek + 6) % 7
      const dateKey = addDaysToDateKey(weekMonday, week * 7 + mondayBasedIndex)
      if (dateKey < startYmd) continue
      const slotAt = wallClockSlotAtIso(dateKey, wallTime, timeZone)
      if (new Date(slotAt).getTime() <= nowMs) {
        skippedPastCount++
        continue
      }
      payload.push({
        teacher_id: me.id,
        slot_at: slotAt,
        status,
        booked_student_id: status === "booked" ? studentId : null
      })
      if (status === "booked" && studentId) {
        studentSchedulePayload.push({
          student_id: studentId,
          date_key: dateKey,
          time: wallTime,
          title,
          type: "lesson",
          teacher_name: teacherName
        })
      }
    }
  }

  if (payload.length === 0) {
    if (skippedPastCount > 0) {
      const suggested = nextEligibleStartDateKey(startYmd, weekdays, wallTime, timeZone, nowMs)
      return NextResponse.json(
        {
          error:
            "Это время на ближайшие выбранные даты уже прошло в часовом поясе календаря. Укажите дату начала позже или выберите другое время суток.",
          suggested_start_date_key: suggested
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ created: 0 })
  }

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

