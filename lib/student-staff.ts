import { mentorsBySlug } from "@/lib/mentors"
import type { User } from "@/lib/types"

export const DEFAULT_CURATOR_SLUG = "eo-mi-ran"
export const DEFAULT_TEACHER_SLUG = "kim-ji-hun"

/** Закреплённые куратор и преподаватель ученика (разные люди). */
export function curatorAndTeacherForUser(user: User | null) {
  const cSlug = user?.assignedCuratorSlug ?? DEFAULT_CURATOR_SLUG
  const tSlug = user?.assignedTeacherSlug ?? DEFAULT_TEACHER_SLUG
  const curator = mentorsBySlug[cSlug] ?? mentorsBySlug[DEFAULT_CURATOR_SLUG]
  const teacher = mentorsBySlug[tSlug] ?? mentorsBySlug[DEFAULT_TEACHER_SLUG]
  return { curator, teacher, curatorSlug: curator.slug, teacherSlug: teacher.slug }
}
