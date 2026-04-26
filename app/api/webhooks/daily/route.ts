import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { processPendingLessonAnalyticsJobsIfConfigured } from "@/lib/lesson-analytics/server"
import {
  completeLessonSession,
  findLatestLessonSessionByRoomName,
  importStoredDailyTranscriptForSession,
  queueSessionAnalysis,
  recordDailyWebhookEvent,
  updateDailyWebhookEventSession,
  updateSessionFromWebhook,
} from "@/lib/live-lessons/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type DailyWebhookEnvelope = {
  id?: string
  type?: string
  payload?: Record<string, unknown>
}

function trimEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function extractRoomName(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null
  const room =
    payload.room_name ??
    payload.room ??
    payload.roomName ??
    payload["room-name"]

  return typeof room === "string" && room.trim() ? room.trim() : null
}

function extractUnixTimestamp(value: unknown): string | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return new Date(parsed * 1000).toISOString()
}

function safeJsonValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function isSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function maybeVerifyBasicAuth(authHeader: string | null): boolean {
  const expected = trimEnv(process.env.DAILY_WEBHOOK_BASIC_AUTH)
  if (!expected) return true
  return authHeader === `Basic ${expected}`
}

function maybeVerifyWebhookHmac(rawBody: string, signatureHeader: string | null, timestampHeader: string | null): boolean {
  const secretBase64 = trimEnv(process.env.DAILY_WEBHOOK_HMAC_BASE64)
  if (!secretBase64) return true
  if (!signatureHeader) return false
  const normalizedSignature = signatureHeader.trim().replace(/^sha256=/i, "")

  const secret = Buffer.from(secretBase64, "base64")
  const candidates = [
    rawBody,
    timestampHeader ? `${timestampHeader}.${rawBody}` : null,
    timestampHeader ? `${timestampHeader}${rawBody}` : null,
  ].filter((candidate): candidate is string => Boolean(candidate))

  return candidates.some((candidate) => {
    const digest = createHmac("sha256", secret).update(candidate).digest("hex")
    return isSafeEqualString(digest, normalizedSignature)
  })
}

async function sessionHasTranscriptRows(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  sessionId: string
): Promise<boolean> {
  const { count, error } = await adminSupabase
    .from("lesson_transcripts")
    .select("id", { head: true, count: "exact" })
    .eq("session_id", sessionId)

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!maybeVerifyBasicAuth(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  if (!maybeVerifyWebhookHmac(rawBody, request.headers.get("x-webhook-signature"), request.headers.get("x-webhook-timestamp"))) {
    return new NextResponse("Invalid signature", { status: 401 })
  }

  const event = (() => {
    try {
      return JSON.parse(rawBody || "{}") as DailyWebhookEnvelope
    } catch {
      return null
    }
  })()
  if (!event) {
    return new NextResponse("Invalid JSON", { status: 400 })
  }
  const eventType = event.type?.trim()
  const eventId = event.id?.trim()
  const payload = safeJsonValue(event.payload)

  if (!eventType || !eventId) {
    return NextResponse.json({ ok: true, ignored: "verification_or_unknown_payload" })
  }

  const roomName = extractRoomName(payload)
  const adminSupabase = createAdminSupabaseClient()

  const recorded = await recordDailyWebhookEvent({
    adminSupabase,
    eventId,
    eventType,
    roomName,
    payload,
  })
  if (recorded === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const session = roomName ? await findLatestLessonSessionByRoomName(adminSupabase, roomName) : null
  if (session) {
    await updateDailyWebhookEventSession(adminSupabase, eventId, session.id)
  }

  if (!session) {
    return NextResponse.json({ ok: true, stored: true, matchedSession: false })
  }

  switch (eventType) {
    case "meeting.started":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          started_at: extractUnixTimestamp(payload.start_ts) ?? session.started_at,
          daily_meeting_id: typeof payload.meeting_id === "string" ? payload.meeting_id : null,
          status: "active",
        },
        contextPatch: {
          daily_room_name: roomName,
          last_daily_event: eventType,
        },
      })
      break

    case "meeting.ended":
      await completeLessonSession({
        adminSupabase,
        sessionId: session.id,
        endedAt: extractUnixTimestamp(payload.end_ts) ?? new Date().toISOString(),
        queueDelaySeconds: 0,
        reason: "daily_meeting_ended",
        contextPatch: {
          daily_meeting_id: typeof payload.meeting_id === "string" ? payload.meeting_id : null,
          last_daily_event: eventType,
        },
      })
      break

    case "transcript.started":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          daily_transcript_id: typeof payload.id === "string" ? payload.id : null,
          transcript_status: "starting",
        },
        contextPatch: {
          last_daily_event: eventType,
          daily_transcript_meta: payload,
        },
      })
      break

    case "transcript.ready-to-download":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          daily_transcript_id: typeof payload.id === "string" ? payload.id : null,
          transcript_status: "ready",
        },
        contextPatch: {
          last_daily_event: eventType,
          daily_transcript_meta: payload,
        },
      })
      await importStoredDailyTranscriptForSession({
        adminSupabase,
        sessionId: session.id,
        transcriptId: typeof payload.id === "string" ? payload.id : null,
      })
      await queueSessionAnalysis({
        adminSupabase,
        sessionId: session.id,
        availableAfterSeconds: 0,
        reason: "daily_transcript_ready",
      })
      break

    case "transcript.error":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          transcript_status: "error",
          processing_error:
            typeof payload.error === "string"
              ? payload.error
              : typeof payload.error_msg === "string"
                ? payload.error_msg
                : "Daily transcript error",
        },
        contextPatch: {
          last_daily_event: eventType,
          daily_transcript_meta: payload,
        },
      })
      break

    case "recording.started":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          daily_recording_id: typeof payload.recording_id === "string" ? payload.recording_id : null,
          daily_recording_type: typeof payload.type === "string" ? payload.type : null,
          recording_status: "starting",
        },
        contextPatch: {
          last_daily_event: eventType,
          daily_recording_meta: payload,
        },
      })
      break

    case "recording.ready-to-download":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          daily_recording_id: typeof payload.recording_id === "string" ? payload.recording_id : null,
          daily_recording_type: typeof payload.type === "string" ? payload.type : null,
          recording_status: "ready",
        },
        contextPatch: {
          last_daily_event: eventType,
          daily_recording_meta: payload,
        },
      })
      break

    case "recording.error":
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {
          recording_status: "error",
          processing_error:
            typeof payload.error === "string"
              ? payload.error
              : typeof payload.error_msg === "string"
                ? payload.error_msg
                : "Daily recording error",
        },
        contextPatch: {
          last_daily_event: eventType,
          daily_recording_meta: payload,
        },
      })
      break

    default:
      await updateSessionFromWebhook({
        adminSupabase,
        sessionId: session.id,
        patch: {},
        contextPatch: {
          last_daily_event: eventType,
        },
      })
      break
  }

  if (
    (eventType === "meeting.ended" || eventType === "transcript.ready-to-download") &&
    (await sessionHasTranscriptRows(adminSupabase, session.id))
  ) {
    await processPendingLessonAnalyticsJobsIfConfigured({
      adminSupabase,
      limit: 3,
    })
  }

  return NextResponse.json({ ok: true, matchedSession: true, eventType })
}
