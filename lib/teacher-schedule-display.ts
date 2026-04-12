import { parseLessonStart, type ScheduledLesson } from "@/lib/schedule-lessons"
import { getLessonsForTeacherView } from "@/lib/teacher-student-lessons"

export type UpcomingLessonDisplay = {
  lesson: ScheduledLesson
  start: Date
  dateLabel: string
  timeLabel: string
  weekdayShort: string
}

function formatLabels(start: Date): { dateLabel: string; timeLabel: string; weekdayShort: string } {
  const dateLabel = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  const timeLabel = start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  const weekdayShort = start.toLocaleDateString("ru-RU", { weekday: "short" })
  return { dateLabel, timeLabel, weekdayShort }
}

/** Ближайшие занятия ученика для карточки преподавателя (с учётом зеркала из кабинета ученика). */
export function getUpcomingLessonsDisplay(studentId: string, limit = 5): UpcomingLessonDisplay[] {
  const lessons = getLessonsForTeacherView(studentId)
  const now = Date.now() - 60 * 60 * 1000
  const enriched = lessons
    .map((lesson) => {
      const start = parseLessonStart(lesson.dateKey, lesson.time)
      return { lesson, start, t: start.getTime() }
    })
    .filter((x) => x.t >= now)
    .sort((a, b) => a.t - b.t)
    .slice(0, limit)

  return enriched.map(({ lesson, start }) => {
    const { dateLabel, timeLabel, weekdayShort } = formatLabels(start)
    return { lesson, start, dateLabel, timeLabel, weekdayShort }
  })
}
