import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileRole = "student" | "teacher" | "curator"

async function requireTeacher() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: ProfileRole }>()

  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return { error: NextResponse.json({ error: "Teacher access required" }, { status: 403 }) }
  }
  return { supabase, me }
}

async function assertOwnCustomLesson(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  lessonId: string
) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, course_id, courses!inner(is_custom, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle<{
      id: string
      course_id: string
      courses: { is_custom: boolean; teacher_id: string | null }
    }>()

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!data) return { error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) }
  if (!data.courses.is_custom || data.courses.teacher_id !== teacherId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { lesson: data }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = await params

  const guard = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as {
    title?: string
    taskBadgeColor?: string
    moduleId?: string | null
    order?: number
  } | null
  const title = body?.title?.trim()
  const taskBadgeColor = body?.taskBadgeColor?.trim()
  const moduleId = body?.moduleId
  const order = body?.order
  if (title === undefined && !taskBadgeColor && moduleId === undefined && order === undefined) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  if (moduleId !== undefined && moduleId !== null) {
    const { data: mod } = await supabase
      .from("course_modules")
      .select("id")
      .eq("id", moduleId)
      .eq("course_id", guard.lesson.course_id)
      .maybeSingle<{ id: string }>()
    if (!mod) return NextResponse.json({ error: "Invalid module" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (title) updates.title = title
  if (taskBadgeColor) updates.task_badge_color = taskBadgeColor
  if (moduleId !== undefined) updates.module_id = moduleId
  if (order !== undefined && Number.isFinite(order)) updates.order = order

  const { data, error } = await supabase
    .from("lessons")
    .update(updates)
    .eq("id", lessonId)
    .select("id, course_id, title, order, module_id, task_badge_color")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ lesson: data })
}

export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = await params

  const guard = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in guard) return guard.error

  const { data, error } = await supabase
    .from("lessons")
    .select("id, course_id, title, order, module_id, task_badge_color")
    .eq("id", lessonId)
    .maybeSingle<{
      id: string
      course_id: string
      title: string
      order: number
      module_id: string | null
      task_badge_color: string | null
    }>()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  return NextResponse.json({ lesson: data })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = await params

  const guard = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in guard) return guard.error

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
