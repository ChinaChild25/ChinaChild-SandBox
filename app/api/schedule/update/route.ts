import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { TeacherScheduleStatus } from "@/lib/teacher-schedule"

type BulkSlotInput = {
  slot_at: string
  status: TeacherScheduleStatus
}

type ProfileLite = {
  id: string
  role: "student" | "teacher"
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        teacher_id?: string
        slots?: BulkSlotInput[]
      }
    | null
  const rawSlots = body?.slots ?? []
  if (!Array.isArray(rawSlots) || rawSlots.length === 0) {
    return NextResponse.json({ error: "slots are required" }, { status: 400 })
  }

  const slots = rawSlots.filter((s) => s && (s.status === "free" || s.status === "busy") && !!s.slot_at)
  if (slots.length === 0) {
    return NextResponse.json({ error: "only free/busy statuses are allowed" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (meErr || !me || me.role !== "teacher") {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const teacherId = (body?.teacher_id?.trim() || me.id) as string
  if (teacherId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const slotAts = slots.map((s) => s.slot_at)
  const { data: existing, error: existingErr } = await supabase
    .from("teacher_schedule_slots")
    .select("slot_at, status")
    .eq("teacher_id", teacherId)
    .in("slot_at", slotAts)

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 400 })

  const booked = new Set((existing ?? []).filter((r) => r.status === "booked").map((r) => r.slot_at))
  const payload = slots
    .filter((s) => !booked.has(s.slot_at))
    .map((s) => ({
      teacher_id: teacherId,
      slot_at: s.slot_at,
      status: s.status,
      booked_student_id: null as string | null
    }))

  if (payload.length > 0) {
    const { error: upsertErr } = await supabase
      .from("teacher_schedule_slots")
      .upsert(payload, { onConflict: "teacher_id,slot_at" })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 })
  }

  return NextResponse.json({
    updated: payload.length,
    skippedBooked: booked.size
  })
}
