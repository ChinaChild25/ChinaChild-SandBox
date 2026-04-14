import { NextResponse } from "next/server"
import { SCHEDULE_WALL_CLOCK_TIMEZONE, wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  action?: "cancel" | "reschedule"
  lesson?: { slot_at: string; date_key?: string; time?: string; student_id?: string; title?: string }
  to_date_key?: string
  to_hour?: number
  scope?: "single" | "following"
  timezone?: string
}

type ProfileLite = { id: string; role: "teacher" | "curator" | "student" }

function lessonWallKeys(lesson: NonNullable<Body["lesson"]>): { dateKey: string; time: string } {
  const dk = lesson.date_key?.trim()
  const tt = lesson.time?.trim()
  if (dk && tt) {
    return { dateKey: dk, time: normalizeScheduleSlotTime(tt) }
  }
  const w = wallClockFromSlotAt(lesson.slot_at)
  return { dateKey: w.dateKey, time: normalizeScheduleSlotTime(w.time) }
}

function weekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  return new Date(y, m - 1, d).getDay()
}

function mapRpcError(message: string): { status: number; error: string } {
  if (/forbidden|not authenticated/i.test(message)) return { status: 403, error: message }
  if (/slot is not available|new slot is not available|same slot/i.test(message)) {
    return { status: 409, error: "Выбранный слот недоступен" }
  }
  if (/slot not found|old slot not found|new slot not found|slot ownership mismatch/i.test(message)) {
    return { status: 400, error: "Не удалось выполнить перенос: исходный или целевой слот не найден" }
  }
  return { status: 400, error: message }
}

function isMissingRpcFunction(message: string): boolean {
  return /could not find the function|schema cache/i.test(message)
}

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

  const scheduleTimeZone = SCHEDULE_WALL_CLOCK_TIMEZONE

  const { dateKey: oldDateKey, time: oldTime } = lessonWallKeys(lesson)
  const oldWeekday = weekdayFromDateKey(oldDateKey)
  const studentId = lesson.student_id
  let mutated = false

  try {
    const oldSlotAt = wallClockSlotAtIso(oldDateKey, oldTime, scheduleTimeZone)
    if (action === "cancel" && scope === "single") {
      const { error } = await supabase.rpc("cancel_slot_atomic", {
        p_slot_at: oldSlotAt,
        p_teacher_id: me.id,
        p_student_id: lesson.student_id,
        p_timezone: scheduleTimeZone
      })
      if (error) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      mutated = true
      return NextResponse.json({ ok: true })
    }
    if (action === "cancel" && scope === "following") {
      const { data: cancelledCount, error } = await supabase.rpc("cancel_following_slots_atomic", {
        p_teacher_id: me.id,
        p_student_id: lesson.student_id,
        p_anchor_slot_at: oldSlotAt,
        p_anchor_weekday: oldWeekday,
        p_anchor_time: oldTime,
        p_timezone: scheduleTimeZone
      })
      if (error && !isMissingRpcFunction(error.message || "")) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      if (error && isMissingRpcFunction(error.message || "")) {
        const { data: bookedRows, error: bookedErr } = await supabase
          .from("teacher_schedule_slots")
          .select("slot_at")
          .eq("teacher_id", me.id)
          .eq("booked_student_id", lesson.student_id)
          .eq("status", "booked")
        if (bookedErr) return NextResponse.json({ error: bookedErr.message }, { status: 400 })
        let fallbackCancelled = 0
        for (const row of bookedRows ?? []) {
          const wall = wallClockFromSlotAt((row as { slot_at: string }).slot_at)
          if (wall.dateKey < oldDateKey) continue
          if (weekdayFromDateKey(wall.dateKey) !== oldWeekday) continue
          if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
          const { error: fallbackErr } = await supabase.rpc("cancel_slot_atomic", {
            p_slot_at: (row as { slot_at: string }).slot_at,
            p_teacher_id: me.id,
            p_student_id: lesson.student_id,
            p_timezone: scheduleTimeZone
          })
          if (fallbackErr) {
            const mapped = mapRpcError(fallbackErr.message || "RPC failed")
            return NextResponse.json({ error: mapped.error }, { status: mapped.status })
          }
          fallbackCancelled += 1
        }
        if (fallbackCancelled <= 0) return NextResponse.json({ error: "Не найдено занятий для отмены" }, { status: 409 })
        mutated = true
        return NextResponse.json({ ok: true, cancelled: fallbackCancelled })
      }
      if (Number(cancelledCount ?? 0) <= 0) {
        return NextResponse.json({ error: "Не найдено занятий для отмены" }, { status: 409 })
      }
      mutated = true
      return NextResponse.json({ ok: true, cancelled: Number(cancelledCount ?? 0) })
    }

    const toDateKey = body?.to_date_key
    const toHour = Number(body?.to_hour)
    if (!toDateKey || Number.isNaN(toHour) || toHour < 0 || toHour > 23) {
      return NextResponse.json({ error: "Invalid reschedule target" }, { status: 400 })
    }
    const toTime = `${String(toHour).padStart(2, "0")}:00`
    const newSlotAt = wallClockSlotAtIso(toDateKey, toTime, scheduleTimeZone)

    if (scope === "single") {
      const { error } = await supabase.rpc("reschedule_slot_atomic", {
        p_old_slot_at: oldSlotAt,
        p_new_slot_at: newSlotAt,
        p_teacher_id: me.id,
        p_student_id: lesson.student_id,
        p_timezone: scheduleTimeZone
      })
      if (error) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      mutated = true
      return NextResponse.json({ ok: true })
    }

    const oldStart = new Date(`${oldDateKey}T00:00:00`)
    const newStart = new Date(`${toDateKey}T00:00:00`)
    const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000))
    const { data: movedCount, error } = await supabase.rpc("reschedule_following_slots_atomic", {
      p_teacher_id: me.id,
      p_student_id: lesson.student_id,
      p_anchor_slot_at: oldSlotAt,
      p_anchor_weekday: oldWeekday,
      p_anchor_time: oldTime,
      p_delta_days: deltaDays,
      p_target_time: toTime,
      p_timezone: scheduleTimeZone
    })
    if (error) {
      const mapped = mapRpcError(error.message || "RPC failed")
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    if (Number(movedCount ?? 0) <= 0) {
      return NextResponse.json({ error: "Не найдено занятий для переноса" }, { status: 409 })
    }

    mutated = true
    return NextResponse.json({ ok: true, moved: Number(movedCount ?? 0) })
  } finally {
    if (mutated) void reconcileStudentScheduleFireAndForget(supabase, studentId)
  }
}

