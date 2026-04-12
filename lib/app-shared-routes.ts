import { lessonSlugs } from "@/lib/course-catalog"

/**
 * Преподаватель открывает уроки и карточки кураторов по тем же URL, что и ученик,
 * но в оболочке кабинета преподавателя (см. app/(app)/layout.tsx).
 */
export function isTeacherSharedContentPath(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? ""
  if (p.startsWith("/mentors/")) return true
  const parts = p.split("/").filter(Boolean)
  if (parts.length !== 1) return false
  return lessonSlugs.includes(parts[0]!)
}
