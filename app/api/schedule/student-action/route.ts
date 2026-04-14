import { NextResponse } from "next/server"
import { getAppNow } from "@/lib/app-time"
import { wallClockFromDateInSchoolTz, wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { SCHEDULE_WALL_CLOCK_TIMEZONE } from "@/lib/schedule-display-tz"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import { collectWeeklyBookingOccurrences, STUDENT_WEEKLY_BOOKING_MAX_WEEKS } from "@/lib/schedule/weekly-student-booking"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  action?: "cancel" | "reschedule" | "book"
  teacher_id?: string
  lesson?: { slot_at: string; date_key?: string; time?: string }
  to_date_key?: string
  to_hour?: number
  scope?: "single" | "following"
  timezone?: string
}

type Me = { id: string; role: "student" | "teacher" | "curator"; assigned_teacher_id: string | null }

function mapRpcError(message: string): { status: number; error: string } {
  if (/statement timeout|canceling statement due to statement timeout/i.test(message)) {
    return { status: 408, error: "Сервер не успел обработать длинную операцию. Попробуйте еще раз." }
  }
  if (/forbidden|not authenticated/i.test(message)) return { status: 403, error: message }
  if (/slot is not available|new slot is not available|same slot/i.test(message)) {
    return { status: 409, error: message }
  }
  if (/slot not found|old slot not found|new slot not found|slot ownership mismatch/i.test(message)) {
    return { status: 409, error: message }
  }
  return { status: 400, error: message }
}

