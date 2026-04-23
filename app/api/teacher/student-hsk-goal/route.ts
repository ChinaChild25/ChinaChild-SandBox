import { NextRequest, NextResponse } from "next/server"
import { HSK_GOAL_MAX, HSK_GOAL_MIN } from "@/lib/hsk-goal"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  student_id?: string
  hsk_goal?: number | null
}

/**
 * POST { student_id, hsk_goal: 1..5 | null }
 * Преподаватель/куратор — RPC set_student_hsk_goal.
 */
export async function POST(req: NextRequest) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : ""
  if (!studentId) return NextResponse.json({ error: "student_id is required" }, { status: 400 })

  if (!("hsk_goal" in body)) {
    return NextResponse.json({ error: "hsk_goal is required (1..5 or null)" }, { status: 400 })
  }

  const raw = body.hsk_goal
  if (raw !== null) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < HSK_GOAL_MIN || raw > HSK_GOAL_MAX) {
      return NextResponse.json({ error: "hsk_goal must be integer 1..5 or null" }, { status: 400 })
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase.rpc("set_student_hsk_goal", {
    p_goal: raw,
    p_student_id: studentId
  })

  if (error) {
    const msg = error.message || "RPC failed"
    if (/column "hsk_goal" of relation "profiles" does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "Supabase schema is outdated: missing profiles.hsk_goal column. Apply HSK migrations." },
        { status: 409 }
      )
    }
    if (/function public\.teacher_can_set_student_hsk\(uuid, uuid\) does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "Supabase schema is outdated: teacher_can_set_student_hsk helper is missing." },
        { status: 409 }
      )
    }
    if (/could not find the function public\.set_student_hsk_goal/i.test(msg)) {
      return NextResponse.json(
        { error: "Supabase schema cache is stale or migration not applied: set_student_hsk_goal missing." },
        { status: 409 }
      )
    }
    if (/forbidden|not authenticated|student not found/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
