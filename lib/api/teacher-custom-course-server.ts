import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ProfileRole = "student" | "teacher" | "curator"

export async function requireTeacher() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: ProfileRole }>()

  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return { error: NextResponse.json({ error: "Teacher access required" }, { status: 403 }) }
  }

  return { supabase, me }
}

export async function assertOwnCustomCourse(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherId: string,
  courseId: string
) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, is_custom, teacher_id")
    .eq("id", courseId)
    .maybeSingle<{ id: string; is_custom: boolean; teacher_id: string | null }>()

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 400 }) }
  if (!data) return { error: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
  if (!data.is_custom || data.teacher_id !== teacherId) {
    return { error: NextResponse.json({ error: "Only custom teacher courses are editable" }, { status: 403 }) }
  }
  return { ok: true as const }
}
