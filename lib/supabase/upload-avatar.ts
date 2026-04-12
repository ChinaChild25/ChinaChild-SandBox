import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "avatars"
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  return "bin"
}

/**
 * Загрузка в bucket `avatars`, путь: `<user_id>/<timestamp>.<ext>`
 * В profiles.avatar_url сохраняется публичный URL.
 */
export async function uploadUserAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: "Допустимы только изображения: JPEG, PNG, WebP, GIF." }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Файл больше 5 МБ." }
  }

  const ext = extFromMime(file.type)
  const path = `${userId}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type
  })

  if (upErr) {
    return { ok: false, message: upErr.message || "Не удалось загрузить файл." }
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { ok: true, publicUrl }
}
