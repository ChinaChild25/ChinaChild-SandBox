import type { SupabaseClient } from "@supabase/supabase-js"
import { displayNameFromProfileFields } from "@/lib/supabase/profile"
import type { TeacherStudentMock } from "@/lib/teacher-students-mock"

/**
 * Подставляет имя и аватар из public.profiles для строк с chatProfileId (UUID Supabase).
 * Журнал учеников остаётся на демо-метриках, но подпись совпадает с чатом.
 */
export async function hydrateTeacherStudentsFromProfiles(
  supabase: SupabaseClient,
  students: TeacherStudentMock[]
): Promise<TeacherStudentMock[]> {
  const ids = [...new Set(students.map((s) => s.chatProfileId?.trim()).filter((x): x is string => Boolean(x)))]
  if (ids.length === 0) return students

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url")
    .in("id", ids)

  if (error || !data?.length) return students

  type Row = {
    id: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    avatar_url: string | null
  }

  const byId = new Map((data as Row[]).map((p) => [p.id, p]))

  return students.map((s) => {
    const pid = s.chatProfileId?.trim()
    if (!pid) return s
    const p = byId.get(pid)
    if (!p) return s
    const name = displayNameFromProfileFields(p, null)
    const avatarUrl = p.avatar_url?.trim()
    return {
      ...s,
      name: name.trim() ? name : s.name,
      avatar: avatarUrl ? avatarUrl : s.avatar
    }
  })
}
