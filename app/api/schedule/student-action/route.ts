import { NextResponse } from "next/server"
import { getStudentBalanceState } from "@/lib/billing-server"
import { addDaysToDateKey } from "@/lib/schedule/calendar-ymd"
import {
  matchesFollowingSeriesSlot,
  forwardWeekdayShiftDays,
  minDateKeyForFollowingRescheduleCluster,
  minDateKeyForFollowingSeries,
  calendarWeekdayFromDateKey
} from "@/lib/schedule/following-series"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { SCHEDULE_WALL_CLOCK_TIMEZONE } from "@/lib/schedule-display-tz"
import { reconcileStudentScheduleFireAndForget } from "@/lib/schedule/reconcile-student-schedule"
import {
  isValidFollowingRescheduleTargetForLesson,
  isValidRescheduleTargetSlot,
  isValidStudentWeeklyBookingAnchorSlot
} from "@/lib/schedule-lessons"
import { lessonWallKeysFromBody } from "@/lib/schedule/lesson-wall-keys"
import { collectWeeklyBookingOccurrences, STUDENT_WEEKLY_BOOKING_MAX_WEEKS } from "@/lib/schedule/weekly-student-booking"
import { normalizeScheduleSlotTime, timestamptzInstantEqual, timestamptzInstantKey, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  action?: "cancel" | "reschedule" | "book"
  teacher_id?: string
  lesson?: { slot_at: string; date_key?: string; time?: string }
  to_date_key?: string
  to_hour?: number
  scope?: "single" | "following"
  timezone?: string
  now_date_key?: string
  now_time?: string
}

type Me = { id: string; role: "student" | "teacher" | "curator"; assigned_teacher_id: string | null }

function mapRpcError(message: string): { status: number; error: string } {
  if (/statement timeout|canceling statement due to statement timeout/i.test(message)) {
    return { status: 408, error: "Сервер не успел обработать длинную операцию. Попробуйте еще раз." }
  }
  if (/violates row-level security policy/i.test(message)) {
    return { status: 403, error: "Недостаточно прав для изменения этого слота" }
  }
  if (/forbidden|not authenticated/i.test(message)) return { status: 403, error: message }
  if (/slot not available/i.test(message)) {
    return {
      status: 409,
      error: "Этот слот у преподавателя недоступен для переноса (занят или не входит в доступные часы)."
    }
  }
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

function parseRequiredNowWall(body: Body): { dateKey: string; time: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.now_date_key ?? "")) return null
  if (typeof body.now_time !== "string") return null
  return { dateKey: body.now_date_key as string, time: normalizeScheduleSlotTime(body.now_time) }
}

