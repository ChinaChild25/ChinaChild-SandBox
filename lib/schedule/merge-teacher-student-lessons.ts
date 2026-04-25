import type { SupabaseClient } from "@supabase/supabase-js"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { normalizeMeetingUrl } from "@/lib/online-class-link"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
  assigned_teacher_id: string | null
}

export type TeacherStudentMergedLesson = {
  id: string
  scheduleSlotId?: string
  dateKey: string
  time: string
  title: string
  type: "lesson"
  teacherId?: string
  teacher?: string
  teacherAvatarUrl?: string
  /** Ссылка на звонок текущего преподавателя (кабинет) — как у ученика в student-lessons */
  onlineMeetingUrl?: string
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function resolveTeacherAvatarUrl(supabase: SupabaseClient, raw: string | null | undefined): string | undefined {
  const v = (raw ?? "").trim()
  if (!v) return undefined
  if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v
  const normalized = v.replace(/^avatars\//, "")
  const { data } = supabase.storage.from("avatars").getPublicUrl(normalized)
  return data.publicUrl || undefined
}

function fallbackAvatarByTeacherName(name: string | null | undefined): string | undefined {
  const n = normalizeName(name)
  if (!n) return undefined
  if (n === "чжао ли" || n === "zhao li") return "/staff/zhao-li.png"
  if (n === "денис гасенко" || n === "denis gasenko") return "/staff/denis-gasenko-curator.png"
  return undefined
}

function displayNameFromProfile(p: {
  first_name: string | null
  last_name: string | null
  full_name: string | null
}): string {
  return (
    p.full_name?.trim() ||
    [p.first_name?.trim() ?? "", p.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
    "Преподаватель"
  )
}

type MergeFail = { ok: false; status: number; error: string }
type MergeOk = { ok: true; lessons: TeacherStudentMergedLesson[] }
export type MergeTeacherStudentResult = MergeFail | MergeOk

/**
 * Слияние student_schedule_slots и teacher_schedule_slots (booked) для пары преподаватель–ученик.
 * Совпадает с логикой GET /api/schedule/teacher-student-lessons.
 */
export async function mergeTeacherStudentLessonsFromDb(
  supabase: SupabaseClient,
  teacherId: string,
  studentId: string
): Promise<MergeTeacherStudentResult> {
  const { data: student, error: studentErr } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", studentId)
    .maybeSingle<ProfileLite>()
  if (studentErr || !student) return { ok: false, status: 404, error: "Student not found" }
  if (student.role !== "student") return { ok: false, status: 400, error: "Not a student profile" }

  const assignedToMe = student.assigned_teacher_id === teacherId
  let hasBookedWithMe = false
  if (!assignedToMe) {
    const { data: booked } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("teacher_id", teacherId)
      .eq("booked_student_id", studentId)
      .eq("status", "booked")
      .limit(1)
      .maybeSingle()
    hasBookedWithMe = Boolean(booked)
  }
  if (!assignedToMe && !hasBookedWithMe) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url, online_meeting_url")
    .eq("id", teacherId)
    .maybeSingle<{
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string | null
      avatar_url: string | null
      online_meeting_url: string | null
    }>()

  const teacherMeetingUrl = normalizeMeetingUrl(myProfile?.online_meeting_url) ?? undefined
  const teacherName = myProfile ? displayNameFromProfile(myProfile) : undefined
  const teacherAvatarUrl =
    (myProfile && (resolveTeacherAvatarUrl(supabase, myProfile.avatar_url) || fallbackAvatarByTeacherName(teacherName))) ||
    undefined

  const teacherNameById = new Map<string, string>([[teacherId, teacherName ?? "Преподаватель"]])
  const teacherAvatarByName = new Map<string, string>()
  if (teacherName && teacherAvatarUrl) {
    const key = normalizeName(teacherName)
    if (key) teacherAvatarByName.set(key, teacherAvatarUrl)
  }

  const { data: directRows, error: directErr } = await supabase
    .from("student_schedule_slots")
    .select("student_id, date_key, time, title, teacher_name")
    .eq("student_id", studentId)
    .order("date_key", { ascending: true })
    .order("time", { ascending: true })
  if (directErr) return { ok: false, status: 400, error: directErr.message }

  const { data: teacherBookedRows, error: bookedErr } = await supabase
    .from("teacher_schedule_slots")
    .select("id, teacher_id, slot_at")
    .eq("booked_student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("status", "booked")
    .order("slot_at", { ascending: true })
  if (bookedErr) return { ok: false, status: 400, error: bookedErr.message }

  const directTeacherNames = [
    ...new Set((directRows ?? []).map((r) => r.teacher_name?.trim()).filter((v): v is string => Boolean(v)))
  ]
  const unresolvedNames = directTeacherNames.filter((name) => !teacherAvatarByName.has(normalizeName(name)))
  if (unresolvedNames.length > 0) {
    const { data: allTeacherProfiles } = await supabase
      .from("profiles")
      .select("first_name, last_name, full_name, avatar_url")
      .eq("role", "teacher")
    for (const row of allTeacherProfiles ?? []) {
      const p = row as {
        first_name: string | null
        last_name: string | null
        full_name: string | null
        avatar_url: string | null
      }
      const avatar = resolveTeacherAvatarUrl(supabase, p.avatar_url) || ""
      if (!avatar) continue
      const resolvedName = displayNameFromProfile(p)
      const variants = [resolvedName, p.full_name?.trim() ?? ""]
      for (const variant of variants) {
        const key = normalizeName(variant)
        if (key && !teacherAvatarByName.has(key)) teacherAvatarByName.set(key, avatar)
      }
    }
  }

  const inferred = (teacherBookedRows ?? []).map((r) => {
    const row = r as { id: string; teacher_id?: string | null; slot_at: string }
    const { dateKey, time } = wallClockFromSlotAt(row.slot_at)
    const timeNorm = normalizeScheduleSlotTime(time)
    const inferredTeacherName = row.teacher_id ? teacherNameById.get(row.teacher_id) : teacherName
    return {
      id: `slot-${studentId}-${dateKey}-${timeNorm}`,
      scheduleSlotId: row.id,
      dateKey,
      time: timeNorm,
      title: "Занятие",
      type: "lesson" as const,
      teacherId: row.teacher_id ?? teacherId,
      teacher: inferredTeacherName ?? teacherName,
      teacherAvatarUrl:
        teacherAvatarUrl ||
        teacherAvatarByName.get(normalizeName(inferredTeacherName)) ||
        fallbackAvatarByTeacherName(inferredTeacherName) ||
        undefined,
      onlineMeetingUrl: teacherMeetingUrl
    }
  })

  const merged = new Map<string, TeacherStudentMergedLesson>()

  for (const r of directRows ?? []) {
    const timeNorm = normalizeScheduleSlotTime(r.time)
    const key = `${r.date_key}|${timeNorm}`
    merged.set(key, {
      id: `slot-${r.student_id}-${r.date_key}-${timeNorm}`,
      dateKey: r.date_key,
      time: timeNorm,
      title: r.title,
      type: "lesson",
      teacherId: student.assigned_teacher_id ?? undefined,
      teacher: r.teacher_name ?? teacherName ?? undefined,
      teacherAvatarUrl:
        teacherAvatarUrl ||
        teacherAvatarByName.get(normalizeName(r.teacher_name)) ||
        fallbackAvatarByTeacherName(r.teacher_name ?? teacherName) ||
        undefined,
      onlineMeetingUrl: teacherMeetingUrl
    })
  }

  const hasCanonicalBooked = inferred.length > 0
  if (hasCanonicalBooked) {
    // Canonical view: teacher booked slots define actual upcoming lessons.
    // Merge student_schedule only as metadata fallback for the same key.
    const directByKey = new Map<string, (typeof directRows extends Array<infer U> ? U : never)>()
    for (const row of directRows ?? []) {
      const key = `${row.date_key}|${normalizeScheduleSlotTime(row.time)}`
      directByKey.set(key, row)
    }
    const lessons = inferred
      .map((lesson) => {
        const key = `${lesson.dateKey}|${lesson.time}`
        const direct = directByKey.get(key) as { title?: string } | undefined
        return {
          ...lesson,
          title: (direct?.title ?? lesson.title).trim() || "Занятие"
        }
      })
      .sort((a, b) => (a.dateKey === b.dateKey ? a.time.localeCompare(b.time) : a.dateKey.localeCompare(b.dateKey)))
    return { ok: true, lessons }
  }

  const lessons = Array.from(merged.values()).sort((a, b) =>
    a.dateKey === b.dateKey ? a.time.localeCompare(b.time) : a.dateKey.localeCompare(b.dateKey)
  )
  return { ok: true, lessons }
}
