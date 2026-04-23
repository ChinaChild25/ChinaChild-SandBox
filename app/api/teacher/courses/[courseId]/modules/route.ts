import { NextResponse } from "next/server"
import { assertOwnCustomCourse, requireTeacher } from "@/lib/api/teacher-custom-course-server"

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const { data: modules, error } = await supabase
    .from("course_modules")
    .select("id, course_id, title, order, created_at")
    .eq("course_id", courseId)
    .order("order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ modules: modules ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as { title?: string } | null
  const title = body?.title?.trim() || "Новый раздел"

  const { data: last } = await supabase
    .from("course_modules")
    .select("order")
    .eq("course_id", courseId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle<{ order: number }>()

  const nextOrder = (last?.order ?? -1) + 1

  const { data, error } = await supabase
    .from("course_modules")
    .insert({ course_id: courseId, title, order: nextOrder })
    .select("id, course_id, title, order, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ module: data }, { status: 201 })
}
