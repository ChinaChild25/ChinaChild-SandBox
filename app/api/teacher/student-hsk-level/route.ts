import { NextRequest, NextResponse } from "next/server"
import { HSK_LEVEL_MAX, HSK_LEVEL_MIN } from "@/lib/hsk-level"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  student_id?: string
  hsk_level?: number | null
}

/**
 * POST { student_id, hsk_level: 0..5 | null }
 * Только преподаватель/куратор с доступом к ученику (RPC set_student_hsk_level).
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

  if (!("hsk_level" in body)) {
    return NextResponse.json({ error: "hsk_level is required (0..5 or null)" }, { status: 400 })
  }

  const raw = body.hsk_level
  if (raw !== null) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < HSK_LEVEL_MIN || raw > HSK_LEVEL_MAX) {
      return NextResponse.json({ error: "hsk_level must be integer 0..5 or null" }, { status: 400 })
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Имена параметров в алфавитном порядке — надёжнее для PostgREST / кэша схемы
  const { error } = await supabase.rpc("set_student_hsk_level", {
    p_level: raw,
    p_student_id: studentId
  })

  if (error) {
    const msg = error.message || "RPC failed"
    if (/column "hsk_level" of relation "profiles" does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "Supabase schema is outdated: missing profiles.hsk_level column. Apply HSK migrations." },
        { status: 409 }
      )
    }
    if (/could not find the function public\.set_student_hsk_level/i.test(msg)) {
      return NextResponse.json(
        { error: "Supabase schema cache is stale or migration not applied: set_student_hsk_level missing." },
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
