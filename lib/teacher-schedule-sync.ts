/**
 * Демо-синхронизация: перенос урока учеником → зеркало для кабинета преподавателя + лента уведомлений.
 * Без бэкенда: localStorage + CustomEvent в той же вкладке.
 */

import type { ScheduledLesson } from "@/lib/schedule-lessons"

export const TEACHER_SCHEDULE_MIRROR_KEY = "chinachild-teacher-schedule-mirror-v1"
export const TEACHER_FEED_KEY = "chinachild-teacher-schedule-feed-v1"

export type TeacherFeedItem = {
  id: string
  at: string
  studentId: string
  studentName: string
  title: string
  message: string
}

function readMirrorMap(): Record<string, ScheduledLesson[]> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(TEACHER_SCHEDULE_MIRROR_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === "object" ? (o as Record<string, ScheduledLesson[]>) : {}
  } catch {
    return {}
  }
}

function writeMirrorMap(m: Record<string, ScheduledLesson[]>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(TEACHER_SCHEDULE_MIRROR_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

export function mirrorStudentLessonsForTeacher(studentId: string, lessons: ScheduledLesson[]) {
  if (typeof window === "undefined") return
  const m = readMirrorMap()
  m[studentId] = lessons
  writeMirrorMap(m)
  window.dispatchEvent(new Event("chinachild-teacher-schedule-updated"))
}

export function readTeacherMirrorLessons(studentId: string): ScheduledLesson[] | null {
  const m = readMirrorMap()
  const hit = m[studentId]
  return hit && hit.length > 0 ? hit : null
}

export function pushTeacherFeedItem(item: Omit<TeacherFeedItem, "id" | "at">) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(TEACHER_FEED_KEY)
    const prev = (raw ? (JSON.parse(raw) as TeacherFeedItem[]) : []) as TeacherFeedItem[]
    const next: TeacherFeedItem[] = [
      {
        ...item,
        id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString()
      },
      ...prev
    ].slice(0, 40)
    localStorage.setItem(TEACHER_FEED_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("chinachild-teacher-feed-updated"))
}

export function readTeacherFeed(): TeacherFeedItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(TEACHER_FEED_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as TeacherFeedItem[]) : []
  } catch {
    return []
  }
}

export function subscribeTeacherFeed(cb: () => void) {
  if (typeof window === "undefined") return () => {}
  const fn = () => cb()
  window.addEventListener("chinachild-teacher-feed-updated", fn)
  window.addEventListener("storage", fn)
  return () => {
    window.removeEventListener("chinachild-teacher-feed-updated", fn)
    window.removeEventListener("storage", fn)
  }
}

export function subscribeTeacherSchedule(cb: () => void) {
  if (typeof window === "undefined") return () => {}
  const fn = () => cb()
  window.addEventListener("chinachild-teacher-schedule-updated", fn)
  window.addEventListener("storage", fn)
  return () => {
    window.removeEventListener("chinachild-teacher-schedule-updated", fn)
    window.removeEventListener("storage", fn)
  }
}
