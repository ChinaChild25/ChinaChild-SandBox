import { NextResponse } from "next/server"
import { getLatestLessonReportForViewer } from "@/lib/lesson-analytics/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { lessonId } = await params
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "teacher" | "curator" }>()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, course_id, room_url, courses(title, cover_color, cover_style, cover_image_url)")
    .eq("id", lessonId)
    .maybeSingle<{
      id: string
      title: string
      course_id: string
      room_url: string | null
      courses: {
        title: string | null
        cover_color: string | null
        cover_style: string | null
        cover_image_url: string | null
      } | null
    }>()
  if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 400 })
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 })

  const { data: blocks, error: blockError } = await supabase
    .from("lesson_blocks")
    .select("id, lesson_id, type, order, data")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: true })

  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 400 })

  let latestReport = null
  try {
    const adminSupabase = createAdminSupabaseClient()
    latestReport = await getLatestLessonReportForViewer({
      adminSupabase,
      lessonId,
      viewerId: profile.id,
      viewerRole: profile.role,
    })
  } catch {
    latestReport = null
  }

  return NextResponse.json({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      course_id: lesson.course_id,
      room_url: lesson.room_url ?? null,
      course_title: lesson.courses?.title ?? null,
      course_cover_color: lesson.courses?.cover_color ?? null,
      course_cover_style: lesson.courses?.cover_style ?? null,
      course_cover_image_url: lesson.courses?.cover_image_url ?? null,
    },
    blocks: blocks ?? [],
    latest_report: latestReport,
  })
}
