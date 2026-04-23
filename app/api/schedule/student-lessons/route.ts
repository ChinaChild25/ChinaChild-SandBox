import { NextResponse } from "next/server"
import { normalizeMeetingUrl } from "@/lib/online-class-link"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { resolveTeacherIdFromStudentSlots } from "@/lib/schedule/resolve-teacher-from-student-slots"
import { normalizeScheduleSlotTime } from "@/lib/schedule/slot-time"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
  assigned_teacher_id: string | null
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function resolveTeacherAvatarUrl(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  raw: string | null | undefined
): string | undefined {
  const v = (raw ?? "").trim()
  if (!v) return undefined
  if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v
  // Legacy variants in DB: "avatars/<path>" or "<user>/<file>".
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

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me || me.role !== "student") return NextResponse.json({ error: "Student access required" }, { status: 403 })

  const effectiveTeacherId =
    me.assigned_teacher_id ?? (await resolveTeacherIdFromStudentSlots(supabase, me.id))

  let teacherName: string | undefined
  let teacherAvatarUrl: string | undefined
  let effectiveTeacherMeetingUrl: string | undefined
  if (effectiveTeacherId) {
    const { data: teacherProfile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, avatar_url, online_meeting_url")
      .eq("id", effectiveTeacherId)
      .maybeSingle<{
        id: string
        first_name: string | null
        last_name: string | null
        full_name: string | null
        avatar_url: string | null
        online_meeting_url: string | null
      }>()
    if (teacherProfile) {
      teacherName =
        teacherProfile.full_name?.trim() ||
        [teacherProfile.first_name?.trim() ?? "", teacherProfile.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
        undefined
      teacherAvatarUrl = teacherProfile.avatar_url?.trim() || undefined
      effectiveTeacherMeetingUrl = normalizeMeetingUrl(teacherProfile.online_meeting_url) ?? undefined
    }
  }

  const { data: directRows, error: directErr } = await supabase
    .from("student_schedule_slots")
    .select("student_id, date_key, time, title, teacher_name")
    .eq("student_id", me.id)
    .order("date_key", { ascending: true })
    .order("time", { ascending: true })
  if (directErr) return NextResponse.json({ error: directErr.message }, { status: 400 })

  const { data: teacherBookedRows, error: bookedErr } = await supabase
    .from("teacher_schedule_slots")
    .select("teacher_id, slot_at")
    .eq("booked_student_id", me.id)
    .eq("status", "booked")
    .order("slot_at", { ascending: true })
  if (bookedErr) return NextResponse.json({ error: bookedErr.message }, { status: 400 })

  const teacherAvatarByName = new Map<string, string>()
  const teacherNameById = new Map<string, string>()
  const teacherMeetingUrlById = new Map<string, string>()
  const teacherIds = [...new Set((teacherBookedRows ?? []).map((r) => (r as { teacher_id?: string }).teacher_id).filter((x): x is string => Boolean(x)))]
  if (effectiveTeacherId && !teacherIds.includes(effectiveTeacherId)) teacherIds.push(effectiveTeacherId)
  if (teacherIds.length > 0) {
    const { data: teacherProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, avatar_url, online_meeting_url")
      .in("id", teacherIds)
    for (const row of teacherProfiles ?? []) {
      const p = row as {
        id: string
        first_name: string | null
        last_name: string | null
        full_name: string | null
        avatar_url: string | null
        online_meeting_url: string | null
      }
      const resolvedName =
        p.full_name?.trim() ||
        [p.first_name?.trim() ?? "", p.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
        "Преподаватель"
      teacherNameById.set(p.id, resolvedName)
      const meetingNorm = normalizeMeetingUrl(p.online_meeting_url)
      if (meetingNorm) teacherMeetingUrlById.set(p.id, meetingNorm)
      const avatar = resolveTeacherAvatarUrl(supabase, p.avatar_url) || ""
      if (!avatar) continue
      const variants = [resolvedName, p.full_name?.trim() ?? ""]
      for (const variant of variants) {
        const key = normalizeName(variant)
        if (key && !teacherAvatarByName.has(key)) teacherAvatarByName.set(key, avatar)
      }
      if (!teacherAvatarUrl) teacherAvatarUrl = avatar || fallbackAvatarByTeacherName(resolvedName)
      if (!teacherName) teacherName = resolvedName
    }
  }
  // Legacy fallback: some rows keep only teacher_name, while teacher_id may be absent/non-profile id.
  const directTeacherNames = [...new Set((directRows ?? []).map((r) => r.teacher_name?.trim()).filter((v): v is string => Boolean(v)))]
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
      const variants = [
        p.full_name?.trim() ?? "",
        [p.first_name?.trim() ?? "", p.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim()
      ]
      for (const variant of variants) {
        const key = normalizeName(variant)
        if (key && !teacherAvatarByName.has(key)) teacherAvatarByName.set(key, avatar)
      }
    }
  }

  const inferred = (teacherBookedRows ?? []).map((r) => {
    const row = r as { teacher_id?: string | null; slot_at: string }
    const { dateKey, time } = wallClockFromSlotAt(row.slot_at)
    const timeNorm = normalizeScheduleSlotTime(time)
    const inferredTeacherName = row.teacher_id ? teacherNameById.get(row.teacher_id) : teacherName
    const tid = row.teacher_id ?? undefined
    const meeting =
      (tid ? teacherMeetingUrlById.get(tid) : undefined) ?? effectiveTeacherMeetingUrl
    return {
      id: `slot-${me.id}-${dateKey}-${timeNorm}`,
      dateKey,
      time: timeNorm,
      title: "Занятие",
      type: "lesson" as const,
      teacherId: tid,
      teacher: inferredTeacherName ?? teacherName,
      teacherAvatarUrl:
        teacherAvatarUrl ||
        teacherAvatarByName.get(normalizeName(inferredTeacherName)) ||
        fallbackAvatarByTeacherName(inferredTeacherName) ||
        undefined,
      onlineMeetingUrl: meeting
    }
  })

  const merged = new Map<
    string,
    {
      id: string
      dateKey: string
      time: string
      title: string
      type: "lesson"
      teacherId?: string
      teacher?: string
      teacherAvatarUrl?: string
      onlineMeetingUrl?: string
    }
  >()
  for (const r of directRows ?? []) {
    const timeNorm = normalizeScheduleSlotTime(r.time)
    const key = `${r.date_key}|${timeNorm}`
    merged.set(key, {
      id: `slot-${r.student_id}-${r.date_key}-${timeNorm}`,
      dateKey: r.date_key,
      time: timeNorm,
      title: r.title,
      type: "lesson",
      teacherId: effectiveTeacherId ?? undefined,
      teacher: r.teacher_name ?? teacherName ?? undefined,
      teacherAvatarUrl:
        teacherAvatarUrl ||
        teacherAvatarByName.get(normalizeName(r.teacher_name)) ||
        fallbackAvatarByTeacherName(r.teacher_name ?? teacherName) ||
        undefined,
      onlineMeetingUrl:
        (effectiveTeacherId ? teacherMeetingUrlById.get(effectiveTeacherId) : undefined) ??
        effectiveTeacherMeetingUrl
    })
  }
  const hasCanonicalBooked = inferred.length > 0
  if (hasCanonicalBooked) {
    // Canonical view: booked slots from teacher_schedule_slots.
    // Keep student rows only as metadata fallback by same dateKey|time key.
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
    return NextResponse.json({ lessons })
  }

  // Legacy fallback when canonical rows are temporarily absent.
  return NextResponse.json({
    lessons: Array.from(merged.values()).sort((a, b) =>
      a.dateKey === b.dateKey ? a.time.localeCompare(b.time) : a.dateKey.localeCompare(b.dateKey)
    )
  })
}