async function ensureStudentTargetSlotExists(
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never,
  teacherId: string,
  slotAt: string,
  timeZone: string
) {
  const { error } = await supabase.rpc("ensure_slot_for_student_reschedule", {
    p_teacher_id: teacherId,
    p_slot_at: slotAt,
    p_timezone: timeZone
  })
  if (error) throw new Error(error.message || "Не удалось подготовить целевой слот")
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
  const timeZone = SCHEDULE_WALL_CLOCK_TIMEZONE
  const nowWall = parseRequiredNowWall(body)
  if (!nowWall) {
    return NextResponse.json(
      { error: "now_date_key and now_time are required in client wall-clock format" },
      { status: 400 }
    )
  }
  let mutated = false
  try {
    if (body.action === "book") {
      const balanceState = await getStudentBalanceState(supabase, me.id)
      if (balanceState.blocked) {
        return NextResponse.json(
          { error: "Баланс занятий исчерпан. Пополните баланс, чтобы записаться на урок." },
          { status: 402 }
        )
      }

      const toDateKeyValue = body.to_date_key
      const toHour = Number(body.to_hour)
      if (!toDateKeyValue || Number.isNaN(toHour)) {
        return NextResponse.json({ error: "Invalid booking target" }, { status: 400 })
      }
      const toTime = `${String(toHour).padStart(2, "0")}:00`
      if (scope === "single") {
        if (!isValidRescheduleTargetSlot(toDateKeyValue, toTime, nowWall)) {
          return NextResponse.json(
            { error: "Можно выбрать только слот не раньше чем через 24 часа и в пределах 7 дней" },
            { status: 400 }
          )
        }
      } else if (!isValidStudentWeeklyBookingAnchorSlot(toDateKeyValue, toTime, nowWall)) {
        return NextResponse.json(
          {
            error:
              "Для еженедельного бронирования выберите дату и время в пределах 14 дней; до начала первого урока должно оставаться больше 24 часов."
          },
          { status: 400 }
        )
      }
      if (scope === "single") {
        const { error } = await supabase.rpc("book_slot_atomic", {
          p_teacher_id: teacherId,
          p_slot_at: wallClockSlotAtIso(toDateKeyValue, toTime, SCHEDULE_WALL_CLOCK_TIMEZONE),
          p_student_id: me.id,
          p_now_date_key: nowWall.dateKey,
          p_now_time: nowWall.time,
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
        STUDENT_WEEKLY_BOOKING_MAX_WEEKS,
        nowWall
      )
      if (occurrences.length === 0) return NextResponse.json({ error: "Нет доступных слотов для еженедельного бронирования" }, { status: 409 })
      const requestedSlots = occurrences.length
      const slotAts = occurrences.map((occ) => wallClockSlotAtIso(occ.dateKey, occ.time, timeZone))
      let totalBooked = 0
      // Один RPC с увеличенным statement_timeout в БД; при необходимости режем на части.
      const FOLLOWING_RPC_CHUNK = 52
      for (const slotBatch of chunkArray(slotAts, FOLLOWING_RPC_CHUNK)) {
        const { data: bookedCount, error } = await supabase.rpc("book_following_slots_atomic", {
          p_teacher_id: teacherId,
          p_student_id: me.id,
          p_slot_ats: slotBatch,
          p_now_date_key: nowWall.dateKey,
          p_now_time: nowWall.time,
          p_timezone: timeZone
        })
        if (error && !isMissingRpcFunction(error.message || "")) {
          const mapped = mapRpcError(error.message || "RPC failed")
          if (totalBooked > 0) {
            mutated = true
            void reconcileStudentScheduleFireAndForget(supabase, me.id)
          }
          return NextResponse.json(
            {
              error: mapped.error,
              booked: totalBooked,
              requested: requestedSlots,
              partial: totalBooked > 0
            },
            { status: mapped.status }
          )
        }
        if (error && isMissingRpcFunction(error.message || "")) {
          for (const slotAt of slotBatch) {
            const { error: fallbackErr } = await supabase.rpc("book_slot_atomic", {
              p_teacher_id: teacherId,
              p_slot_at: slotAt,
              p_student_id: me.id,
              p_now_date_key: nowWall.dateKey,
              p_now_time: nowWall.time,
              p_timezone: timeZone
            })
            if (fallbackErr) {
              const msg = fallbackErr.message || ""
              if (/slot is not available/i.test(msg)) continue
              const mapped = mapRpcError(msg || "RPC failed")
              if (totalBooked > 0) {
                mutated = true
                void reconcileStudentScheduleFireAndForget(supabase, me.id)
              }
              return NextResponse.json(
                {
                  error: mapped.error,
                  booked: totalBooked,
                  requested: requestedSlots,
                  partial: totalBooked > 0
                },
                { status: mapped.status }
              )
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
      const partial = totalBooked < requestedSlots
      return NextResponse.json({ ok: true, booked: totalBooked, requested: requestedSlots, partial })
    }

    if (!body.lesson?.slot_at?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { dateKey: oldDateKey, time: oldTime } = lessonWallKeysFromBody(body.lesson)

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

      const seriesWeekday = calendarWeekdayFromDateKey(oldDateKey)
      const seriesAnchorDateKey =
        (await minDateKeyForFollowingSeries(supabase, teacherId, me.id, seriesWeekday, oldTime)) ?? oldDateKey
      const anchorSlotAt = wallClockSlotAtIso(seriesAnchorDateKey, oldTime, timeZone)

      const { data: cancelledCount, error } = await supabase.rpc("cancel_following_slots_atomic", {
        p_teacher_id: teacherId,
        p_student_id: me.id,
        p_anchor_slot_at: anchorSlotAt,
        p_anchor_weekday: seriesWeekday,
        p_anchor_time: oldTime,
        p_timezone: timeZone
      })
      if (error && !isMissingRpcFunction(error.message || "")) {
        const mapped = mapRpcError(error.message || "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      if (error && isMissingRpcFunction(error.message || "")) {
        const { data: bookedRows } = await supabase
          .from("teacher_schedule_slots")
          .select("slot_at")
          .eq("teacher_id", teacherId)
          .eq("booked_student_id", me.id)
          .eq("status", "booked")
        let fallbackCancelled = 0
        for (const row of bookedRows ?? []) {
          const wall = wallClockFromSlotAt((row as { slot_at: string }).slot_at)
          if (wall.dateKey < seriesAnchorDateKey) continue
          if (!matchesFollowingSeriesSlot(wall, seriesWeekday, oldTime)) continue
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
        ? isValidFollowingRescheduleTargetForLesson(oldDateKey, toDateKeyValue, toTime, nowWall)
        : isValidRescheduleTargetSlot(toDateKeyValue, toTime, nowWall)
    if (!canUseTarget) {
      return NextResponse.json(
        {
          error:
            scope === "following"
              ? "Первое занятие после переноса должно начаться не раньше чем через 24 часа (с учётом сдвига на новый день недели) и в пределах примерно шести недель"
              : "Можно переносить только в окно от 24 часов до 7 дней вперёд"
        },
        { status: 400 }
      )
    }

    if (scope === "single") {
      const newSlotAt = wallClockSlotAtIso(toDateKeyValue, toTime, timeZone)
      try {
        await ensureStudentTargetSlotExists(supabase, teacherId, newSlotAt, timeZone)
      } catch (e) {
        const mapped = mapRpcError(e instanceof Error ? e.message : "RPC failed")
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      const { error } = await supabase.rpc("reschedule_slot_atomic", {
        p_old_slot_at: wallClockSlotAtIso(oldDateKey, oldTime, timeZone),
        p_new_slot_at: newSlotAt,
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

    const clusterSourceWeekday = calendarWeekdayFromDateKey(oldDateKey)
    const clusterTargetWeekday = calendarWeekdayFromDateKey(toDateKeyValue)
    const seriesAnchorDateKey =
      (await minDateKeyForFollowingRescheduleCluster(
        supabase,
        teacherId,
        me.id,
        clusterSourceWeekday,
        clusterTargetWeekday,
        oldTime
      )) ?? oldDateKey
    const followingCandidates: Array<{ sourceSlotAt: string; targetSlotAt: string }> = []
    {
      const { data: bookedRows, error: bookedErr } = await supabase
        .from("teacher_schedule_slots")
        .select("slot_at")
        .eq("teacher_id", teacherId)
        .eq("booked_student_id", me.id)
        .eq("status", "booked")
      if (bookedErr) return NextResponse.json({ error: bookedErr.message }, { status: 400 })

      const inCluster = (wd: number) => wd === clusterSourceWeekday || wd === clusterTargetWeekday

      let seriesFromAnchor = 0
      let mismatchesFromAnchor = 0
      for (const row of bookedRows ?? []) {
        const slotAt = (row as { slot_at: string }).slot_at
        const wall = wallClockFromSlotAt(slotAt)
        if (wall.dateKey < seriesAnchorDateKey) continue
        const rowWd = calendarWeekdayFromDateKey(wall.dateKey)
        if (!inCluster(rowWd)) continue
        if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
        seriesFromAnchor += 1
        const rowDelta = forwardWeekdayShiftDays(rowWd, clusterTargetWeekday)
        const targetDateKey = addDaysToDateKey(wall.dateKey, rowDelta)
        const targetSlotAt = wallClockSlotAtIso(targetDateKey, toTime, timeZone)
        if (!timestamptzInstantEqual(slotAt, targetSlotAt)) mismatchesFromAnchor += 1
      }
      if (seriesFromAnchor > 0 && mismatchesFromAnchor === 0) {
        return NextResponse.json(
          { error: "Занятия этой серии уже стоят на выбранный день недели и время." },
          { status: 409 }
        )
      }

      for (const row of bookedRows ?? []) {
        const slotAt = (row as { slot_at: string }).slot_at
        const wall = wallClockFromSlotAt(slotAt)
        if (wall.dateKey < seriesAnchorDateKey) continue
        const rowWd = calendarWeekdayFromDateKey(wall.dateKey)
        if (!inCluster(rowWd)) continue
        if (normalizeScheduleSlotTime(wall.time) !== oldTime) continue
        const rowDelta = forwardWeekdayShiftDays(rowWd, clusterTargetWeekday)
        const targetDateKey = addDaysToDateKey(wall.dateKey, rowDelta)
        const targetSlotAt = wallClockSlotAtIso(targetDateKey, toTime, timeZone)
        if (!timestamptzInstantEqual(slotAt, targetSlotAt)) {
          followingCandidates.push({ sourceSlotAt: slotAt, targetSlotAt })
        }
        try {
          await ensureStudentTargetSlotExists(supabase, teacherId, targetSlotAt, timeZone)
        } catch (e) {
          const mapped = mapRpcError(e instanceof Error ? e.message : "RPC failed")
          return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        }
      }
    }
    const { data: movedCount, error } = await supabase.rpc("reschedule_following_slots_atomic", {
      p_teacher_id: teacherId,
      p_student_id: me.id,
      p_anchor_slot_at: wallClockSlotAtIso(seriesAnchorDateKey, oldTime, timeZone),
      p_cluster_weekday_a: clusterSourceWeekday,
      p_cluster_weekday_b: clusterTargetWeekday,
      p_target_time: toTime,
      p_timezone: timeZone
    })
    if (error) {
      const mapped = mapRpcError(error.message || "RPC failed")
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    // Self-heal legacy duplicates: if target is already booked by the same student,
    // old slot from this exact "following" move should be released.
    let cleanedDuplicates = 0
    if (followingCandidates.length > 0) {
      const allSlotAts = [
        ...new Set(followingCandidates.flatMap((x) => [x.sourceSlotAt, x.targetSlotAt]))
      ]
      const { data: rows, error: rowsErr } = await supabase
        .from("teacher_schedule_slots")
        .select("slot_at, status, booked_student_id")
        .eq("teacher_id", teacherId)
        .in("slot_at", allSlotAts)
      if (rowsErr) {
        return NextResponse.json({ error: rowsErr.message }, { status: 400 })
      }
      const bySlotAt = new Map<string, { slot_at: string; status: "free" | "busy" | "booked"; booked_student_id: string | null }>()
      for (const r of rows ?? []) {
        const row = r as { slot_at: string; status: "free" | "busy" | "booked"; booked_student_id: string | null }
        bySlotAt.set(timestamptzInstantKey(row.slot_at), row)
      }
      for (const pair of followingCandidates) {
        const src = bySlotAt.get(timestamptzInstantKey(pair.sourceSlotAt))
        const tgt = bySlotAt.get(timestamptzInstantKey(pair.targetSlotAt))
        const sourceBookedByMe = src?.status === "booked" && src.booked_student_id === me.id
        const targetBookedByMe = tgt?.status === "booked" && tgt.booked_student_id === me.id
        if (!sourceBookedByMe || !targetBookedByMe) continue
        const { error: cancelErr } = await supabase.rpc("cancel_slot_atomic", {
          p_slot_at: pair.sourceSlotAt,
          p_teacher_id: teacherId,
          p_student_id: me.id,
          p_timezone: timeZone
        })
        if (cancelErr && !/slot ownership mismatch|slot not found/i.test(cancelErr.message || "")) {
          const mapped = mapRpcError(cancelErr.message || "RPC failed")
          return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        }
        if (!cancelErr) cleanedDuplicates += 1
      }
    }
    const totalMoved = Number(movedCount ?? 0) + cleanedDuplicates
    if (totalMoved <= 0) {
      const hint =
        followingCandidates.length > 0
          ? "Часть слотов в серии занята или недоступна у преподавателя. Выберите другое время или обратитесь в поддержку."
          : "Подходящих занятий для переноса не найдено."
      return NextResponse.json({ error: `Не удалось перенести серию: ${hint}` }, { status: 409 })
    }

    mutated = true
    return NextResponse.json({ ok: true, moved: totalMoved })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить операцию с расписанием"
    return NextResponse.json({ error: message }, { status: 400 })
  } finally {
    if (mutated) void reconcileStudentScheduleFireAndForget(supabase, me.id)
  }
}
