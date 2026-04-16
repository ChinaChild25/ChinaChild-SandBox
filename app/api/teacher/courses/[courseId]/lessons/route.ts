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

async function assertOwnCustomCourse(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  courseId: string
) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, is_custom, teacher_id")
    .eq("id", courseId)
    .maybeSingle<{ id: string; is_custom: boolean; teacher_id: string | null }>()

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!data) return { error: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
  if (!data.is_custom || data.teacher_id !== teacherId) {
    return { error: NextResponse.json({ error: "Only custom teacher courses are editable" }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const guard = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in guard) return guard.error

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, course_id, title, order, created_at")
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

  const body = (await req.json().catch(() => null)) as { title?: string } | null
  const title = body?.title?.trim() || "Новый урок"

  const { data: lastLesson } = await supabase
    .from("lessons")
    .select("order")
    .eq("course_id", courseId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle<{ order: number }>()

  const nextOrder = (lastLesson?.order ?? -1) + 1
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      title,
      order: nextOrder
    })
    .select("id, course_id, title, order, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ lesson: data }, { status: 201 })
}
