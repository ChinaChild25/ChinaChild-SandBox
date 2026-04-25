import { lessonWallClockEpochMs, type ScheduledLesson } from "@/lib/schedule-lessons"
import { getLessonsForTeacherView } from "@/lib/teacher-student-lessons"

export type UpcomingLessonDisplay = {
  lesson: ScheduledLesson
  start: Date
  dateLabel: string
  timeLabel: string
  weekdayShort: string
}

/** Ответ GET /api/schedule/teacher-student-lessons и аналогичных merge-endpoints. */
export type ApiScheduleLessonRow = {
  id: string
  scheduleSlotId?: string
  dateKey: string
  time: string
  title: string
  type: "lesson"
  teacherId?: string
  teacher?: string
  teacherAvatarUrl?: string
  onlineMeetingUrl?: string
}

export function scheduledLessonsFromApiRows(rows: ApiScheduleLessonRow[]): ScheduledLesson[] {
  return rows.map((l) => ({
    id: l.id,
    scheduleSlotId: l.scheduleSlotId,
    dateKey: l.dateKey,
    time: l.time,
    title: l.title,
    type: "lesson",
    teacherId: l.teacherId,
    teacher: l.teacher,
    teacherAvatarUrl: l.teacherAvatarUrl,
    onlineMeetingUrl: l.onlineMeetingUrl
  }))
}

function formatLabels(start: Date): { dateLabel: string; timeLabel: string; weekdayShort: string } {
  const dateLabel = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  const timeLabel = start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  const weekdayShort = start.toLocaleDateString("ru-RU", { weekday: "short" })
  return { dateLabel, timeLabel, weekdayShort }
}

/** Ближайшие занятия из уже загруженного списка (например с API). */
export function getUpcomingLessonsDisplayFromLessons(lessons: ScheduledLesson[], limit = 5): UpcomingLessonDisplay[] {
  const now = Date.now() - 60 * 60 * 1000
  const enriched = lessons
    .map((lesson) => {
      const t = lessonWallClockEpochMs(lesson.dateKey, lesson.time)
      const start = new Date(t)
      return { lesson, start, t }
    })
    .filter((x) => x.t >= now)
    .sort((a, b) => a.t - b.t)
    .slice(0, limit)

  return enriched.map(({ lesson, start }) => {
    const { dateLabel, timeLabel, weekdayShort } = formatLabels(start)
    return { lesson, start, dateLabel, timeLabel, weekdayShort }
  })
}

/** Демо / localStorage: зеркало и seed из mock-ученика. */
export function getUpcomingLessonsDisplay(studentId: string, limit = 5): UpcomingLessonDisplay[] {
  return getUpcomingLessonsDisplayFromLessons(getLessonsForTeacherView(studentId), limit)
}