function isMissingRpcFunction(message: string): boolean {
  return /could not find the function|schema cache/i.test(message)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

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
  const lessonWallDateKey = body.lesson?.date_key?.trim() || (body.lesson?.slot_at ? wallClockFromSlotAt(body.lesson.slot_at).dateKey : "")
  const lessonWallTime = body.lesson?.time?.trim()
    ? normalizeScheduleSlotTime(body.lesson.time.trim())
    : body.lesson?.slot_at
      ? normalizeScheduleSlotTime(wallClockFromSlotAt(body.lesson.slot_at).time)
      : ""
  if (lessonWallDateKey && lessonWallTime) {
    const lessonSlotAt = wallClockSlotAtIso(lessonWallDateKey, lessonWallTime, SCHEDULE_WALL_CLOCK_TIMEZONE)
    const { data: lessonBookedRow } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("booked_student_id", me.id)
      .eq("status", "booked")
      .eq("slot_at", lessonSlotAt)
      .maybeSingle<{ teacher_id: string }>()
    if (lessonBookedRow?.teacher_id) {
      if (requestedTeacherId && requestedTeacherId !== lessonBookedRow.teacher_id) {
        return NextResponse.json({ error: "Teacher does not match lesson booking" }, { status: 409 })
      }
      // Source of truth for cancel/reschedule: booked teacher row for the exact lesson.
      body.teacher_id = lessonBookedRow.teacher_id
    }
  }
  const { data: booked } = await supabase
    .from("teacher_schedule_slots")
    .select("teacher_id")
    .eq("booked_student_id", me.id)
    .eq("status", "booked")
    .order("slot_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ teacher_id: string }>()
  let teacherId = body.teacher_id?.trim() || booked?.teacher_id || me.assigned_teacher_id || ""
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
  const timeZone = body.timezone?.trim() || SCHEDULE_WALL_CLOCK_TIMEZONE
  let mutated = false
  try {
    if (body.action === "book") {
      const toDateKeyValue = body.to_date_key
      const toHour = Number(body.to_hour)
      if (!toDateKeyValue || Number.isNaN(toHour)) {
        return NextResponse.json({ error: "Invalid booking target" }, { status: 400 })
      }
      const toTime = `${String(toHour).padStart(2, "0")}:00`
      if (!isWithinStudentBookingWindow(toDateKeyValue, toTime)) {
        return NextResponse.json(
          { error: "Можно выбрать только свободный слот в будущем в пределах 7 дней" },
          { status: 400 }
        )
      }
      if (scope === "single") {
        const { error } = await supabase.rpc("book_slot_atomic", {
          p_teacher_id: teacherId,
          p_slot_at: wallClockSlotAtIso(toDateKeyValue, toTime, SCHEDULE_WALL_CLOCK_TIMEZONE),
          p_student_id: me.id,
          p_timezone: timeZone
        })
        if (error) {
          const mapped = mapRpcError(error.message || "RPC failed")
          return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        }
        mutated = true
        return NextResponse.json({ ok: true, booked: 1 })
      }
      const occurrences = await collectWeeklyBookingOccurrences(
        supabase,
        teacherId,
        me.id,
        toDateKeyValue,
        toTime,
        STUDENT_WEEKLY_BOOKING_MAX_WEEKS
      )
      if (occurrences.length === 0) return NextResponse.json({ error: "Нет доступных слотов для еженедельного бронирования" }, { status: 409 })
      const slotAts = occurrences.map((occ) => wallClockSlotAtIso(occ.dateKey, occ.time, timeZone))
      let totalBooked = 0
      // Keep each DB call small to avoid PostgreSQL statement timeout.
      for (const slotBatch of chunkArray(slotAts, 24)) {
        const { data: bookedCount, error } = await supabase.rpc("book_following_slots_atomic", {
          p_teacher_id: teacherId,
          p_student_id: me.id,
          p_slot_ats: slotBatch,
          p_timezone: timeZone
        })
        if (error && !isMissingRpcFunction(error.message || "")) {
          const mapped = mapRpcError(error.message || "RPC failed")
          return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        }
        if (error && isMissingRpcFunction(error.message || "")) {
          for (const slotAt of slotBatch) {
            const { error: fallbackErr } = await supabase.rpc("book_slot_atomic", {
              p_teacher_id: teacherId,
              p_slot_at: slotAt,
              p_student_id: me.id,
              p_timezone: timeZone
            })
            if (fallbackErr) {
              const msg = fallbackErr.message || ""
              if (/slot is not available/i.test(msg)) continue
              const mapped = mapRpcError(msg || "RPC failed")
              return NextResponse.json({ error: mapped.error }, { status: mapped.status })
            }
            totalBooked += 1
          }
          continue
        }
        totalBooked += Number(bookedCount ?? 0)
      }
      if (totalBooked <= 0) {
        return NextResponse.json({ error: "Нет доступных слотов для еженедельного бронирования" }, { status: 409 })
      }
      mutated = true
      return NextResponse.json({ ok: true, booked: totalBooked })
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
      const oldSlotAt = wallClockSlotAtIso(oldDateKey, oldTime, SCHEDULE_WALL_CLOCK_TIMEZONE)
      if (scope === "single") {
        const { error } = await supabase.rpc("cancel_slot_atomic", {
          p_slot_at: oldSlotAt,
          p_teacher_id: teacherId,
          p_student_id: me.id,
          p_timezone: timeZone
        })
        if (error) {
          const mapped = mapRpcError(error.message || "RPC failed")
          return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        }
        mutated = true
        return NextResponse.json({ ok: true })
      }

      const { data: cancelledCount, error } = await supabase.rpc("cancel_following_slots_atomic", {
        p_teacher_id: teacherId,
        p_student_id: me.id,
        p_anchor_slot_at: oldSlotAt,
        p_anchor_weekday: new Date(`${oldDateKey}T00:00:00`).getDay(),
        p_anchor_time: oldTime,
        p_timezone: timeZone
      })
      if (error && !isMissingRpcFunction(error.message || "")) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      if (error && isMissingRpcFunction(error.message || "")) {
        const oldWeekday = new Date(`${oldDateKey}T00:00:00`).getDay()
        const { data: bookedRows } = await supabase
          .from("teacher_schedule_slots")
          .select("slot_at")
          .eq("teacher_id", teacherId)
          .eq("booked_student_id", me.id)
          .eq("status", "booked")
        let fallbackCancelled = 0
        for (const row of bookedRows ?? []) {
          const wall = wallClockFromSlotAt((row as { slot_at: string }).slot_at)
          const weekday = new Date(`${wall.dateKey}T00:00:00`).getDay()
          if (wall.dateKey < oldDateKey) continue
          if (weekday !== oldWeekday) continue
          if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
          const { error: fallbackErr } = await supabase.rpc("cancel_slot_atomic", {
            p_slot_at: (row as { slot_at: string }).slot_at,
            p_teacher_id: teacherId,
            p_student_id: me.id,
            p_timezone: timeZone
          })
          if (fallbackErr) {
            const mapped = mapRpcError(fallbackErr.message || "RPC failed")
            return NextResponse.json({ error: mapped.error }, { status: mapped.status })
          }
          fallbackCancelled += 1
        }
        if (fallbackCancelled <= 0) {
          return NextResponse.json({ error: "Не найдено занятий для отмены" }, { status: 409 })
        }
        mutated = true
        return NextResponse.json({ ok: true, cancelled: fallbackCancelled })
      }
      if (Number(cancelledCount ?? 0) <= 0) {
        return NextResponse.json({ error: "Не найдено занятий для отмены" }, { status: 409 })
      }
      mutated = true
      return NextResponse.json({ ok: true, cancelled: Number(cancelledCount ?? 0) })
    }

    const toDateKeyValue = body.to_date_key
    const toHour = Number(body.to_hour)
    if (!toDateKeyValue || Number.isNaN(toHour)) {
      return NextResponse.json({ error: "Invalid reschedule target" }, { status: 400 })
    }
    const toTime = `${String(toHour).padStart(2, "0")}:00`
    const canUseTarget =
      scope === "following"
        ? isWithinStudentBookingWindow(toDateKeyValue, toTime)
        : isWithinStudentRescheduleWindow(toDateKeyValue, toTime)
    if (!canUseTarget) {
      return NextResponse.json(
        {
          error:
            scope === "following"
              ? "Для регулярного переноса можно выбрать только свободный слот в будущем в пределах 7 дней"
              : "Можно переносить только в окно от 24 часов до 7 дней вперёд"
        },
        { status: 400 }
      )
    }

    if (scope === "single") {
      const { error } = await supabase.rpc("reschedule_slot_atomic", {
        p_old_slot_at: wallClockSlotAtIso(oldDateKey, oldTime, SCHEDULE_WALL_CLOCK_TIMEZONE),
        p_new_slot_at: wallClockSlotAtIso(toDateKeyValue, toTime, SCHEDULE_WALL_CLOCK_TIMEZONE),
        p_teacher_id: teacherId,
        p_student_id: me.id,
        p_timezone: timeZone
      })
      if (error) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      mutated = true
      return NextResponse.json({ ok: true })
    }

    const oldStart = new Date(`${oldDateKey}T00:00:00`)
    const newStart = new Date(`${toDateKeyValue}T00:00:00`)
    const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000))
    const { data: movedCount, error } = await supabase.rpc("reschedule_following_slots_atomic", {
      p_teacher_id: teacherId,
      p_student_id: me.id,
      p_anchor_slot_at: wallClockSlotAtIso(oldDateKey, oldTime, timeZone),
      p_anchor_weekday: oldStart.getDay(),
      p_anchor_time: oldTime,
      p_delta_days: deltaDays,
      p_target_time: toTime,
      p_timezone: timeZone
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить операцию с расписанием"
    return NextResponse.json({ error: message }, { status: 400 })
  } finally {
    if (mutated) void reconcileStudentScheduleFireAndForget(supabase, me.id)
  }
}

function isWithinStudentRescheduleWindow(dateKey: string, time: string): boolean {
  const timeNorm = normalizeScheduleSlotTime(time)
  const slotMs = new Date(wallClockSlotAtIso(dateKey, timeNorm, SCHEDULE_WALL_CLOCK_TIMEZONE)).getTime()
  if (Number.isNaN(slotMs)) return false

  const nowWallClock = wallClockFromDateInSchoolTz(getAppNow())
  const nowMs = new Date(
    wallClockSlotAtIso(nowWallClock.dateKey, normalizeScheduleSlotTime(nowWallClock.time), SCHEDULE_WALL_CLOCK_TIMEZONE)
  ).getTime()
  if (Number.isNaN(nowMs)) return false

  const minAheadMs = 24 * 60 * 60 * 1000
  const maxAheadMs = 7 * 24 * 60 * 60 * 1000
  return slotMs > nowMs + minAheadMs && slotMs <= nowMs + maxAheadMs
}

/** Новое бронирование: только будущее, без +24 ч; верхняя граница — 7 дней. */
function isWithinStudentBookingWindow(dateKey: string, time: string): boolean {
  const timeNorm = normalizeScheduleSlotTime(time)
  const slotMs = new Date(wallClockSlotAtIso(dateKey, timeNorm, SCHEDULE_WALL_CLOCK_TIMEZONE)).getTime()
  if (Number.isNaN(slotMs)) return false

  const nowWallClock = wallClockFromDateInSchoolTz(getAppNow())
  const nowMs = new Date(
    wallClockSlotAtIso(nowWallClock.dateKey, normalizeScheduleSlotTime(nowWallClock.time), SCHEDULE_WALL_CLOCK_TIMEZONE)
  ).getTime()
  if (Number.isNaN(nowMs)) return false

  const maxAheadMs = 7 * 24 * 60 * 60 * 1000
  return slotMs > nowMs && slotMs <= nowMs + maxAheadMs
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

