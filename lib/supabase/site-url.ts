/**
 * Базовый публичный URL приложения (без завершающего /).
 * Нужен для redirectTo в resetPasswordForEmail — Supabase требует абсолютный URL из allowlist.
 */
export function getPasswordRecoverySiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "")
  if (fromEnv) return fromEnv
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return ""
}

export function getPasswordRecoveryRedirectUrl(): string {
  const base = getPasswordRecoverySiteUrl()
  return base ? `${base}/reset-password` : ""
}
