import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { emptyWeeklyTemplate, type WeeklyTemplate } from "@/lib/teacher-availability-template"

type ProfileLite = { id: string; role: "student" | "teacher" | "curator" }

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("teacher_schedule_templates")
    .select("teacher_id, timezone, weekly_template")
    .eq("teacher_id", me.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    template: (data?.weekly_template as WeeklyTemplate | undefined) ?? emptyWeeklyTemplate(),
    timezone: data?.timezone ?? "Europe/Moscow"
  })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        timezone?: string
        template?: WeeklyTemplate
      }
    | null

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (!me || (me.role !== "teacher" && me.role !== "curator")) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 })
  }

  const timezone = body?.timezone?.trim() || "Europe/Moscow"
  const template = body?.template ?? emptyWeeklyTemplate()

  const { error } = await supabase.from("teacher_schedule_templates").upsert(
    {
      teacher_id: me.id,
      timezone,
      weekly_template: template
    },
    { onConflict: "teacher_id" }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
