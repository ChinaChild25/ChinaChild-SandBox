import { NextRequest, NextResponse } from "next/server"
import { mergeTeacherStudentLessonsFromDb } from "@/lib/schedule/merge-teacher-student-lessons"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
  assigned_teacher_id: string | null
}

/**
 * GET ?student_id=<uuid>
 * Тот же порядок слияния, что у ученика в GET /api/schedule/student-lessons:
 * сначала student_schedule_slots, затем booked-слоты этого преподавателя из teacher_schedule_slots
 * (добавляются или дополняют совпадающие по date_key|time). Без записи в БД.
 */
export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("student_id")?.trim() ?? ""
  if (!studentId) return NextResponse.json({ error: "student_id is required" }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const result = await mergeTeacherStudentLessonsFromDb(supabase, me.id, studentId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ lessons: result.lessons })
}
