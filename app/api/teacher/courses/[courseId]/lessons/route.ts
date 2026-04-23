import { NextResponse } from "next/server"
import { assertOwnCustomCourse, requireTeacher } from "@/lib/api/teacher-custom-course-server"

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, course_id, title, order, module_id, created_at")
    .eq("course_id", courseId)
    .order("order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ lessons: lessons ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as { title?: string; moduleId?: string | null } | null
  const title = body?.title?.trim() || "Новый урок"
  let moduleId: string | null = body?.moduleId ?? null

  if (moduleId) {
    const { data: mod } = await supabase
      .from("course_modules")
      .select("id")
      .eq("id", moduleId)
      .eq("course_id", courseId)
      .maybeSingle<{ id: string }>()
    if (!mod) moduleId = null
  }

  const lastLessonQuery = () =>
    supabase
      .from("lessons")
      .select("order")
      .eq("course_id", courseId)
      .order("order", { ascending: false })
      .limit(1)

  const { data: lastLesson } =
    moduleId === null
      ? await lastLessonQuery().is("module_id", null).maybeSingle<{ order: number }>()
      : await lastLessonQuery().eq("module_id", moduleId).maybeSingle<{ order: number }>()

  const nextOrder = (lastLesson?.order ?? -1) + 1
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      title,
      order: nextOrder,
      module_id: moduleId
    })
    .select("id, course_id, title, order, module_id, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ lesson: data }, { status: 201 })
}
