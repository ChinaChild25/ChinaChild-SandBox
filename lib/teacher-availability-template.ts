export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

export type AvailabilityInterval = {
  start: string // HH:mm
  end: string // HH:mm
}

export type WeeklyTemplate = Record<WeekdayKey, AvailabilityInterval[]>

export type SlotStatus = "free" | "busy" | "booked"

export type TeacherSlot = {
  slot_at: string
  status: SlotStatus
}

export function emptyWeeklyTemplate(): WeeklyTemplate {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  }
}

export function minutesFromHHMM(v: string): number {
  const [h, m] = v.split(":").map((x) => Number.parseInt(x, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return Math.max(0, Math.min(24 * 60, h * 60 + m))
}

export function hhmmFromMinutes(mins: number): string {
  const x = Math.max(0, Math.min(24 * 60, mins))
  const h = Math.floor(x / 60)
  const m = x % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function normalizeIntervals(intervals: AvailabilityInterval[]): AvailabilityInterval[] {
  const sorted = intervals
    .map((i) => ({ start: minutesFromHHMM(i.start), end: minutesFromHHMM(i.end) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start)

  const merged: Array<{ start: number; end: number }> = []
  for (const cur of sorted) {
    const prev = merged[merged.length - 1]
    if (!prev || cur.start > prev.end) {
      merged.push(cur)
      continue
    }
    prev.end = Math.max(prev.end, cur.end)
  }

  return merged.map((i) => ({ start: hhmmFromMinutes(i.start), end: hhmmFromMinutes(i.end) }))
}

export function intervalContainsHour(interval: AvailabilityInterval, hour: number): boolean {
  const start = minutesFromHHMM(interval.start)
  const end = minutesFromHHMM(interval.end)
  const h = hour * 60
  return h >= start && h < end
}

export function intervalsToHourlyStatuses(
  intervals: AvailabilityInterval[],
  bookedHours: Set<number> = new Set<number>()
): SlotStatus[] {
  const normalized = normalizeIntervals(intervals)
  return Array.from({ length: 24 }, (_, hour) => {
    if (bookedHours.has(hour)) return "booked"
    const free = normalized.some((i) => intervalContainsHour(i, hour))
    return free ? "free" : "busy"
  })
}

export function hourlyStatusesToIntervals(statuses: SlotStatus[]): AvailabilityInterval[] {
  const out: AvailabilityInterval[] = []
  let startHour: number | null = null
  for (let h = 0; h < 24; h++) {
    const isFree = statuses[h] === "free"
    if (isFree && startHour === null) startHour = h
    if ((!isFree || h === 23) && startHour !== null) {
      const endHour = isFree && h === 23 ? 24 : h
      out.push({ start: hhmmFromMinutes(startHour * 60), end: hhmmFromMinutes(endHour * 60) })
      startHour = null
    }
  }
  return normalizeIntervals(out)
}

export function weekdayFromDate(date: Date): WeekdayKey {
  const day = date.getDay() // 0..6, sunday = 0
  const map: WeekdayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return map[day]
}
