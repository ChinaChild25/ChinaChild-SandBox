import { NextResponse } from "next/server"
import { assertOwnCustomCourse } from "@/lib/api/teacher-custom-course-server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileRole = "student" | "teacher" | "curator"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function extForMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  return "jpg"
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

export async function POST(req: Request) {
  const ctx = await requireTeacher()
  if ("error" in ctx) return ctx.error
  const { supabase, me } = ctx

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 })

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 5 МБ — выберите изображение меньшего размера" }, { status: 400 })
  }

  const mime = (file.type || "").toLowerCase()
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Допустимы только JPEG, PNG, WebP и GIF" }, { status: 400 })
  }

  const courseIdRaw = form.get("courseId")
  const courseId = typeof courseIdRaw === "string" && courseIdRaw.trim() ? courseIdRaw.trim() : null
  if (courseId) {
    const gate = await assertOwnCustomCourse(supabase, me.id, courseId)
    if ("error" in gate) return gate.error
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const folder = courseId ?? `draft/${crypto.randomUUID()}`
  const path = `${me.id}/${folder}/${Date.now()}.${extForMime(mime)}`

  const { error: upErr } = await supabase.storage.from("course-covers").upload(path, buf, {
    contentType: mime,
    upsert: false
  })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  const { data } = supabase.storage.from("course-covers").getPublicUrl(path)
  const publicUrl = data.publicUrl
  if (!publicUrl) return NextResponse.json({ error: "Не удалось получить URL" }, { status: 500 })

  return NextResponse.json({ url: publicUrl })
}
