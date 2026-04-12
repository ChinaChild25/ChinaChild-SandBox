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
