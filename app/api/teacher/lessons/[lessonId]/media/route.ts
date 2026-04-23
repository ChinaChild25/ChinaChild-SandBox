import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileRole = "student" | "teacher" | "curator"

const MAX_BYTES = 50 * 1024 * 1024

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "application/pdf": "pdf"
}

function isAllowedMime(mime: string) {
  return mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")
}

function sanitizeFileStem(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function extForFile(file: File, mime: string) {
  const fromName = file.name.split(".").pop()?.trim().toLowerCase()
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  return MIME_EXTENSION_MAP[mime] ?? "bin"
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

export async function POST(req: Request, context: { params: Promise<unknown> }) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx
  const { lessonId } = (await context.params) as { lessonId: string }

  const gate = await assertOwnCustomLesson(supabase, me.id, lessonId)
  if ("error" in gate) return gate.error

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 })

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой. Максимум 50 МБ." }, { status: 400 })
  }

  const mime = (file.type || "").split(";")[0].trim().toLowerCase()
  if (!isAllowedMime(mime)) {
    return NextResponse.json({ error: "Допустимы изображения, видео, аудио и PDF." }, { status: 400 })
  }

  const ext = extForFile(file, mime)
  const fileStem = sanitizeFileStem(file.name) || "lesson-file"
  const path = `${me.id}/lesson-media/${lessonId}/${Date.now()}-${fileStem}-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage.from("course-covers").upload(path, buf, {
    contentType: mime || file.type || undefined,
    upsert: false
  })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  const { data } = supabase.storage.from("course-covers").getPublicUrl(path)
  if (!data.publicUrl) {
    return NextResponse.json({ error: "Не удалось получить публичный URL" }, { status: 500 })
  }

  return NextResponse.json({
    url: data.publicUrl,
    fileName: file.name,
    mime,
    size: file.size
  })
}
