/**
 * Публичные переменные для браузера и сервера (anon / publishable key).
 * В Vercel: Settings → Environment Variables — те же имена.
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}

export function getChatMediaBucket(): string {
  return process.env.NEXT_PUBLIC_CHAT_MEDIA_BUCKET?.trim() || "chat-media"
}
