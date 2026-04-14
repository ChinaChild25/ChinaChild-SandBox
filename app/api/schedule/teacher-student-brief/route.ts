import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { displayNameFromProfileFields } from "@/lib/supabase/profile"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
  assigned_teacher_id: string | null
}

/**
 * Карточка ученика для кабинета преподавателя по UUID (если ученика нет в демо-журнале).
 * Доступ: как у GET /api/schedule/teacher-student-lessons.
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
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<Pick<ProfileLite, "id" | "role">>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const { data: student, error: studentErr } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id, first_name, last_name, full_name, avatar_url, hsk_level, hsk_goal")
    .eq("id", studentId)
    .maybeSingle<
      ProfileLite & {
        first_name: string | null
        last_name: string | null
        full_name: string | null
        avatar_url: string | null
        hsk_level: number | null
        hsk_goal: number | null
      }
    >()
  if (studentErr || !student) return NextResponse.json({ error: "Student not found" }, { status: 404 })
  if (student.role !== "student") return NextResponse.json({ error: "Not a student profile" }, { status: 400 })

  const assignedToMe = student.assigned_teacher_id === me.id
  let hasBookedWithMe = false
  if (!assignedToMe) {
    const { data: booked } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("teacher_id", me.id)
      .eq("booked_student_id", studentId)
      .eq("status", "booked")
      .limit(1)
      .maybeSingle()
    hasBookedWithMe = Boolean(booked)
  }
  if (!assignedToMe && !hasBookedWithMe) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const name = displayNameFromProfileFields(student, null).trim() || "Ученик"
  let avatarUrl = student.avatar_url?.trim() || ""
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !avatarUrl.startsWith("/")) {
    const normalized = avatarUrl.replace(/^avatars\//, "")
    const { data } = supabase.storage.from("avatars").getPublicUrl(normalized)
    avatarUrl = data.publicUrl || avatarUrl
  }

  return NextResponse.json({
    id: student.id,
    name,
    avatarUrl: avatarUrl || "/placeholders/student-avatar.svg",
    hskLevel: student.hsk_level,
    hskGoal: student.hsk_goal
  })
}
