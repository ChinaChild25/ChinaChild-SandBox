import type { ReactNode } from "react"

type Props = {
  children: ReactNode
}

/** Lesson column: Figma LessonPage canvas (white / full-width content band). */
export function SchoolLessonShell({ children }: Props) {
  return (
    <div className="min-h-0 py-6 md:py-8">
      <div className="lesson-shell">{children}</div>
    </div>
  )
}
