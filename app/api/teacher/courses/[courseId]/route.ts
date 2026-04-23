import { NextResponse } from "next/server"
import { assertOwnCustomCourse } from "@/lib/api/teacher-custom-course-server"
import { isAllowedExternalCoverImageUrl, normalizeCoverImagePosition } from "@/lib/teacher-custom-course-form"
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

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, description, level, is_custom, teacher_id, created_at, cover_color, cover_style, cover_image_url, cover_image_position, is_platform_course"
    )
    .eq("id", courseId)
    .maybeSingle<{
      id: string
      title: string
      description: string | null
      level: string | null
      is_custom: boolean
      teacher_id: string | null
      created_at: string
      cover_color: string | null
      cover_style: string | null
      cover_image_url: string | null
      cover_image_position: string | null
      is_platform_course: boolean
    }>()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: "Course not found" }, { status: 404 })
  if (data.is_custom && data.teacher_id !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, avatar_url")
    .eq("id", me.id)
    .maybeSingle<{ full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null }>()

  const teacherName =
    profile?.full_name?.trim() ||
    [profile?.first_name?.trim() ?? "", profile?.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    "Teacher"

  const course = {
    ...data,
    teacher_name: teacherName,
    teacher_avatar_url:
      normalizeAvatarUrl(supabase, profile?.avatar_url) ?? fallbackAvatarByTeacherName(teacherName)
  }

  return NextResponse.json({ course })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { courseId } = await params

  const gate = await assertOwnCustomCourse(supabase, me.id, courseId)
  if ("error" in gate) return gate.error

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

  if (body == null) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })

  const updates: Record<string, string | null> = {}

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (title.length > 20) return NextResponse.json({ error: "Максимум 20 символов в названии" }, { status: 400 })
    updates.title = title
  }

  if (body.description !== undefined) {
    updates.description = body.description.trim() || null
  }

  if (body.level !== undefined || body.levelCustom !== undefined) {
    const levelRaw = (body.level === "custom" ? body.levelCustom : body.level)?.trim() ?? ""
    updates.level = levelRaw || null
  }

  if (body.coverColor !== undefined) {
    updates.cover_color = body.coverColor.trim() || null
  }

  if (body.coverStyle !== undefined) {
    updates.cover_style = body.coverStyle.trim() || null
  }

  if (body.coverImageUrl !== undefined) {
    const raw = typeof body.coverImageUrl === "string" ? body.coverImageUrl.trim() : ""
    if (raw && !isAllowedExternalCoverImageUrl(raw)) {
      return NextResponse.json({ error: "Некорректный URL обложки" }, { status: 400 })
    }
    updates.cover_image_url = raw || null
  }

  if (body.coverImagePosition !== undefined) {
    updates.cover_image_position = normalizeCoverImagePosition(body.coverImagePosition)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId)
    .select(
      "id, title, description, level, is_custom, is_platform_course, cover_color, cover_style, cover_image_url, cover_image_position, created_at"
    )
    .maybeSingle<{
      id: string
      title: string
      description: string | null
      level: string | null
      is_custom: boolean
      is_platform_course: boolean
      cover_color: string | null
      cover_style: string | null
      cover_image_url: string | null
      cover_image_position: string | null
      created_at: string
    }>()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!updated) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, avatar_url")
    .eq("id", me.id)
    .maybeSingle<{ full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null }>()

  const teacherName =
    profile?.full_name?.trim() ||
    [profile?.first_name?.trim() ?? "", profile?.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    "Teacher"

  const course = {
    ...updated,
    teacher_name: teacherName,
    teacher_avatar_url:
      normalizeAvatarUrl(supabase, profile?.avatar_url) ?? fallbackAvatarByTeacherName(teacherName)
  }

  return NextResponse.json({ course })
}
