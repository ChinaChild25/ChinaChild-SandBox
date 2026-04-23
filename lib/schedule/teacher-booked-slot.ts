import type { SupabaseClient } from "@supabase/supabase-js"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"

/** Найти фактический `slot_at` брони преподавателя по настенной дате/времени (как в UI). */
export async function findBookedTeacherSlotAt(
  supabase: SupabaseClient,
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
