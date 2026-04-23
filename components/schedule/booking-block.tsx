"use client"

export function BookingBlock({
  studentName,
  hourLabel,
  top,
  height,
  onClick
}: {
  studentName: string
  hourLabel: string
  top: number
  height: number
  onClick?: () => void
}) {
  return (
    <div
      className="absolute left-20 right-3 cursor-pointer rounded-md border border-amber-400 bg-amber-100/95 px-2 py-1 text-[11px] text-amber-900 shadow-sm"
      style={{ top, height }}
      title={`${studentName} — ${hourLabel}`}
      onClick={onClick}
    >
      <div className="truncate font-semibold">{studentName}</div>
      <div className="truncate text-[10px] opacity-90">{hourLabel}</div>
    </div>
  )
}
