import { NextResponse } from "next/server"
import { processPendingLessonAnalyticsJobsIfConfigured } from "@/lib/lesson-analytics/server"
import { appendLiveTranscriptSnippets, isTeacherProfileRole, type LiveTranscriptSnippet } from "@/lib/live-lessons/server"
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

type RequestBody = {
  snippets?: LiveTranscriptSnippet[]
}

export async function POST(request: Request, { params }: { params: Promise<RouteParams> }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Нужна авторизация." }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null
  const snippets = Array.isArray(body?.snippets) ? body.snippets : []
  if (snippets.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const { sessionId } = await params
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

  const adminSupabase = createAdminSupabaseClient()
  const { data: session, error: sessionError } = await adminSupabase
    .from("lesson_sessions")
    .select("id, teacher_id, student_id, status, ended_at")
    .eq("id", sessionId)
    .single<{
      id: string
      teacher_id: string | null
      student_id: string | null
      status: "active" | "awaiting_artifacts" | "processing" | "done" | "failed"
      ended_at: string | null
    }>()

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
    await appendLiveTranscriptSnippets({
      adminSupabase,
      sessionId,
      snippets,
    })

    const shouldAttemptProcessing = session.status !== "active" || Boolean(session.ended_at)
    if (shouldAttemptProcessing) {
      await processPendingLessonAnalyticsJobsIfConfigured({
        adminSupabase,
        limit: 3,
      })
    }

    return NextResponse.json({ ok: true, inserted: snippets.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить транскрипт." },
      { status: 500 }
    )
  }
}
