import { NextResponse } from "next/server"
import {
  isLessonAnalyticsConfigured,
  processPendingLessonAnalyticsJobs,
} from "@/lib/lesson-analytics/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false
  return request.headers.get("authorization") === `Bearer ${cronSecret}`
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  if (!isLessonAnalyticsConfigured()) {
    return NextResponse.json(
      { ok: false, skipped: "OPENAI_API_KEY is not configured." },
      { status: 503 }
    )
  }

  try {
    const adminSupabase = createAdminSupabaseClient()
    const summary = await processPendingLessonAnalyticsJobs({
      adminSupabase,
      limit: 3,
    })
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lesson processing failed." },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
