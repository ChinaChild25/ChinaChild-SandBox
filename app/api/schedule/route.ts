import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher"
  assigned_teacher_id: string | null
}

function parseDateOr(defaultValue: Date, raw: string | null): Date {
  if (!raw) return defaultValue
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? defaultValue : d
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("id, role, assigned_teacher_id")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (meErr || !me) return NextResponse.json({ error: "Profile not found" }, { status: 403 })

  const teacherIdFromQuery = req.nextUrl.searchParams.get("teacher_id")?.trim() ?? ""
  let teacherId = teacherIdFromQuery
  if (!teacherId) {
    teacherId = me.role === "teacher" ? me.id : me.assigned_teacher_id ?? ""
  }
  if (!teacherId) return NextResponse.json({ slots: [] })

  if (me.role === "teacher" && teacherId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (me.role === "student" && teacherId !== me.assigned_teacher_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const fromDefault = new Date()
  fromDefault.setHours(0, 0, 0, 0)
  const toDefault = new Date(fromDefault)
  toDefault.setDate(toDefault.getDate() + 7)

  const from = parseDateOr(fromDefault, req.nextUrl.searchParams.get("from"))
  const to = parseDateOr(toDefault, req.nextUrl.searchParams.get("to"))

  let query = supabase
    .from("teacher_schedule_slots")
    .select("teacher_id, slot_at, status, booked_student_id")
    .eq("teacher_id", teacherId)
    .gte("slot_at", from.toISOString())
    .lt("slot_at", to.toISOString())
    .order("slot_at", { ascending: true })

  if (me.role === "student") {
    query = query.eq("status", "free")
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ slots: data ?? [] })
}
