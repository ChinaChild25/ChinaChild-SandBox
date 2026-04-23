import { cn } from "@/lib/utils"

/** Логотип Telegram (простая SVG-иконка для ссылок t.me). */
export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden
      fill="currentColor"
    >
      <path d="M21.944 2.062a1.5 1.5 0 0 0-1.6-.335L2.3 9.18c-1.035.43-1.03 1.96.008 2.383l4.476 1.84 1.74 5.51c.286.91 1.423.91 1.71 0l1.74-5.51 4.89 3.573c.84.614 2.05.05 2.15-.98l2.44-22.13zM17.56 5.45 9.08 12.28l-.35 3.52-1.32-4.18-5.09-2.09 14.24-3.88z" />
    </svg>
  )
}

export function telegramProfileUrl(username: string) {
  const u = username.replace(/^@/, "").trim()
  return `https://t.me/${u}`
}
