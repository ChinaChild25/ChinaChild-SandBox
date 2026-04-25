import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isLessonBlockType, type LessonBlockType } from "@/lib/types"

type ProfileRole = "student" | "teacher" | "curator"

type BlockInput = {
  id?: string
  type: LessonBlockType
  order: number
  data: Record<string, unknown>
}

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
    .select("id, courses!inner(is_custom, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle<{ id: string; courses: { is_custom: boolean; teacher_id: string | null } }>()

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!data) return { error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) }
  if (!data.courses.is_custom || data.courses.teacher_id !== teacherId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = await params
  const guard = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in guard) return guard.error

  const { data, error } = await supabase
    .from("lesson_blocks")
    .select("id, lesson_id, type, order, data")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ blocks: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = await params
  const guard = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as
    | { type?: string; data?: Record<string, unknown> }
    | null
  const type = body?.type
  if (!type) return NextResponse.json({ error: "Block type is required" }, { status: 400 })
  if (!isLessonBlockType(type)) {
    return NextResponse.json({ error: "Invalid block type" }, { status: 400 })
  }

  const { data: lastBlock } = await supabase
    .from("lesson_blocks")
    .select("order")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle<{ order: number }>()

  const nextOrder = (lastBlock?.order ?? -1) + 1
  const { data, error } = await supabase
    .from("lesson_blocks")
    .insert({
      lesson_id: lessonId,
      type,
      order: nextOrder,
      data: body?.data ?? {}
    })
    .select("id, lesson_id, type, order, data")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ block: data }, { status: 201 })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = await params
  const guard = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in guard) return guard.error

  const body = (await req.json().catch(() => null)) as { blocks?: BlockInput[] } | null
  const blocks = body?.blocks ?? []

  for (const [index, block] of blocks.entries()) {
    if (!isLessonBlockType(block.type)) {
      return NextResponse.json({ error: `Недопустимый тип блока (позиция ${index + 1})` }, { status: 400 })
    }
  }

  const { error: replaceError } = await supabase.rpc("replace_lesson_blocks_atomic", {
    p_lesson_id: lessonId,
    p_blocks: blocks.map((block, index) => ({
      type: block.type,
      order: index,
      data: block.data ?? {}
    }))
  })
  if (replaceError) return NextResponse.json({ error: replaceError.message }, { status: 400 })

  const { data, error } = await supabase
    .from("lesson_blocks")
    .select("id, lesson_id, type, order, data")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ blocks: data ?? [] })
}
