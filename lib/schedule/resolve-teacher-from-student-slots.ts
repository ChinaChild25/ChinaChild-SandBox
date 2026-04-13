import type { SupabaseClient } from "@supabase/supabase-js"

function normalizeTeacherName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function displayNameFromProfile(row: {
  full_name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  return (
    row.full_name?.trim() ||
    [row.first_name?.trim() ?? "", row.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    ""
  )
}

/**
 * Уроки из `student_schedule_slots` часто имеют только `teacher_name`, без `assigned_teacher_id`.
 * Без uuid преподавателя GET /api/schedule возвращал { slots: [] }.
 */
export async function resolveTeacherIdFromStudentSlots(
  supabase: SupabaseClient,
  studentId: string
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("student_schedule_slots")
    .select("teacher_name")
    .eq("student_id", studentId)
    .not("teacher_name", "is", null)
    .order("date_key", { ascending: false })
    .limit(24)

  const seen = new Set<string>()
  const names: string[] = []
  for (const r of rows ?? []) {
    const raw = (r as { teacher_name: string | null }).teacher_name?.trim()
    if (!raw) continue
    const key = normalizeTeacherName(raw)
    if (seen.has(key)) continue
    seen.add(key)
    names.push(raw)
  }
  if (names.length === 0) return null

  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name")
    .eq("role", "teacher")

  const idByNorm = new Map<string, string>()
  for (const t of teachers ?? []) {
    const p = t as {
      id: string
      full_name: string | null
      first_name: string | null
      last_name: string | null
    }
    const d = displayNameFromProfile(p)
    if (d) idByNorm.set(normalizeTeacherName(d), p.id)
    const short = [p.first_name?.trim(), p.last_name?.trim()].filter(Boolean).join(" ")
    if (short) idByNorm.set(normalizeTeacherName(short), p.id)
  }

  for (const n of names) {
    const id = idByNorm.get(normalizeTeacherName(n))
    if (id) return id
  }
  return null
}
