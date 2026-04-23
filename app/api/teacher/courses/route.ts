import { NextResponse } from "next/server"
import { countAudioInBlock, countWordSlotsInBlock } from "@/lib/lesson-block-stats"
import {
  coverStyleForCourseSave,
  isAllowedExternalCoverImageUrl,
  normalizeCoverImagePosition
} from "@/lib/teacher-custom-course-form"
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

export async function GET() {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error

  const { supabase, me } = ctx
  const [{ data: ready, error: readyError }, { data: custom, error: customError }, { data: profile }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, level, is_custom, is_platform_course, cover_color, cover_style, created_at")
      .eq("is_platform_course", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("courses")
      .select(
        "id, title, description, level, is_custom, is_platform_course, cover_color, cover_style, cover_image_url, cover_image_position, created_at, lessons(count)"
      )
      .eq("is_custom", true)
      .eq("teacher_id", me.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("full_name, first_name, last_name, avatar_url")
      .eq("id", me.id)
      .maybeSingle<{ full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null }>()
  ])

  if (readyError) return NextResponse.json({ error: readyError.message }, { status: 400 })
  if (customError) return NextResponse.json({ error: customError.message }, { status: 400 })
  const teacherName =
    profile?.full_name?.trim() ||
    [profile?.first_name?.trim() ?? "", profile?.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    "Teacher"

  const customRows = custom ?? []
  const courseIds = customRows.map((c) => c.id)
  const blockStatsByCourse: Record<string, { new_words_count: number; audio_count: number }> = {}

  if (courseIds.length > 0) {
    const { data: lessonRows, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds)
    if (lessonErr) return NextResponse.json({ error: lessonErr.message }, { status: 400 })

    const lessonToCourse = new Map((lessonRows ?? []).map((l) => [l.id, l.course_id] as const))
    const lessonIds = [...lessonToCourse.keys()]

    if (lessonIds.length > 0) {
      const { data: blockRows, error: blockErr } = await supabase
        .from("lesson_blocks")
        .select("lesson_id, type, data")
        .in("lesson_id", lessonIds)
      if (blockErr) return NextResponse.json({ error: blockErr.message }, { status: 400 })

      for (const b of blockRows ?? []) {
        const cid = lessonToCourse.get(b.lesson_id)
        if (!cid) continue
        if (!blockStatsByCourse[cid]) blockStatsByCourse[cid] = { new_words_count: 0, audio_count: 0 }
        blockStatsByCourse[cid].new_words_count += countWordSlotsInBlock(b.type, b.data)
        blockStatsByCourse[cid].audio_count += countAudioInBlock(b.type, b.data)
      }
    }
  }

  return NextResponse.json({
    ready: ready ?? [],
    custom: customRows.map((row) => {
      const { lessons, ...course } = row as typeof row & { lessons?: { count: number }[] | null }
      const raw = lessons?.[0]?.count
      const lesson_count = typeof raw === "number" ? raw : Number(raw) || 0
      const extra = blockStatsByCourse[course.id] ?? { new_words_count: 0, audio_count: 0 }
      return {
        ...course,
        lesson_count,
        new_words_count: extra.new_words_count,
        audio_count: extra.audio_count,
        teacher_name: teacherName,
        teacher_avatar_url:
          normalizeAvatarUrl(supabase, profile?.avatar_url) ?? fallbackAvatarByTeacherName(teacherName)
      }
    })
  })
}

export async function POST(req: Request) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string
        description?: string
        level?: string
        levelCustom?: string
        coverColor?: string
        coverStyle?: string
        coverImageUrl?: string | null
        coverImagePosition?: string | null
      }
    | null
  const title = body?.title?.trim() ?? ""
  const description = body?.description?.trim() ?? ""
  const levelRaw = (body?.level === "custom" ? body.levelCustom : body?.level)?.trim() ?? ""

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  if (title.length > 20) return NextResponse.json({ error: "Максимум 20 символов в названии" }, { status: 400 })

  const coverColor = body?.coverColor?.trim() || "var(--ds-neutral-chrome)"
  const imgRaw = typeof body?.coverImageUrl === "string" ? body.coverImageUrl.trim() : ""
  const coverImageUrl = imgRaw && isAllowedExternalCoverImageUrl(imgRaw) ? imgRaw : null
  if (imgRaw && !coverImageUrl) {
    return NextResponse.json({ error: "Некорректный URL обложки" }, { status: 400 })
  }
  const coverStyle =
    body?.coverStyle?.trim() ||
    coverStyleForCourseSave({ hasPhoto: Boolean(coverImageUrl), coverColor })

  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      description: description || null,
      level: levelRaw || null,
      cover_color: coverColor,
      cover_style: coverStyle,
      cover_image_url: coverImageUrl,
      cover_image_position: coverImageUrl ? normalizeCoverImagePosition(body?.coverImagePosition) : "50% 50%",
      teacher_id: me.id,
      is_custom: true,
      is_platform_course: false
    })
    .select(
      "id, title, description, level, is_custom, is_platform_course, cover_color, cover_style, cover_image_url, cover_image_position, created_at"
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ course: data }, { status: 201 })
}
