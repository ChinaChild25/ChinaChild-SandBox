export type TeacherScheduleStatus = "free" | "busy" | "booked"

export type TeacherScheduleSlot = {
  teacher_id: string
  slot_at: string
  status: TeacherScheduleStatus
  booked_student_id: string | null
}

export const TEACHER_HOURLY_SLOTS: string[] = Array.from({ length: 24 }, (_, hour) =>
  `${String(hour).padStart(2, "0")}:00`
)

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

export function startOfWeekMonday(ref: Date): Date {
  const d = startOfLocalDay(ref)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

export function formatSlotLabel(slotAtIso: string) {
  const d = new Date(slotAtIso)
  return {
    dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    hour: `${String(d.getHours()).padStart(2, "0")}:00`
  }
}

export function buildHourlyIsoSlots(day: Date): string[] {
  const start = startOfLocalDay(day)
  return Array.from({ length: 24 }, (_, hour) => {
    const x = new Date(start)
    x.setHours(hour, 0, 0, 0)
    return x.toISOString()
  })
}
