import {
  parseLessonStart,
  readStoredLessons,
  type ScheduledLesson
} from "@/lib/schedule-lessons"
import { readTeacherMirrorLessons } from "@/lib/teacher-schedule-sync"
import {
  getTeacherStudentById,
  TEACHER_STUDENTS_MOCK,
  type TeacherStudentMock
} from "@/lib/teacher-students-mock"

/** Уроки ученика в кабинете преподавателя: зеркало → хранилище ученика (Яна) → демо-seed */
export function getLessonsForTeacherView(studentId: string): ScheduledLesson[] {
  const mirror = readTeacherMirrorLessons(studentId)
  if (mirror && mirror.length > 0) return mirror

  if (studentId === "user-1" && typeof window !== "undefined") {
    const fromStudent = readStoredLessons()
    if (fromStudent && fromStudent.length > 0) return fromStudent
  }

  return getTeacherStudentById(studentId)?.seedLessons ?? []
}

export type TeacherCalendarEvent = {
  student: TeacherStudentMock
  lesson: ScheduledLesson
  start: Date
}

export function getAllTeacherCalendarEvents(): TeacherCalendarEvent[] {
  const out: TeacherCalendarEvent[] = []
  for (const s of TEACHER_STUDENTS_MOCK) {
    const lessons = getLessonsForTeacherView(s.id)
    for (const l of lessons) {
      out.push({
        student: s,
        lesson: l,
        start: parseLessonStart(l.dateKey, l.time)
      })
    }
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime())
  return out
}
