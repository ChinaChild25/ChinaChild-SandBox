import { NextResponse } from "next/server"
import { countAudioInBlock, countWordSlotsInBlock } from "@/lib/lesson-block-stats"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileRole = "student" | "teacher" | "curator"

function normalizeAvatarUrl(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value
  const path = value.replace(/^avatars\//, "")
  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return data.publicUrl || null
}

function fallbackAvatarByTeacherName(name: string | null | undefined): string | null {
  const normalized = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  if (!normalized) return null
  if (normalized === "чжао ли" || normalized === "zhao li") return "/staff/zhao-li.png"
  if (normalized === "денис гасенко" || normalized === "denis gasenko") return "/staff/denis-gasenko-curator.png"
  return null
}

function displayNameFromProfile(profile: {
  full_name: string | null
  first_name: string | null
  last_name: string | null
} | null): string {
  if (!profile) return "Преподаватель"
  const fromFull = profile.full_name?.trim()
  if (fromFull) return fromFull
  const joined = [profile.first_name?.trim() ?? "", profile.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim()
  return joined || "Преподаватель"
}

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: ProfileRole }>()

  if (!me || me.role !== "student") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 })
  }

  const { courseId } = await params

  const { data: link, error: linkErr } = await supabase
    .from("course_student_assignments")
    .select("course_id")
    .eq("student_id", me.id)
    .eq("course_id", courseId)
    .maybeSingle<{ course_id: string }>()

  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })
  if (!link) return NextResponse.json({ error: "Курс не назначен или недоступен" }, { status: 404 })

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select(
      "id, title, description, level, cover_color, cover_style, cover_image_url, cover_image_position, cover_image_scale, cover_image_flip_x, cover_image_flip_y, is_custom, teacher_id, created_at"
    )
    .eq("id", courseId)
    .maybeSingle()

  if (courseErr) return NextResponse.json({ error: courseErr.message }, { status: 400 })
  if (!course) return NextResponse.json({ error: "Курс не найден" }, { status: 404 })

  const [{ data: lessons, error: lessonsErr }, { data: modules, error: modulesErr }, { data: teacherProfile, error: teacherErr }] =
    await Promise.all([
    supabase
      .from("lessons")
      .select("id, course_id, title, order, module_id, created_at")
      .eq("course_id", courseId)
      .order("order", { ascending: true }),
    supabase
      .from("course_modules")
      .select("id, course_id, title, order, created_at")
      .eq("course_id", courseId)
      .order("order", { ascending: true }),
    course.teacher_id
      ? supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, avatar_url")
          .eq("id", course.teacher_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (lessonsErr) return NextResponse.json({ error: lessonsErr.message }, { status: 400 })
  if (modulesErr) return NextResponse.json({ error: modulesErr.message }, { status: 400 })
  if (teacherErr) return NextResponse.json({ error: teacherErr.message }, { status: 400 })

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id as string)
  const completedLessonIds = new Set<string>()
  const lessonScorePercentById: Record<string, number> = {}
  let newWordsCount = 0
  let audioCount = 0

  if (lessonIds.length > 0) {
    const [{ data: completionRows, error: completionErr }, { data: blockRows, error: blockErr }] = await Promise.all([
      supabase
        .from("student_lesson_completions")
        .select("lesson_id, score_percent, is_completed")
        .eq("student_id", me.id)
        .in("lesson_id", lessonIds),
      supabase
        .from("lesson_blocks")
        .select("lesson_id, type, data")
        .in("lesson_id", lessonIds),
    ])

    if (completionErr) return NextResponse.json({ error: completionErr.message }, { status: 400 })
    if (blockErr) return NextResponse.json({ error: blockErr.message }, { status: 400 })

    for (const row of completionRows ?? []) {
      const completion = row as { lesson_id: string; score_percent?: number | null; is_completed?: boolean | null }
      if (!completion.is_completed) continue
      completedLessonIds.add(completion.lesson_id)
      if (typeof completion.score_percent === "number") {
        lessonScorePercentById[completion.lesson_id] = completion.score_percent
      }
    }

    for (const row of blockRows ?? []) {
      const block = row as { lesson_id: string; type: string; data: Record<string, unknown> }
      newWordsCount += countWordSlotsInBlock(block.type, block.data)
      audioCount += countAudioInBlock(block.type, block.data)
    }
  }

  const teacherName = displayNameFromProfile(
    teacherProfile as
      | {
          full_name: string | null
          first_name: string | null
          last_name: string | null
        }
      | null
  )

  return NextResponse.json({
    course: {
      ...course,
      lesson_count: lessons?.length ?? 0,
      completed_lesson_count: completedLessonIds.size,
      completed_lesson_ids: [...completedLessonIds],
      lesson_score_percent_by_id: lessonScorePercentById,
      new_words_count: newWordsCount,
      audio_count: audioCount,
      teacher_name: teacherName,
      teacher_avatar_url:
        normalizeAvatarUrl(
          supabase,
          (teacherProfile as { avatar_url: string | null } | null)?.avatar_url
        ) ?? fallbackAvatarByTeacherName(teacherName),
    },
    lessons: lessons ?? [],
    modules: modules ?? []
  })
}
