import { NextResponse } from "next/server"
import { getStudentSkillMap } from "@/lib/lesson-analytics/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "teacher" | "curator" }>()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 })
  }

  try {
    const adminSupabase = createAdminSupabaseClient()
    const skillMap = await getStudentSkillMap(adminSupabase, profile.id)

    return NextResponse.json({ skill_map: skillMap })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load skill map"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
