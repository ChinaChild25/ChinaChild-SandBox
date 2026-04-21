import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileRole = "student" | "teacher" | "curator"

async function requireStudent(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { data: me, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: ProfileRole }>()

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!me || me.role !== "student") {
    return { error: NextResponse.json({ error: "Student access required" }, { status: 403 }) }
  }
  return { me }
}

/** Урок доступен, если RLS на lessons разрешает чтение (назначенный курс и т.д.). */
async function lessonVisibleToReader(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  lessonId: string
) {
  const { data, error } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle<{ id: string }>()
  if (error) return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!data) return { ok: false as const, response: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) }
  return { ok: true as const }
}

export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const ctx = await requireStudent(supabase)
  if ("error" in ctx) return ctx.error

  const { lessonId } = await params
  const vis = await lessonVisibleToReader(supabase, lessonId)
  if (!vis.ok) return vis.response

  const { data, error } = await supabase
    .from("student_lesson_completions")
    .select("lesson_id")
    .eq("student_id", ctx.me.id)
    .eq("lesson_id", lessonId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ completed: Boolean(data) })
}

export async function POST(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const ctx = await requireStudent(supabase)
  if ("error" in ctx) return ctx.error

  const { lessonId } = await params
  const vis = await lessonVisibleToReader(supabase, lessonId)
  if (!vis.ok) return vis.response

  const { error } = await supabase.from("student_lesson_completions").upsert(
    { student_id: ctx.me.id, lesson_id: lessonId },
    { onConflict: "student_id,lesson_id" }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ completed: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const ctx = await requireStudent(supabase)
  if ("error" in ctx) return ctx.error

  const { lessonId } = await params
  const vis = await lessonVisibleToReader(supabase, lessonId)
  if (!vis.ok) return vis.response

  const { error } = await supabase
    .from("student_lesson_completions")
    .delete()
    .eq("student_id", ctx.me.id)
    .eq("lesson_id", lessonId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ completed: false })
}
