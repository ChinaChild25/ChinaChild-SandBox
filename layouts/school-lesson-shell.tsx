import type { ReactNode } from "react"

type Props = {
  children: ReactNode
}

/** Full-bleed lesson column: tokens via .lesson-shell + cc-design-system.css */
export function SchoolLessonShell({ children }: Props) {
  return (
    <div className="min-h-0 bg-[var(--cc-hsk-bg)] py-6 md:py-8">
      <div className="lesson-shell">{children}</div>
    </div>
  )
}
