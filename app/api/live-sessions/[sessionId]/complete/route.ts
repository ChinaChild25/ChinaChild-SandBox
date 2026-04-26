import { NextResponse } from "next/server"
import { processPendingLessonAnalyticsJobsIfConfigured } from "@/lib/lesson-analytics/server"
import { completeLessonSession, isTeacherProfileRole } from "@/lib/live-lessons/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteParams = {
  sessionId: string
}

type ProfileRow = {
  id: string
  role: "student" | "teacher" | "curator"
}

export async function POST(_: Request, { params }: { params: Promise<RouteParams> }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Нужна авторизация." }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден." }, { status: 404 })
  }

  const { sessionId } = await params
  const adminSupabase = createAdminSupabaseClient()
  const { data: session, error: sessionError } = await adminSupabase
    .from("lesson_sessions")
    .select("id, teacher_id, student_id")
    .eq("id", sessionId)
    .single<{ id: string; teacher_id: string | null; student_id: string | null }>()

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 400 })
  }

  const allowed = isTeacherProfileRole(profile.role)
    ? session.teacher_id === profile.id
    : session.student_id === profile.id

  if (!allowed) {
    return NextResponse.json({ error: "У вас нет доступа к этой live-сессии." }, { status: 403 })
  }

  try {
    await completeLessonSession({
      adminSupabase,
      sessionId,
      queueDelaySeconds: 0,
      reason: "client_leave",
      contextPatch: {
        completed_from: "client",
      },
    })

    const { count: transcriptCount, error: transcriptCountError } = await adminSupabase
      .from("lesson_transcripts")
      .select("id", { head: true, count: "exact" })
      .eq("session_id", sessionId)

    if (transcriptCountError) {
      throw new Error(transcriptCountError.message)
    }

    if ((transcriptCount ?? 0) > 0) {
      await processPendingLessonAnalyticsJobsIfConfigured({
        adminSupabase,
        limit: 3,
      })
    }

    return NextResponse.json({
      ok: true,
      transcriptCount: transcriptCount ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось завершить live-сессию." },
      { status: 500 }
    )
  }
}
