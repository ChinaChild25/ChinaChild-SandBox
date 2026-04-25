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
    .select("lesson_id, is_completed, score_percent, answered_count, total_count, response_state")
    .eq("student_id", ctx.me.id)
    .eq("lesson_id", lessonId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({
    completed: (data as { is_completed?: boolean | null } | null)?.is_completed ?? false,
    scorePercent: (data as { score_percent?: number | null } | null)?.score_percent ?? null,
    answeredCount: (data as { answered_count?: number | null } | null)?.answered_count ?? 0,
    totalCount: (data as { total_count?: number | null } | null)?.total_count ?? 0,
    responseState: (data as { response_state?: Record<string, unknown> | null } | null)?.response_state ?? null
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const ctx = await requireStudent(supabase)
  if ("error" in ctx) return ctx.error

  const { lessonId } = await params
  const vis = await lessonVisibleToReader(supabase, lessonId)
  if (!vis.ok) return vis.response

  const payload = (await request.json().catch(() => null)) as
    | {
        completed?: boolean | null
        scorePercent?: number | null
        answeredCount?: number | null
        totalCount?: number | null
        responseState?: Record<string, unknown> | null
      }
    | null

  const completedRaw = payload?.completed
  const scorePercentRaw = payload?.scorePercent
  const answeredCountRaw = payload?.answeredCount
  const totalCountRaw = payload?.totalCount
  const responseStateRaw = payload?.responseState

  const scorePercent =
    typeof scorePercentRaw === "number" && Number.isFinite(scorePercentRaw)
      ? Math.max(0, Math.min(100, Math.round(scorePercentRaw)))
      : null
  const answeredCount =
    typeof answeredCountRaw === "number" && Number.isFinite(answeredCountRaw) ? Math.max(0, Math.round(answeredCountRaw)) : 0
  const totalCount =
    typeof totalCountRaw === "number" && Number.isFinite(totalCountRaw) ? Math.max(0, Math.round(totalCountRaw)) : 0
  const completed = typeof completedRaw === "boolean" ? completedRaw : undefined
  const responseState =
    responseStateRaw && typeof responseStateRaw === "object" && !Array.isArray(responseStateRaw) ? responseStateRaw : undefined

  const row: Record<string, unknown> = {
    student_id: ctx.me.id,
    lesson_id: lessonId,
    updated_at: new Date().toISOString(),
    score_percent: scorePercent,
    answered_count: answeredCount,
    total_count: totalCount,
  }

  if (responseState !== undefined) {
    row.response_state = responseState
  }

  if (completed !== undefined) {
    row.is_completed = completed
    if (completed) {
      row.completed_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from("student_lesson_completions")
    .upsert(row, { onConflict: "student_id,lesson_id" })
    .select("is_completed, score_percent, answered_count, total_count, response_state")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({
    completed: (data as { is_completed?: boolean | null } | null)?.is_completed ?? completed ?? false,
    scorePercent: (data as { score_percent?: number | null } | null)?.score_percent ?? scorePercent,
    answeredCount: (data as { answered_count?: number | null } | null)?.answered_count ?? answeredCount,
    totalCount: (data as { total_count?: number | null } | null)?.total_count ?? totalCount,
    responseState: (data as { response_state?: Record<string, unknown> | null } | null)?.response_state ?? responseState ?? null
  })
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
