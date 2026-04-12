import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "avatars"

/** Лимит исходного файла до обрезки (выбор в диалоге). */
export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "bin"
}

function extFromFile(file: File): string {
  if (file.type && ALLOWED_TYPES.has(file.type)) {
    return extFromMime(file.type)
  }
  const n = file.name.toLowerCase()
  if (n.endsWith(".png")) return "png"
  if (n.endsWith(".webp")) return "webp"
  return "jpg"
}

function fileLooksLikeAllowedImage(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true
  const name = file.name.toLowerCase()
  if (!/\.(jpe?g|png|webp)$/.test(name)) return false
  return !file.type || file.type.startsWith("image/")
}

export type AvatarInputValidationError = "invalid_type" | "too_large"

export function validateAvatarInputFile(file: File): AvatarInputValidationError | null {
  if (!fileLooksLikeAllowedImage(file)) return "invalid_type"
  if (file.size > AVATAR_MAX_FILE_BYTES) return "too_large"
  return null
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
  const v = validateAvatarInputFile(file)
  if (v === "invalid_type") {
    return { ok: false, message: "Допустимы только изображения: JPEG, PNG, WebP." }
  }
  if (v === "too_large") {
    return { ok: false, message: "Файл больше 5 МБ." }
  }

  const ext = extFromFile(file)
  const path = `${userId}/${Date.now()}.${ext}`
  const contentType =
    file.type && ALLOWED_TYPES.has(file.type)
      ? file.type
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg"

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType
  })

  if (upErr) {
    return { ok: false, message: upErr.message || "Не удалось загрузить файл." }
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { ok: true, publicUrl }
}
