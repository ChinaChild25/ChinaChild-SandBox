import { NextResponse } from "next/server"
import { SCHEDULE_WALL_CLOCK_TIMEZONE, wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { isValidTeacherRescheduleTargetSlot } from "@/lib/schedule-lessons"
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
  // Canonical source of truth for schedule mutations is slot_at.
  // Client date_key/time can drift in viewer timezone and break old/new slot matching.
  if (lesson.slot_at?.trim()) {
    const w = wallClockFromSlotAt(lesson.slot_at)
    return { dateKey: w.dateKey, time: normalizeScheduleSlotTime(w.time) }
  }
  const dk = lesson.date_key?.trim()
  const tt = lesson.time?.trim()
  if (dk && tt) return { dateKey: dk, time: normalizeScheduleSlotTime(tt) }
  return { dateKey: "1970-01-01", time: "00:00" }
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

function isSlotNotFoundError(message: string): boolean {
  return /slot not found|old slot not found|new slot not found/i.test(message)
}

async function dedupeFollowingTeacherMoves(
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never,
  teacherId: string,
  studentId: string,
  pairs: Array<{ sourceSlotAt: string; targetSlotAt: string }>,
  timeZone: string
): Promise<{ cleaned: number; error: string | null }> {
  const uniq = new Map<string, { sourceSlotAt: string; targetSlotAt: string }>()
  for (const p of pairs) {
    if (p.sourceSlotAt === p.targetSlotAt) continue
    uniq.set(`${p.sourceSlotAt}=>${p.targetSlotAt}`, p)
  }
  const list = Array.from(uniq.values())
  if (list.length === 0) return { cleaned: 0, error: null }

  const allSlotAts = [...new Set(list.flatMap((x) => [x.sourceSlotAt, x.targetSlotAt]))]
  const { data: rows, error: rowsErr } = await supabase
    .from("teacher_schedule_slots")
    .select("slot_at, status, booked_student_id")
    .eq("teacher_id", teacherId)
    .in("slot_at", allSlotAts)
  if (rowsErr) return { cleaned: 0, error: rowsErr.message }

  const bySlotAt = new Map(
    (rows ?? []).map((r) => [
      (r as { slot_at: string }).slot_at,
      r as { slot_at: string; status: "free" | "busy" | "booked"; booked_student_id: string | null }
    ])
  )

  let cleaned = 0
  for (const pair of list) {
    const src = bySlotAt.get(pair.sourceSlotAt)
    const tgt = bySlotAt.get(pair.targetSlotAt)
    const sourceBooked = src?.status === "booked" && src.booked_student_id === studentId
    const targetBooked = tgt?.status === "booked" && tgt.booked_student_id === studentId
    if (!sourceBooked || !targetBooked) continue

    const { error: cancelErr } = await supabase.rpc("cancel_slot_atomic", {
      p_slot_at: pair.sourceSlotAt,
      p_teacher_id: teacherId,
      p_student_id: studentId,
      p_timezone: timeZone
    })
    if (cancelErr && !/slot ownership mismatch|slot not found/i.test(cancelErr.message || "")) {
      return { cleaned, error: cancelErr.message || "cancel failed" }
    }
    if (!cancelErr) cleaned += 1
  }
  return { cleaned, error: null }
}

async function ensureTeacherSlotExists(
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never,
  teacherId: string,
  slotAt: string
) {
  const { error } = await supabase
    .from("teacher_schedule_slots")
    .insert({ teacher_id: teacherId, slot_at: slotAt, status: "free", booked_student_id: null })
  if (!error) return
  // Ignore unique conflicts, fail fast on anything else.
  if (error.code === "23505") return
  throw new Error(error.message || "Не удалось подготовить слот для переноса")
}

async function ensureTeacherSlotReservable(
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never,
  teacherId: string,
  slotAt: string
) {
  await ensureTeacherSlotExists(supabase, teacherId, slotAt)
  // Teacher can move lessons into slots outside availability template.
  // Keep hard protection against booked slots; only unlock busy -> free.
  const { error } = await supabase
    .from("teacher_schedule_slots")
    .update({ status: "free" })
    .eq("teacher_id", teacherId)
    .eq("slot_at", slotAt)
    .eq("status", "busy")
    .is("booked_student_id", null)
  if (error) throw new Error(error.message || "Не удалось подготовить целевой слот для переноса")
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
    if (!isValidTeacherRescheduleTargetSlot(toDateKey, toTime)) {
      return NextResponse.json(
        { error: "Преподаватель может переносить только в будущий свободный слот" },
        { status: 400 }
      )
    }
    const newSlotAt = wallClockSlotAtIso(toDateKey, toTime, scheduleTimeZone)

    if (scope === "single") {
      const tryRescheduleSingle = () =>
        supabase.rpc("reschedule_slot_atomic", {
          p_old_slot_at: oldSlotAt,
          p_new_slot_at: newSlotAt,
          p_teacher_id: me.id,
          p_student_id: lesson.student_id,
          p_timezone: scheduleTimeZone
        })
      await ensureTeacherSlotReservable(supabase, me.id, newSlotAt)
      let { error } = await tryRescheduleSingle()
      if (error && isSlotNotFoundError(error.message || "")) {
        await ensureTeacherSlotReservable(supabase, me.id, newSlotAt)
        const retry = await tryRescheduleSingle()
        error = retry.error
      }
      if (error) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      mutated = true
      return NextResponse.json({ ok: true })
    }

    const tryRescheduleFollowing = () =>
      supabase.rpc("reschedule_following_slots_atomic", {
        p_teacher_id: me.id,
        p_student_id: lesson.student_id,
        p_anchor_slot_at: oldSlotAt,
        p_anchor_weekday: oldWeekday,
        p_anchor_time: oldTime,
        p_delta_days: deltaDays,
        p_target_time: toTime,
        p_timezone: scheduleTimeZone
      })

    const oldStart = new Date(`${oldDateKey}T00:00:00`)
    const newStart = new Date(`${toDateKey}T00:00:00`)
    const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000))
    const followingPairKeys = new Set<string>()
    const followingCandidates: Array<{ sourceSlotAt: string; targetSlotAt: string }> = []
    const pushFollowingPair = (sourceSlotAt: string, targetSlotAt: string) => {
      if (sourceSlotAt === targetSlotAt) return
      const key = `${sourceSlotAt}=>${targetSlotAt}`
      if (followingPairKeys.has(key)) return
      followingPairKeys.add(key)
      followingCandidates.push({ sourceSlotAt, targetSlotAt })
    }
    // Pre-unlock target slots for teacher recurring move (busy -> free), so batch RPC
    // does not silently skip otherwise valid targets outside availability template.
    {
      const { data: bookedRows, error: bookedErr } = await supabase
        .from("teacher_schedule_slots")
        .select("slot_at")
        .eq("teacher_id", me.id)
        .eq("booked_student_id", lesson.student_id)
        .eq("status", "booked")
      if (bookedErr) {
        return NextResponse.json({ error: bookedErr.message }, { status: 400 })
      }
      for (const row of bookedRows ?? []) {
        const slotAt = (row as { slot_at: string }).slot_at
        const wall = wallClockFromSlotAt(slotAt)
        if (wall.dateKey < oldDateKey) continue
        if (weekdayFromDateKey(wall.dateKey) !== oldWeekday) continue
        if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
        const targetDate = new Date(`${wall.dateKey}T00:00:00`)
        targetDate.setDate(targetDate.getDate() + deltaDays)
        const targetDateKey = [
          String(targetDate.getFullYear()),
          String(targetDate.getMonth() + 1).padStart(2, "0"),
          String(targetDate.getDate()).padStart(2, "0")
        ].join("-")
        const targetSlotAt = wallClockSlotAtIso(targetDateKey, toTime, scheduleTimeZone)
        pushFollowingPair(slotAt, targetSlotAt)
        await ensureTeacherSlotReservable(supabase, me.id, targetSlotAt)
      }
    }
    let { data: movedCount, error } = await tryRescheduleFollowing()
    if (error && isMissingRpcFunction(error.message || "")) {
      const { data: bookedRows, error: bookedErr } = await supabase
        .from("teacher_schedule_slots")
        .select("slot_at")
        .eq("teacher_id", me.id)
        .eq("booked_student_id", lesson.student_id)
        .eq("status", "booked")
      if (bookedErr) {
        return NextResponse.json({ error: bookedErr.message }, { status: 400 })
      }
      let fallbackMoved = 0
      for (const row of bookedRows ?? []) {
        const slotAt = (row as { slot_at: string }).slot_at
        const wall = wallClockFromSlotAt(slotAt)
        if (wall.dateKey < oldDateKey) continue
        if (weekdayFromDateKey(wall.dateKey) !== oldWeekday) continue
        if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
        const targetDate = new Date(`${wall.dateKey}T00:00:00`)
        targetDate.setDate(targetDate.getDate() + deltaDays)
        const targetDateKey = [
          String(targetDate.getFullYear()),
          String(targetDate.getMonth() + 1).padStart(2, "0"),
          String(targetDate.getDate()).padStart(2, "0")
        ].join("-")
        const targetSlotAt = wallClockSlotAtIso(targetDateKey, toTime, scheduleTimeZone)
        pushFollowingPair(slotAt, targetSlotAt)
        await ensureTeacherSlotReservable(supabase, me.id, targetSlotAt)
        const { error: fallbackErr } = await supabase.rpc("reschedule_slot_atomic", {
          p_old_slot_at: slotAt,
          p_new_slot_at: targetSlotAt,
          p_teacher_id: me.id,
          p_student_id: lesson.student_id,
          p_timezone: scheduleTimeZone
        })
        if (fallbackErr) {
          const mapped = mapRpcError(fallbackErr.message || "RPC failed")
          return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        }
        fallbackMoved += 1
      }
      if (fallbackMoved <= 0) {
        return NextResponse.json({ error: "Не найдено занятий для переноса" }, { status: 409 })
      }
      const dedupedFallback = await dedupeFollowingTeacherMoves(
        supabase,
        me.id,
        studentId,
        followingCandidates,
        scheduleTimeZone
      )
      if (dedupedFallback.error) {
        return NextResponse.json({ error: dedupedFallback.error }, { status: 400 })
      }
      mutated = true
      return NextResponse.json({ ok: true, moved: fallbackMoved + dedupedFallback.cleaned })
    }
    if (error && isSlotNotFoundError(error.message || "")) {
      const { data: bookedRows, error: bookedErr } = await supabase
        .from("teacher_schedule_slots")
        .select("slot_at")
        .eq("teacher_id", me.id)
        .eq("booked_student_id", lesson.student_id)
        .eq("status", "booked")
      if (bookedErr) {
        return NextResponse.json({ error: bookedErr.message }, { status: 400 })
      }
      for (const row of bookedRows ?? []) {
        const slotAt = (row as { slot_at: string }).slot_at
        const wall = wallClockFromSlotAt(slotAt)
        if (wall.dateKey < oldDateKey) continue
        if (weekdayFromDateKey(wall.dateKey) !== oldWeekday) continue
        if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
        const targetDate = new Date(`${wall.dateKey}T00:00:00`)
        targetDate.setDate(targetDate.getDate() + deltaDays)
        const targetDateKey = [
          String(targetDate.getFullYear()),
          String(targetDate.getMonth() + 1).padStart(2, "0"),
          String(targetDate.getDate()).padStart(2, "0")
        ].join("-")
        const targetSlotAt = wallClockSlotAtIso(targetDateKey, toTime, scheduleTimeZone)
        pushFollowingPair(slotAt, targetSlotAt)
        await ensureTeacherSlotReservable(supabase, me.id, targetSlotAt)
      }
      const retry = await tryRescheduleFollowing()
      movedCount = retry.data
      error = retry.error
    }
    if (error) {
      const mapped = mapRpcError(error.message || "RPC failed")
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    const deduped = await dedupeFollowingTeacherMoves(supabase, me.id, studentId, followingCandidates, scheduleTimeZone)
    if (deduped.error) {
      return NextResponse.json({ error: deduped.error }, { status: 400 })
    }
    const totalMoved = Number(movedCount ?? 0) + deduped.cleaned
    if (totalMoved <= 0) {
      return NextResponse.json({ error: "Не найдено занятий для переноса" }, { status: 409 })
    }

    mutated = true
    return NextResponse.json({ ok: true, moved: totalMoved })
  } finally {
    if (mutated) void reconcileStudentScheduleFireAndForget(supabase, studentId)
  }
}

