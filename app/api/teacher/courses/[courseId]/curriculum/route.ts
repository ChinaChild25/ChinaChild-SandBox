import { NextResponse } from "next/server"
import { assertOwnCustomCourse, requireTeacher } from "@/lib/api/teacher-custom-course-server"

type LessonPlacement = { id: string; moduleId: string | null; order: number }

export async function PATCH(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as {
    moduleOrderedIds?: string[]
    lessons?: LessonPlacement[]
  } | null

  const moduleOrderedIds = body?.moduleOrderedIds
  const lessons = body?.lessons

  if (
    (!moduleOrderedIds || moduleOrderedIds.length === 0) &&
    (!lessons || lessons.length === 0)
  ) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  if (moduleOrderedIds && moduleOrderedIds.length > 0) {
    const { data: rows, error: modErr } = await supabase
      .from("course_modules")
      .select("id")
      .eq("course_id", courseId)

    if (modErr) return NextResponse.json({ error: modErr.message }, { status: 400 })
    const db = new Set((rows ?? []).map((r) => r.id))
    if (moduleOrderedIds.length !== db.size || moduleOrderedIds.some((id) => !db.has(id))) {
      return NextResponse.json({ error: "Invalid module order payload" }, { status: 400 })
    }

    for (let i = 0; i < moduleOrderedIds.length; i++) {
      const { error } = await supabase
        .from("course_modules")
        .update({ order: i })
        .eq("id", moduleOrderedIds[i])
        .eq("course_id", courseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  if (lessons && lessons.length > 0) {
    const { data: lessonRows, error: lesErr } = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", courseId)

    if (lesErr) return NextResponse.json({ error: lesErr.message }, { status: 400 })
    const dbLessonIds = new Set((lessonRows ?? []).map((r) => r.id))
    if (lessons.length !== dbLessonIds.size || lessons.some((l) => !dbLessonIds.has(l.id))) {
      return NextResponse.json({ error: "Invalid lessons payload" }, { status: 400 })
    }

    const { data: modRows } = await supabase.from("course_modules").select("id").eq("course_id", courseId)
    const modIds = new Set((modRows ?? []).map((r) => r.id))

    for (const row of lessons) {
      if (row.moduleId !== null && !modIds.has(row.moduleId)) {
        return NextResponse.json({ error: "Unknown module for lesson" }, { status: 400 })
      }
      const { error } = await supabase
        .from("lessons")
        .update({ module_id: row.moduleId, order: row.order })
        .eq("id", row.id)
        .eq("course_id", courseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}
