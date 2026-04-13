import { NextRequest, NextResponse } from "next/server"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
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

/**
 * GET ?student_id=<uuid>
 * Тот же порядок слияния, что у ученика в GET /api/schedule/student-lessons:
 * сначала student_schedule_slots, затем booked-слоты этого преподавателя из teacher_schedule_slots
 * (добавляются или дополняют совпадающие по date_key|time). Без записи в БД.
 */
export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("student_id")?.trim() ?? ""
  if (!studentId) return NextResponse.json({ error: "student_id is required" }, { status: 400 })

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
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const { data: student, error: studentErr } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", studentId)
    .maybeSingle<ProfileLite>()
  if (studentErr || !student) return NextResponse.json({ error: "Student not found" }, { status: 404 })
  if (student.role !== "student") return NextResponse.json({ error: "Not a student profile" }, { status: 400 })

  const assignedToMe = student.assigned_teacher_id === me.id
  let hasBookedWithMe = false
  if (!assignedToMe) {
    const { data: booked } = await supabase
      .from("teacher_schedule_slots")
      .select("teacher_id")
      .eq("teacher_id", me.id)
      .eq("booked_student_id", studentId)
      .eq("status", "booked")
      .limit(1)
      .maybeSingle()
    hasBookedWithMe = Boolean(booked)
  }
  if (!assignedToMe && !hasBookedWithMe) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url")
    .eq("id", me.id)
    .maybeSingle<{
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string | null
      avatar_url: string | null
    }>()

  const teacherName = myProfile ? displayNameFromProfile(myProfile) : undefined
  const teacherAvatarUrl =
    (myProfile && (resolveTeacherAvatarUrl(supabase, myProfile.avatar_url) || fallbackAvatarByTeacherName(teacherName))) ||
    undefined

  const teacherNameById = new Map<string, string>([[me.id, teacherName ?? "Преподаватель"]])
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
  if (directErr) return NextResponse.json({ error: directErr.message }, { status: 400 })

  const { data: teacherBookedRows, error: bookedErr } = await supabase
    .from("teacher_schedule_slots")
    .select("teacher_id, slot_at")
    .eq("booked_student_id", studentId)
    .eq("teacher_id", me.id)
    .eq("status", "booked")
    .order("slot_at", { ascending: true })
  if (bookedErr) return NextResponse.json({ error: bookedErr.message }, { status: 400 })

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
    const row = r as { teacher_id?: string | null; slot_at: string }
    const { dateKey, time } = wallClockFromSlotAt(row.slot_at)
    const timeNorm = normalizeScheduleSlotTime(time)
    const inferredTeacherName = row.teacher_id ? teacherNameById.get(row.teacher_id) : teacherName
    return {
      id: `slot-${studentId}-${dateKey}-${timeNorm}`,
      dateKey,
      time: timeNorm,
      title: "Занятие",
      type: "lesson" as const,
      teacherId: row.teacher_id ?? me.id,
      teacher: inferredTeacherName ?? teacherName,
      teacherAvatarUrl:
        teacherAvatarUrl ||
        teacherAvatarByName.get(normalizeName(inferredTeacherName)) ||
        fallbackAvatarByTeacherName(inferredTeacherName) ||
        undefined
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
      teacherId: student.assigned_teacher_id ?? undefined,
      teacher: r.teacher_name ?? teacherName ?? undefined,
      teacherAvatarUrl:
        teacherAvatarUrl ||
        teacherAvatarByName.get(normalizeName(r.teacher_name)) ||
        fallbackAvatarByTeacherName(r.teacher_name ?? teacherName) ||
        undefined
    })
  }

  for (const l of inferred) {
    const key = `${l.dateKey}|${l.time}`
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, l)
      continue
    }
    merged.set(key, {
      ...prev,
      teacherId: prev.teacherId ?? l.teacherId,
      teacher: prev.teacher ?? l.teacher,
      teacherAvatarUrl: prev.teacherAvatarUrl ?? l.teacherAvatarUrl
    })
  }

  const lessons = Array.from(merged.values()).sort((a, b) =>
    a.dateKey === b.dateKey ? a.time.localeCompare(b.time) : a.dateKey.localeCompare(b.dateKey)
  )
  return NextResponse.json({ lessons })
}
