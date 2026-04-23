import {
  emptyWeeklyTemplate,
  normalizeIntervals,
  WEEKDAY_KEYS,
  type AvailabilityInterval,
  type WeeklyTemplate,
  type WeekdayKey
} from "@/lib/teacher-availability-template"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { MentorScheduleSlot } from "@/lib/mentors"

const RU_WEEKDAY: Record<WeekdayKey, string> = {
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
  sunday: "Воскресенье"
}

function parseWeeklyTemplate(raw: unknown): WeeklyTemplate {
  const out = emptyWeeklyTemplate()
  if (!raw || typeof raw !== "object") return out
  const o = raw as Record<string, unknown>
  for (const k of WEEKDAY_KEYS) {
    const arr = o[k]
    if (!Array.isArray(arr)) continue
    const intervals: AvailabilityInterval[] = []
    for (const item of arr) {
      if (!item || typeof item !== "object") continue
      const start = (item as { start?: unknown }).start
      const end = (item as { end?: unknown }).end
      if (typeof start === "string" && typeof end === "string") intervals.push({ start, end })
    }
    out[k] = normalizeIntervals(intervals)
  }
  return out
}

function weeklyTemplateToRuSlots(weekly: WeeklyTemplate): MentorScheduleSlot[] {
  const rows: MentorScheduleSlot[] = []
  for (const key of WEEKDAY_KEYS) {
    const intervals = weekly[key] ?? []
    if (intervals.length === 0) continue
    const time = intervals.map((i) => `${i.start}–${i.end}`).join(", ")
    rows.push({ day: RU_WEEKDAY[key], time })
  }
  return rows
}

type RpcRow = { weekly_template: unknown; timezone: string | null }

/**
 * Слоты для карточки /mentors/[slug]: из Supabase (weekly_template), если задан mentor_page_slug и есть строка шаблона.
 * Иначе — fallback (статика из lib/mentors).
 */
export async function resolveMentorDisplaySchedule(
  mentorPageSlug: string,
  fallback: MentorScheduleSlot[]
): Promise<MentorScheduleSlot[]> {
  if (!isSupabaseConfigured()) return fallback

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.rpc("get_mentor_public_schedule", { p_slug: mentorPageSlug })
    if (error) return fallback
    const row = Array.isArray(data) ? (data[0] as RpcRow | undefined) : null
    if (!row) return fallback

    const weekly = parseWeeklyTemplate(row.weekly_template)
    const slots = weeklyTemplateToRuSlots(weekly)
    if (slots.length === 0) return []
    return slots
  } catch {
    return fallback
  }
}
