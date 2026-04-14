/**
 * Ссылка на онлайн-занятие (Zoom, VooV Meeting и т.п.).
 * Задаётся в .env: NEXT_PUBLIC_ONLINE_CLASS_JOIN_URL=https://zoom.us/j/…
 */
export function getOnlineClassJoinUrl(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ONLINE_CLASS_JOIN_URL : undefined
  if (fromEnv && fromEnv.startsWith("http")) return fromEnv
  return "https://zoom.us"
}

/** Нормализация URL из профиля преподавателя (допускаем ввод без схемы). */
export function normalizeMeetingUrl(raw: string | null | undefined): string | undefined {
  const t = raw?.trim()
  if (!t) return undefined
  let u = t
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  try {
    const url = new URL(u)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

/** Ссылка для кнопки «Подключиться»: персональная преподавателя или fallback из env. */
export function resolveOnlineClassJoinUrl(personalUrl?: string | null): string {
  const n = normalizeMeetingUrl(personalUrl)
  if (n) return n
  return getOnlineClassJoinUrl()
}
