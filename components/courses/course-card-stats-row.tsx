type CourseCardStatsRowProps = {
  lessons: number
  newWords: number
  audio: number
  /** `cluster` — три метрики сгруппированы слева (как HSK), внутри каждой — выравнивание по центру */
  layout?: "grid" | "cluster"
  valueColor?: string
  labelColor?: string
}

export function CourseCardStatsRow({
  lessons,
  newWords,
  audio,
  layout = "grid",
  valueColor,
  labelColor,
}: CourseCardStatsRowProps) {
  const valueStyle = valueColor ? { color: valueColor } : undefined
  const labelStyle = labelColor ? { color: labelColor } : undefined

  if (layout === "cluster") {
    return (
      <div className="mb-5 flex flex-wrap justify-start gap-x-6 gap-y-3">
        <div className="min-w-0 shrink-0 text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink" style={valueStyle}>{lessons}</p>
          <p className="text-ds-sm text-ds-text-secondary" style={labelStyle}>уроков</p>
        </div>
        <div className="min-w-0 shrink-0 text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink" style={valueStyle}>{newWords}</p>
          <p className="text-ds-sm text-ds-text-secondary" style={labelStyle}>новых слов</p>
        </div>
        <div className="min-w-0 shrink-0 text-center">
          <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink" style={valueStyle}>{audio}</p>
          <p className="text-ds-sm text-ds-text-secondary" style={labelStyle}>аудио</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
      <div className="min-w-0 text-center">
        <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink" style={valueStyle}>{lessons}</p>
        <p className="text-ds-sm text-ds-text-secondary" style={labelStyle}>уроков</p>
      </div>
      <div className="min-w-0 text-center">
        <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink" style={valueStyle}>{newWords}</p>
        <p className="text-ds-sm text-ds-text-secondary" style={labelStyle}>новых слов</p>
      </div>
      <div className="min-w-0 text-center">
        <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink" style={valueStyle}>{audio}</p>
        <p className="text-ds-sm text-ds-text-secondary" style={labelStyle}>аудио</p>
      </div>
    </div>
  )
}
