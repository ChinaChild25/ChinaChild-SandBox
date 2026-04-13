import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher"
  assigned_teacher_id: string | null
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        teacher_id?: string
        slot_at?: string
      }
    | null

  const teacherId = body?.teacher_id?.trim() ?? ""
  const slotAt = body?.slot_at?.trim() ?? ""
  if (!teacherId || !slotAt) {
    return NextResponse.json({ error: "teacher_id and slot_at are required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (meErr || !me || me.role !== "student" || me.assigned_teacher_id !== teacherId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("teacher_schedule_slots")
    .update({
      status: "booked",
      booked_student_id: me.id
    })
    .eq("teacher_id", teacherId)
    .eq("slot_at", slotAt)
    .eq("status", "free")
    .select("teacher_id, slot_at, status, booked_student_id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: "Slot is not available" }, { status: 409 })

  return NextResponse.json({ booking: data })
}
