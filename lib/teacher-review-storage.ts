const STORAGE_KEY = "chinachild-my-teacher-reviews-v1"

export type StoredStudentTeacherReview = {
  userId: string
  teacherSlug: string
  stars: number
  text: string
  author: string
  createdAt: string
}

function readAll(): StoredStudentTeacherReview[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(rows: StoredStudentTeacherReview[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export function getMyReviewForTeacher(userId: string, teacherSlug: string): StoredStudentTeacherReview | null {
  return readAll().find((r) => r.userId === userId && r.teacherSlug === teacherSlug) ?? null
}

export function hasMyReviewForTeacher(userId: string, teacherSlug: string): boolean {
  return getMyReviewForTeacher(userId, teacherSlug) !== null
}

export function submitMyTeacherReview(
  userId: string,
  teacherSlug: string,
  payload: { stars: number; text: string; author: string }
): { ok: true } | { ok: false; reason: "already" | "invalid" } {
  if (payload.stars < 1 || payload.stars > 5 || payload.text.trim().length < 8) {
    return { ok: false, reason: "invalid" }
  }
  if (hasMyReviewForTeacher(userId, teacherSlug)) {
    return { ok: false, reason: "already" }
  }
  const row: StoredStudentTeacherReview = {
    userId,
    teacherSlug,
    stars: payload.stars,
    text: payload.text.trim(),
    author: payload.author.trim() || "Ученик",
    createdAt: new Date().toISOString()
  }
  writeAll([...readAll(), row])
  return { ok: true }
}
