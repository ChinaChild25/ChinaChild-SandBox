import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileRole = "student" | "teacher" | "curator"

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: ProfileRole }>()

  if (!me || me.role !== "student") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 })
  }

  const { courseId } = await params

  const { data: link, error: linkErr } = await supabase
    .from("course_student_assignments")
    .select("course_id")
    .eq("student_id", me.id)
    .eq("course_id", courseId)
    .maybeSingle<{ course_id: string }>()

  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })
  if (!link) return NextResponse.json({ error: "Курс не назначен или недоступен" }, { status: 404 })

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select(
      "id, title, description, level, cover_color, cover_style, cover_image_url, cover_image_position, is_custom, teacher_id, created_at"
    )
    .eq("id", courseId)
    .maybeSingle()

  if (courseErr) return NextResponse.json({ error: courseErr.message }, { status: 400 })
  if (!course) return NextResponse.json({ error: "Курс не найден" }, { status: 404 })

  const [{ data: lessons, error: lessonsErr }, { data: modules, error: modulesErr }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, course_id, title, order, module_id, created_at")
      .eq("course_id", courseId)
      .order("order", { ascending: true }),
    supabase.from("course_modules").select("id, course_id, title, order, created_at").eq("course_id", courseId).order("order", { ascending: true })
  ])

  if (lessonsErr) return NextResponse.json({ error: lessonsErr.message }, { status: 400 })
  if (modulesErr) return NextResponse.json({ error: modulesErr.message }, { status: 400 })

  return NextResponse.json({
    course,
    lessons: lessons ?? [],
    modules: modules ?? []
  })
}
