import type { SupabaseClient } from "@supabase/supabase-js"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"

/**
 * Приводит student_schedule_slots в соответствие с реальными бронями в teacher_schedule_slots.
 * — Удаляет строки типа «обычное занятие» (type = lesson или null), для которых нет booked-слота у преподавателя.
 * — Создаёт/обновляет строки занятий по всем booked-слотам (teacher_name из профиля).
 * Строки completed / charged_absence и т.п. не трогаем.
 */
export async function reconcileStudentScheduleFromTeacherBookings(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ error: Error | null }> {
  const { data: booked, error: bookErr } = await supabase
    .from("teacher_schedule_slots")
    .select("teacher_id, slot_at")
    .eq("booked_student_id", studentId)
    .eq("status", "booked")

  if (bookErr) return { error: new Error(bookErr.message) }

  const desired = new Map<string, { date_key: string; time: string; teacher_id: string }>()
  for (const row of booked ?? []) {
    const r = row as { teacher_id: string; slot_at: string }
    const { dateKey, time } = wallClockFromSlotAt(r.slot_at)
    const timeNorm = normalizeScheduleSlotTime(time)
    desired.set(`${dateKey}|${timeNorm}`, {
      date_key: dateKey,
      time: timeNorm,
      teacher_id: r.teacher_id
    })
  }

  const teacherIds = [...new Set([...desired.values()].map((v) => v.teacher_id))]
  const teacherNameById = new Map<string, string>()
  if (teacherIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name")
      .in("id", teacherIds)
    for (const p of profs ?? []) {
      const r = p as { id: string; first_name: string | null; last_name: string | null; full_name: string | null }
      const name =
        r.full_name?.trim() ||
        [r.first_name?.trim() ?? "", r.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
        "Преподаватель"
      teacherNameById.set(r.id, name)
    }
  }

  const { data: existing, error: exErr } = await supabase
    .from("student_schedule_slots")
    .select("date_key, time, type")
    .eq("student_id", studentId)

  if (exErr) return { error: new Error(exErr.message) }

  for (const row of existing ?? []) {
    const r = row as { date_key: string; time: string; type: string | null }
    const typeNorm = (r.type ?? "").trim() || "lesson"
    if (typeNorm !== "lesson") continue

    const key = `${r.date_key}|${normalizeScheduleSlotTime(r.time)}`
    if (desired.has(key)) continue

    const { error: delErr } = await supabase
      .from("student_schedule_slots")
      .delete()
      .eq("student_id", studentId)
      .eq("date_key", r.date_key)
      .eq("time", r.time)
    if (delErr) return { error: new Error(delErr.message) }
  }

  for (const slot of desired.values()) {
    const { data: row } = await supabase
      .from("student_schedule_slots")
      .select("type")
      .eq("student_id", studentId)
      .eq("date_key", slot.date_key)
      .eq("time", slot.time)
      .maybeSingle<{ type: string | null }>()

    const existingType = row ? ((row.type ?? "").trim() || "lesson") : "lesson"
    if (existingType !== "lesson") continue

    const { error: upErr } = await supabase.from("student_schedule_slots").upsert(
      {
        student_id: studentId,
        date_key: slot.date_key,
        time: slot.time,
        title: "Занятие",
        type: "lesson",
        teacher_name: teacherNameById.get(slot.teacher_id) ?? null
      },
      { onConflict: "student_id,date_key,time" }
    )
    if (upErr) return { error: new Error(upErr.message) }
  }

  return { error: null }
}

export async function reconcileStudentScheduleFireAndForget(supabase: SupabaseClient, studentId: string) {
  const { error } = await reconcileStudentScheduleFromTeacherBookings(supabase, studentId)
  if (error) console.error("[reconcileStudentSchedule]", studentId, error.message)
}
