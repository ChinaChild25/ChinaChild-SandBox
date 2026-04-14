import { NextResponse } from "next/server"
import { parseLessonStart } from "@/lib/schedule-lessons"
import {
  mergeTeacherStudentLessonsFromDb,
  type TeacherStudentMergedLesson
} from "@/lib/schedule/merge-teacher-student-lessons"
import { displayNameFromProfileFields } from "@/lib/supabase/profile"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
}

/**
 * Агрегат занятий преподавателя по всем ученикам с доступом:
 * закреплённые (assigned_teacher_id) и с записью в слоты этого преподавателя (booked).
 * Согласовано с GET /api/schedule/teacher-student-lessons по каждому ученику.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const { data: assignedRows, error: assignedErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .eq("assigned_teacher_id", me.id)
  if (assignedErr) return NextResponse.json({ error: assignedErr.message }, { status: 400 })

  const { data: bookedRows, error: bookedErr } = await supabase
    .from("teacher_schedule_slots")
    .select("booked_student_id")
    .eq("teacher_id", me.id)
    .eq("status", "booked")
  if (bookedErr) return NextResponse.json({ error: bookedErr.message }, { status: 400 })

  const bookedIds = (bookedRows ?? [])
    .map((r) => (r as { booked_student_id: string | null }).booked_student_id)
    .filter((id): id is string => Boolean(id?.trim()))

  const studentIds = [...new Set([...(assignedRows ?? []).map((r) => (r as { id: string }).id), ...bookedIds])]

  if (studentIds.length === 0) {
    return NextResponse.json({ entries: [] })
  }

  const { data: nameRows, error: nameErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name")
    .in("id", studentIds)
  if (nameErr) return NextResponse.json({ error: nameErr.message }, { status: 400 })

  const nameById = new Map<string, string>()
  for (const row of nameRows ?? []) {
    const r = row as {
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string | null
    }
    const name = displayNameFromProfileFields(r, null).trim() || "Ученик"
    nameById.set(r.id, name)
  }

  const mergeResults = await Promise.all(studentIds.map((sid) => mergeTeacherStudentLessonsFromDb(supabase, me.id, sid)))

  const entries: Array<{ studentId: string; studentName: string; lesson: TeacherStudentMergedLesson }> = []

  for (let i = 0; i < studentIds.length; i++) {
    const sid = studentIds[i]
    const result = mergeResults[i]
    if (!result.ok) continue
    const studentName = nameById.get(sid) ?? "Ученик"
    for (const lesson of result.lessons) {
      entries.push({ studentId: sid, studentName, lesson })
    }
  }

  entries.sort((a, b) => {
    const ta = parseLessonStart(a.lesson.dateKey, a.lesson.time).getTime()
    const tb = parseLessonStart(b.lesson.dateKey, b.lesson.time).getTime()
    return ta - tb
  })

  return NextResponse.json({ entries })
}
