import type { SupabaseClient } from "@supabase/supabase-js"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { addDaysToDateKey, calendarWeekdayFromDateKey, mondayDateKeyOfWeekContaining } from "@/lib/schedule/calendar-ymd"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"

/** Weekday (0=вс … 6=сб) по календарной дате YYYY-MM-DD в UTC, без локали сервера. */
export { calendarWeekdayFromDateKey } from "@/lib/schedule/calendar-ymd"

export function matchesFollowingSeriesSlot(
  wall: { dateKey: string; time: string },
  seriesWeekday: number,
  normalizedWallTime: string
): boolean {
  return calendarWeekdayFromDateKey(wall.dateKey) === seriesWeekday && normalizeScheduleSlotTime(wall.time) === normalizedWallTime
}

/**
 * Самая ранняя календарная дата занятия в серии (тот же день недели и время).
 * Нужна для RPC cancel/reschedule_following_*: иначе якорь = карточка урока и все более ранние
 * вхождения серии не попадают под фильтр v_wall_date >= v_anchor_date.
 */
export async function minDateKeyForFollowingSeries(
  supabase: SupabaseClient,
  teacherId: string,
  studentId: string,
  seriesWeekday: number,
  normalizedWallTime: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("teacher_schedule_slots")
    .select("slot_at")
    .eq("teacher_id", teacherId)
    .eq("booked_student_id", studentId)
    .eq("status", "booked")
  if (error) return null
  let best: string | null = null
  for (const row of data ?? []) {
    const wall = wallClockFromSlotAt((row as { slot_at: string }).slot_at)
    if (!matchesFollowingSeriesSlot(wall, seriesWeekday, normalizedWallTime)) continue
    if (best === null || wall.dateKey < best) best = wall.dateKey
  }
  return best
}

/** Минимальная дата среди занятий «кластера» переноса: то же время, день — исходный или целевой шаблон (ср/чт). */
export async function minDateKeyForFollowingRescheduleCluster(
  supabase: SupabaseClient,
  teacherId: string,
  studentId: string,
  sourceWeekday: number,
  targetWeekday: number,
  normalizedWallTime: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("teacher_schedule_slots")
    .select("slot_at")
    .eq("teacher_id", teacherId)
    .eq("booked_student_id", studentId)
    .eq("status", "booked")
  if (error) return null
  let best: string | null = null
  for (const row of data ?? []) {
    const wall = wallClockFromSlotAt((row as { slot_at: string }).slot_at)
    if (normalizeScheduleSlotTime(wall.time) !== normalizedWallTime) continue
    const wd = calendarWeekdayFromDateKey(wall.dateKey)
    if (wd !== sourceWeekday && wd !== targetWeekday) continue
    if (best === null || wall.dateKey < best) best = wall.dateKey
  }
  return best
}

/** Сдвиг календарных дней между шаблонными днями недели (регулярный перенос). */
export function followingWeekdayTemplateDeltaDays(fromDateKey: string, toDateKey: string): number {
  const a = calendarWeekdayFromDateKey(fromDateKey)
  const b = calendarWeekdayFromDateKey(toDateKey)
  return (b - a + 7) % 7
}

/** Кратчайший сдвиг дней между днями недели (0–6), в диапазоне примерно ±3 дня. */
export function minimalWeekdayShiftDays(fromWeekday: number, toWeekday: number): number {
  let d = (toWeekday - fromWeekday + 7) % 7
  if (d > 3) d -= 7
  return d
}

/**
 * Сдвиг вперёд по календарю до ближайшего целевого дня недели (0…6 суток).
 * Для регулярного переноса кластера: чт→вт = +5 дней (следующий вторник), а не −2 (вторник той же недели до урока).
 */
export function forwardWeekdayShiftDays(fromWeekday: number, toWeekday: number): number {
  return (toWeekday - fromWeekday + 7) % 7
}

/**
 * Календарная дата первого переноса занятия `lessonDateKey` при смене дня недели серии
 * на weekday даты `templateTargetDateKey` (та же формула сдвига, что в reschedule_following_slots_atomic).
 */
export function firstFollowingMoveDateKeyForLesson(lessonDateKey: string, templateTargetDateKey: string): string {
  const lw = calendarWeekdayFromDateKey(lessonDateKey)
  const tw = calendarWeekdayFromDateKey(templateTargetDateKey)
  return addDaysToDateKey(lessonDateKey, forwardWeekdayShiftDays(lw, tw))
}

/**
 * Нижняя граница даты при выборе первого календарного дня целевого дня недели (to_date_key) для регулярного переноса.
 * Сдвиг шаблона ровно на −1 день (чт→ср в той же неделе) — с понедельника недели урока; иначе не раньше даты урока,
 * чтобы чт→вт не выбирал вторник до четверга (14.04), когда нужен первый вторник после урока (21.04).
 */
export function minDateKeyForFollowingRescheduleWeekdayPicker(lessonDateKey: string, targetWeekday: number): string {
  const lessonWd = calendarWeekdayFromDateKey(lessonDateKey)
  const weekStart = mondayDateKeyOfWeekContaining(lessonDateKey)
  const shift = minimalWeekdayShiftDays(lessonWd, targetWeekday)
  if (shift === -1) return weekStart
  return lessonDateKey
}
