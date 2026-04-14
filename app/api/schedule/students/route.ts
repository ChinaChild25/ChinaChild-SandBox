import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "teacher" | "curator" | "student"
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url")
    .eq("role", "student")
    .eq("assigned_teacher_id", me.id)
    .order("first_name", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const students = (data ?? []).map((row) => {
    const r = row as {
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string | null
      avatar_url: string | null
    }
    const name =
      r.full_name?.trim() ||
      [r.first_name?.trim() ?? "", r.last_name?.trim() ?? ""].filter(Boolean).join(" ").trim() ||
      "Ученик"
    return { id: r.id, name, avatarUrl: r.avatar_url?.trim() || undefined }
  })
  return NextResponse.json({ students })
}
