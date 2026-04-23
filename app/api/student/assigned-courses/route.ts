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

export async function GET() {
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

  const { data: links, error: linkErr } = await supabase
    .from("course_student_assignments")
    .select("course_id")
    .eq("student_id", me.id)

  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })
  const courseIds = [...new Set((links ?? []).map((r) => (r as { course_id: string }).course_id))]
  if (courseIds.length === 0) {
    return NextResponse.json({ courses: [] })
  }

  const { data: courses, error: courseErr } = await supabase
    .from("courses")
    .select(
      "id, title, description, level, cover_color, cover_style, cover_image_url, cover_image_position, is_custom, is_platform_course, teacher_id, created_at"
    )
    .in("id", courseIds)
    .eq("is_custom", true)
    .order("created_at", { ascending: false })

  if (courseErr) return NextResponse.json({ error: courseErr.message }, { status: 400 })

  const rows = (courses ?? []) as Array<{
    id: string
    title: string
    description: string | null
    level: string | null
    cover_color: string | null
    cover_style: string | null
    cover_image_url: string | null
    cover_image_position: string | null
    is_custom: boolean
    is_platform_course: boolean | null
    teacher_id: string | null
    created_at: string
  }>

  const teacherIds = [...new Set(rows.map((c) => c.teacher_id).filter((id): id is string => Boolean(id)))]

  const teacherById = new Map<
    string,
    { full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null }
  >()

  if (teacherIds.length > 0) {
    const { data: teachers, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, last_name, avatar_url")
      .in("id", teacherIds)

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 })
    for (const t of teachers ?? []) {
      const row = t as {
        id: string
        full_name: string | null
        first_name: string | null
        last_name: string | null
        avatar_url: string | null
      }
      teacherById.set(row.id, {
        full_name: row.full_name,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url
      })
    }
  }

  const blockStatsByCourse: Record<string, { new_words_count: number; audio_count: number }> = {}
  const lessonCountByCourse = new Map<string, number>()
  const lessonToCourseId = new Map<string, string>()
  const completedByCourse = new Map<string, number>()

  if (courseIds.length > 0) {
    const { data: lessonRows, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds)
    if (lessonErr) return NextResponse.json({ error: lessonErr.message }, { status: 400 })

    for (const l of lessonRows ?? []) {
      const row = l as { id: string; course_id: string }
      lessonToCourseId.set(row.id, row.course_id)
      lessonCountByCourse.set(row.course_id, (lessonCountByCourse.get(row.course_id) ?? 0) + 1)
    }

    const lessonIds = [...lessonToCourseId.keys()]

    if (lessonIds.length > 0) {
      const { data: compRows, error: compErr } = await supabase
        .from("student_lesson_completions")
        .select("lesson_id")
        .eq("student_id", me.id)
        .in("lesson_id", lessonIds)
      if (compErr) return NextResponse.json({ error: compErr.message }, { status: 400 })
      for (const r of compRows ?? []) {
        const lid = (r as { lesson_id: string }).lesson_id
        const cid = lessonToCourseId.get(lid)
        if (!cid) continue
        completedByCourse.set(cid, (completedByCourse.get(cid) ?? 0) + 1)
      }

      const { data: blockRows, error: blockErr } = await supabase
        .from("lesson_blocks")
        .select("lesson_id, type, data")
        .in("lesson_id", lessonIds)
      if (blockErr) return NextResponse.json({ error: blockErr.message }, { status: 400 })

      for (const b of blockRows ?? []) {
        const row = b as { lesson_id: string; type: string; data: Record<string, unknown> }
        const cid = lessonToCourseId.get(row.lesson_id)
        if (!cid) continue
        if (!blockStatsByCourse[cid]) blockStatsByCourse[cid] = { new_words_count: 0, audio_count: 0 }
        blockStatsByCourse[cid].new_words_count += countWordSlotsInBlock(row.type, row.data)
        blockStatsByCourse[cid].audio_count += countAudioInBlock(row.type, row.data)
      }
    }
  }

  const list = rows.map((c) => {
    const prof = c.teacher_id ? teacherById.get(c.teacher_id) ?? null : null
    const teacherName = displayNameFromProfile(prof)
    const extra = blockStatsByCourse[c.id] ?? { new_words_count: 0, audio_count: 0 }
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      level: c.level,
      is_custom: c.is_custom,
      is_platform_course: Boolean(c.is_platform_course),
      cover_color: c.cover_color,
      cover_style: c.cover_style,
      cover_image_url: c.cover_image_url,
      cover_image_position: c.cover_image_position,
      created_at: c.created_at,
      lesson_count: lessonCountByCourse.get(c.id) ?? 0,
      completed_lesson_count: completedByCourse.get(c.id) ?? 0,
      new_words_count: extra.new_words_count,
      audio_count: extra.audio_count,
      teacher_name: teacherName,
      teacher_avatar_url: normalizeAvatarUrl(supabase, prof?.avatar_url) ?? fallbackAvatarByTeacherName(teacherName)
    }
  })

  return NextResponse.json({ courses: list })
}
