import type { SupabaseClient } from "@supabase/supabase-js"
import { getChatMediaBucket } from "@/lib/supabase/config"

function normalizeMimeType(type: string): string {
  return type.split(";")[0]?.trim().toLowerCase() ?? ""
}

export const MEDIA_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/avif",
    "image/bmp",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/x-m4a"
  ]
} as const

export type MediaUploadResult = {
  url: string
  mediaType: string
  mediaSize: number
}

export async function uploadChatMedia(
  supabase: SupabaseClient,
  conversationId: string,
  file: File
): Promise<MediaUploadResult> {
  const normalizedType = normalizeMimeType(file.type)
  if (file.size > MEDIA_LIMITS.maxFileSizeBytes) {
    throw new Error(`File too large: max ${MEDIA_LIMITS.maxFileSizeBytes / 1024 / 1024} MB`)
  }
  if (!MEDIA_LIMITS.allowedMimeTypes.includes(normalizedType as (typeof MEDIA_LIMITS.allowedMimeTypes)[number])) {
    throw new Error(`File type not allowed: ${file.type}`)
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error("Not authenticated")

  const bucket = getChatMediaBucket()
  const ext = file.name.split(".").pop() || "bin"
  const path = `${conversationId}/${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: normalizedType || file.type, upsert: false })
  if (uploadError) throw uploadError

  const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 30)
  if (signedError || !signed?.signedUrl) {
    throw signedError ?? new Error("Failed to create signed url")
  }

  return {
    url: signed.signedUrl,
    mediaType: normalizedType || file.type,
    mediaSize: file.size
  }
}

export async function sendMessageWithMedia(
  supabase: SupabaseClient,
  conversationId: string,
  file: File,
  textContent = "",
  replyToId?: string | null
) {
  const media = await uploadChatMedia(supabase, conversationId, file)
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error("Not authenticated")

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: textContent.trim(),
    media_url: media.url,
    media_type: media.mediaType,
    media_size: media.mediaSize,
    reply_to_id: replyToId ?? null
  })

  if (error) throw error
}
