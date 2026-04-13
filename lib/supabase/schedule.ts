import type { SupabaseClient } from "@supabase/supabase-js"
import type { ScheduledLesson } from "@/lib/schedule-lessons"

type ScheduleSlotRow = {
  student_id: string
  date_key: string
  time: string
  title: string
  type: string
  teacher_name: string | null
}

export async function loadStudentScheduleFromDb(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ lessons: ScheduledLesson[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("student_schedule_slots")
    .select("student_id, date_key, time, title, type, teacher_name")
    .eq("student_id", studentId)
    .order("date_key", { ascending: true })
    .order("time", { ascending: true })

  if (error) return { lessons: [], error: new Error(error.message) }

  const lessons: ScheduledLesson[] = ((data ?? []) as ScheduleSlotRow[]).map((r) => ({
    id: `slot-${r.student_id}-${r.date_key}-${r.time}`,
    dateKey: r.date_key,
    time: r.time,
    title: r.title,
    type: "lesson",
    teacher: r.teacher_name ?? undefined
  }))
  return { lessons, error: null }
}

export async function saveStudentScheduleToDb(
  supabase: SupabaseClient,
  studentId: string,
  lessons: ScheduledLesson[]
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase.from("student_schedule_slots").delete().eq("student_id", studentId)
  if (delErr) return { error: new Error(delErr.message) }

  if (lessons.length === 0) return { error: null }

  const payload = lessons.map((l) => ({
    student_id: studentId,
    date_key: l.dateKey,
    time: l.time,
    title: l.title,
    type: "lesson",
    teacher_name: l.teacher ?? null
  }))

  const { error: insErr } = await supabase.from("student_schedule_slots").insert(payload)
  if (insErr) return { error: new Error(insErr.message) }
  return { error: null }
}

export async function loadTeacherStudentScheduleMap(
  supabase: SupabaseClient,
  studentIds: string[]
): Promise<{ byStudentId: Map<string, ScheduledLesson[]>; error: Error | null }> {
  if (studentIds.length === 0) return { byStudentId: new Map(), error: null }
  const { data, error } = await supabase
    .from("student_schedule_slots")
    .select("student_id, date_key, time, title, type, teacher_name")
    .in("student_id", studentIds)
    .order("date_key", { ascending: true })
    .order("time", { ascending: true })

  if (error) return { byStudentId: new Map(), error: new Error(error.message) }

  const byStudentId = new Map<string, ScheduledLesson[]>()
  for (const raw of (data ?? []) as ScheduleSlotRow[]) {
    const list = byStudentId.get(raw.student_id) ?? []
    list.push({
      id: `slot-${raw.student_id}-${raw.date_key}-${raw.time}`,
      dateKey: raw.date_key,
      time: raw.time,
      title: raw.title,
      type: "lesson",
      teacher: raw.teacher_name ?? undefined
    })
    byStudentId.set(raw.student_id, list)
  }
  return { byStudentId, error: null }
}
