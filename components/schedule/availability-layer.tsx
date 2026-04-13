"use client"

import { minutesFromHHMM, type AvailabilityInterval } from "@/lib/teacher-availability-template"

export function AvailabilityLayer({
  intervals,
  hourHeight,
  offsetLeftClass = "left-16"
}: {
  intervals: AvailabilityInterval[]
  hourHeight: number
  offsetLeftClass?: string
}) {
  return (
    <>
      {intervals.map((i, idx) => {
        const top = (minutesFromHHMM(i.start) / 60) * hourHeight
        const height = ((minutesFromHHMM(i.end) - minutesFromHHMM(i.start)) / 60) * hourHeight
        return (
          <div
            key={`${i.start}-${i.end}-${idx}`}
            className={`absolute ${offsetLeftClass} right-2 rounded-md border border-ds-sage-strong bg-ds-sage/45 px-2 py-1 text-[11px] text-ds-ink`}
            style={{ top, height }}
          >
            {i.start}–{i.end}
          </div>
        )
      })}
    </>
  )
}
