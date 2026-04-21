import { NextResponse } from "next/server"
import { assertOwnCustomCourse, requireTeacher } from "@/lib/api/teacher-custom-course-server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>

async function assertOwnModule(supabase: ServerSupabase, courseId: string, moduleId: string) {
  const { data, error } = await supabase
    .from("course_modules")
    .select("id")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .maybeSingle<{ id: string }>()

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!data) return { error: NextResponse.json({ error: "Module not found" }, { status: 404 }) }
  return { ok: true as const }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId, moduleId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error
  const modGuard = await assertOwnModule(supabase, courseId, moduleId)
  if ("error" in modGuard) return modGuard.error

  const body = (await req.json().catch(() => null)) as { title?: string } | null
  const title = body?.title?.trim()
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const { data, error } = await supabase
    .from("course_modules")
    .update({ title })
    .eq("id", moduleId)
    .select("id, course_id, title, order, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ module: data })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId, moduleId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error
  const modGuard = await assertOwnModule(supabase, courseId, moduleId)
  if ("error" in modGuard) return modGuard.error

  const { error } = await supabase.from("course_modules").delete().eq("id", moduleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
