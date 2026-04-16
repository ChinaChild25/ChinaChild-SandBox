"use client"

import { Plus } from "lucide-react"

export function CreateCourseCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group ds-course-card h-full min-h-[220px] w-full max-w-[60%] justify-self-center rounded-[var(--ds-radius-xl)] border border-dashed border-ds-text-tertiary/40 bg-ds-surface-muted/50 p-6 text-left transition hover:scale-[1.03] hover:bg-ds-surface-hover"
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Plus className="h-12 w-12 text-ds-text-secondary" />
        <p className="text-base font-medium text-ds-ink">Создать свой курс</p>
      </div>
    </button>
  )
}
