import { NextResponse } from "next/server"
import { assertOwnCustomCourse, requireTeacher } from "@/lib/api/teacher-custom-course-server"

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const { data, error } = await supabase
    .from("course_student_assignments")
    .select("student_id")
    .eq("course_id", courseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const studentIds = (data ?? []).map((r) => (r as { student_id: string }).student_id)
  return NextResponse.json({ studentIds })
}

export async function PUT(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as { studentIds?: unknown } | null
  const raw = body?.studentIds
  const studentIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []

  const { error } = await supabase.rpc("set_teacher_course_student_assignments", {
    p_course_id: courseId,
    p_student_ids: studentIds
  })

  if (error) {
    const msg = error.message || "Не удалось сохранить назначения"
    if (msg.includes("forbidden") || msg.includes("not authenticated")) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true, studentIds })
}
