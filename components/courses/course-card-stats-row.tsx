type CourseCardStatsRowProps = {
  lessons: number
  newWords: number
  audio: number
  /** `cluster` — три метрики сгруппированы слева (как HSK), внутри каждой — выравнивание по центру */
  layout?: "grid" | "cluster"
}

export function CourseCardStatsRow({ lessons, newWords, audio, layout = "grid" }: CourseCardStatsRowProps) {
  if (layout === "cluster") {
    return (
      <div className="mb-5 flex flex-wrap justify-start gap-x-6 gap-y-3">
        <div className="min-w-0 shrink-0 text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{lessons}</p>
          <p className="text-ds-sm text-ds-text-secondary">уроков</p>
        </div>
        <div className="min-w-0 shrink-0 text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{newWords}</p>
          <p className="text-ds-sm text-ds-text-secondary">новых слов</p>
        </div>
        <div className="min-w-0 shrink-0 text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{audio}</p>
          <p className="text-ds-sm text-ds-text-secondary">аудио</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
      <div className="min-w-0 text-center">
        <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{lessons}</p>
        <p className="text-ds-sm text-ds-text-secondary">уроков</p>
      </div>
      <div className="min-w-0 text-center">
        <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{newWords}</p>
        <p className="text-ds-sm text-ds-text-secondary">новых слов</p>
      </div>
      <div className="min-w-0 text-center">
        <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{audio}</p>
        <p className="text-ds-sm text-ds-text-secondary">аудио</p>
      </div>
    </div>
  )
}
