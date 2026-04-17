"use client"

import { Plus } from "lucide-react"

export function CreateCourseCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group ds-course-card flex h-full min-h-[220px] w-full flex-col rounded-[var(--ds-radius-xl)] border border-dashed border-ds-text-tertiary/40 bg-white/90 p-6 text-left shadow-none transition hover:scale-[1.03] hover:bg-zinc-100/95 dark:border-white/20 dark:bg-zinc-950/55 dark:hover:bg-zinc-900/70 lg:min-h-[312px]"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
        <Plus className="h-12 w-12 text-ds-text-secondary" />
        <p className="text-base font-medium text-ds-ink">Создать свой курс</p>
      </div>
    </button>
  )
}
