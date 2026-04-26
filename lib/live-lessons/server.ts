import { createHash } from "node:crypto"
import {
  createOrGetDailyLessonRoom,
  createOrGetDailyPrivateRoom,
  getDailyTranscriptAccessLink,
} from "@/lib/daily/server"
import { parseDailyTranscriptVtt } from "@/lib/daily-transcript-vtt"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { displayNameFromProfileFields } from "@/lib/supabase/profile"

type AdminSupabase = ReturnType<typeof createAdminSupabaseClient>

export type ProfileRole = "student" | "teacher" | "curator"

type RoomRow = {
  id: string
  room_type: "private" | "lesson" | "group"
  daily_room_name: string
  daily_room_url: string
  teacher_id: string | null
  student_id: string | null
  lesson_id: string | null
}

type LessonSessionRow = {
  id: string
  room_id: string
  lesson_id: string | null
  schedule_slot_id: string | null
  teacher_id: string | null
  student_id: string | null
  started_at: string | null
  ended_at: string | null
  status: "active" | "awaiting_artifacts" | "processing" | "done" | "failed"
  transcript_status: "not_started" | "starting" | "ready" | "error"
  context: Record<string, unknown> | null
  created_at: string
}

export type LiveTranscriptSnippet = {
  participantId: string
  participantUserId?: string | null
  participantName?: string | null
  trackType?: string | null
  text: string
  timestamp: string
  dedupeKey?: string | null
}

type SessionParticipantProfile = {
  first_name: string | null
  last_name: string | null
  full_name: string | null
}

export type StoredTranscriptImportResult =
  | { status: "imported"; inserted: number; transcriptId: string }
  | { status: "skipped-no-transcript-id"; inserted: 0; transcriptId: null }
  | { status: "skipped-no-vtt"; inserted: 0; transcriptId: string }
  | { status: "skipped-empty-vtt"; inserted: 0; transcriptId: string }
  | { status: "skipped-existing-rows"; inserted: 0; transcriptId: string }

const SESSION_STALE_AFTER_MS = 1000 * 60 * 60 * 8

export function isTeacherProfileRole(role: ProfileRole): boolean {
  return role === "teacher" || role === "curator"
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function mergeContext(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base = current && typeof current === "object" ? current : {}
  const next = patch && typeof patch === "object" ? patch : {}
  return { ...base, ...next }
}

function transcriptDedupeKey(sessionId: string, segment: LiveTranscriptSnippet): string {
  const seed = [
    sessionId,
    segment.participantId.trim(),
    trimOrNull(segment.participantUserId) ?? "",
    segment.timestamp.trim(),
    segment.text.trim(),
  ].join("::")

  return createHash("sha256").update(seed).digest("hex")
}

function normalizedSpeakerIdentity(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
  return normalized || null
}

function candidateDisplayNames(profile: SessionParticipantProfile | null | undefined): Set<string> {
  const candidates = new Set<string>()
  if (!profile) return candidates

  const full = displayNameFromProfileFields(profile, null)
  const first = profile.first_name?.trim() || ""
  const last = profile.last_name?.trim() || ""
  const combined = [first, last].filter(Boolean).join(" ").trim()

  for (const candidate of [full, combined, first, last, profile.full_name?.trim() || ""]) {
    const normalized = normalizedSpeakerIdentity(candidate)
    if (normalized) candidates.add(normalized)
  }

  return candidates
}

function detectStoredTranscriptSpeakerRole(args: {
  speakerLabel: string | null
  teacherNames: Set<string>
  studentNames: Set<string>
}): "teacher" | "student" | "unknown" {
  const normalizedLabel = normalizedSpeakerIdentity(args.speakerLabel)
  if (!normalizedLabel) return "unknown"

  const isTeacher = args.teacherNames.has(normalizedLabel)
  const isStudent = args.studentNames.has(normalizedLabel)

  if (isTeacher && !isStudent) return "teacher"
  if (isStudent && !isTeacher) return "student"
  return "unknown"
}

function storedTranscriptDedupeKey(args: {
  sessionId: string
  transcriptId: string
  cueIndex: number
  speakerLabel: string | null
  text: string
  startedAtSec: number | null
  endedAtSec: number | null
}): string {
  const seed = [
    args.sessionId,
    args.transcriptId,
    String(args.cueIndex),
    args.speakerLabel?.trim() ?? "",
    args.text.trim(),
    args.startedAtSec?.toFixed(3) ?? "",
    args.endedAtSec?.toFixed(3) ?? "",
  ].join("::")

  return createHash("sha256").update(seed).digest("hex")
}

async function getExistingPrivateRoom(
  adminSupabase: AdminSupabase,
  teacherId: string,
  studentId: string
): Promise<RoomRow | null> {
  const { data, error } = await adminSupabase
    .from("rooms")
    .select("id, room_type, daily_room_name, daily_room_url, teacher_id, student_id, lesson_id")
    .eq("room_type", "private")
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .maybeSingle<RoomRow>()

  if (error) throw new Error(error.message)
  return data ?? null
}

async function getExistingLessonRoom(adminSupabase: AdminSupabase, lessonId: string): Promise<RoomRow | null> {
  const { data, error } = await adminSupabase
    .from("rooms")
    .select("id, room_type, daily_room_name, daily_room_url, teacher_id, student_id, lesson_id")
    .eq("room_type", "lesson")
    .eq("lesson_id", lessonId)
    .maybeSingle<RoomRow>()

  if (error) throw new Error(error.message)
  return data ?? null
}

async function getOrCreatePrivateRoom(args: {
  adminSupabase: AdminSupabase
  teacherId: string
  studentId: string
}): Promise<RoomRow> {
  const existing = await getExistingPrivateRoom(args.adminSupabase, args.teacherId, args.studentId)
  if (existing) return existing

  const dailyRoom = await createOrGetDailyPrivateRoom(args.teacherId, args.studentId)
  const { data, error } = await args.adminSupabase
    .from("rooms")
    .insert({
      room_type: "private",
      teacher_id: args.teacherId,
      student_id: args.studentId,
      daily_room_name: dailyRoom.name,
      daily_room_url: dailyRoom.url,
    })
    .select("id, room_type, daily_room_name, daily_room_url, teacher_id, student_id, lesson_id")
    .single<RoomRow>()

  if (error) {
    const raced = await getExistingPrivateRoom(args.adminSupabase, args.teacherId, args.studentId)
    if (raced) return raced
    throw new Error(error.message)
  }

  return data
}

async function getOrCreateLessonRoom(args: {
  adminSupabase: AdminSupabase
  lessonId: string
}): Promise<RoomRow> {
  const existing = await getExistingLessonRoom(args.adminSupabase, args.lessonId)
  if (existing) return existing

  const dailyRoom = await createOrGetDailyLessonRoom(args.lessonId)
  const { data, error } = await args.adminSupabase
    .from("rooms")
    .insert({
      room_type: "lesson",
      lesson_id: args.lessonId,
      daily_room_name: dailyRoom.name,
      daily_room_url: dailyRoom.url,
    })
    .select("id, room_type, daily_room_name, daily_room_url, teacher_id, student_id, lesson_id")
    .single<RoomRow>()

  if (error) {
    const raced = await getExistingLessonRoom(args.adminSupabase, args.lessonId)
    if (raced) return raced
    throw new Error(error.message)
  }

  return data
}

async function getOrCreateScheduleRoom(args: {
  adminSupabase: AdminSupabase
  scheduleSlotId: string
  teacherId: string
  studentId: string
}): Promise<RoomRow> {
  const existing = await getExistingPrivateRoom(args.adminSupabase, args.teacherId, args.studentId)
  if (existing) return existing

  const dailyRoom = await createOrGetDailyPrivateRoom(args.teacherId, args.studentId)
  const { data, error } = await args.adminSupabase
    .from("rooms")
    .insert({
      room_type: "private",
      teacher_id: args.teacherId,
      student_id: args.studentId,
      daily_room_name: dailyRoom.name,
      daily_room_url: dailyRoom.url,
    })
    .select("id, room_type, daily_room_name, daily_room_url, teacher_id, student_id, lesson_id")
    .single<RoomRow>()

  if (error) {
    const raced = await getExistingPrivateRoom(args.adminSupabase, args.teacherId, args.studentId)
    if (raced) return raced
    throw new Error(error.message)
  }

  return data
}

export async function resolveRoomForLesson(args: {
  adminSupabase: AdminSupabase
  lessonId: string
  teacherId?: string | null
  studentId?: string | null
}): Promise<RoomRow> {
  const teacherId = trimOrNull(args.teacherId)
  const studentId = trimOrNull(args.studentId)

  if (teacherId && studentId) {
    return getOrCreatePrivateRoom({
      adminSupabase: args.adminSupabase,
      teacherId,
      studentId,
    })
  }

  return getOrCreateLessonRoom({
    adminSupabase: args.adminSupabase,
    lessonId: args.lessonId,
  })
}

export async function resolveRoomForScheduleSlot(args: {
  adminSupabase: AdminSupabase
  scheduleSlotId: string
  teacherId: string
  studentId: string
}): Promise<RoomRow> {
  return getOrCreateScheduleRoom(args)
}

async function markStaleActiveSessionsAsFailed(adminSupabase: AdminSupabase, roomId: string) {
  const staleBefore = new Date(Date.now() - SESSION_STALE_AFTER_MS).toISOString()
  const { error } = await adminSupabase
    .from("lesson_sessions")
    .update({
      ended_at: new Date().toISOString(),
      status: "failed",
      processing_error: "Superseded by a newer live session allocation."
    })
    .eq("room_id", roomId)
    .eq("status", "active")
    .lt("created_at", staleBefore)

  if (error) throw new Error(error.message)
}

export async function ensureActiveLessonSession(args: {
  adminSupabase: AdminSupabase
  roomId: string
  lessonId?: string | null
  scheduleSlotId?: string | null
  teacherId?: string | null
  studentId?: string | null
  context?: Record<string, unknown>
}): Promise<LessonSessionRow> {
  const lessonId = trimOrNull(args.lessonId)
  const scheduleSlotId = trimOrNull(args.scheduleSlotId)
  await markStaleActiveSessionsAsFailed(args.adminSupabase, args.roomId)

  let query = args.adminSupabase
    .from("lesson_sessions")
    .select(
      "id, room_id, lesson_id, schedule_slot_id, teacher_id, student_id, started_at, ended_at, status, transcript_status, context, created_at"
    )
    .eq("room_id", args.roomId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)

  if (lessonId) query = query.eq("lesson_id", lessonId)
  if (scheduleSlotId) query = query.eq("schedule_slot_id", scheduleSlotId)

  const { data: existing, error: existingError } = await query.maybeSingle<LessonSessionRow>()
  if (existingError) throw new Error(existingError.message)
  if (existing) return existing

  const { data, error } = await args.adminSupabase
    .from("lesson_sessions")
    .insert({
      room_id: args.roomId,
      lesson_id: lessonId,
      schedule_slot_id: scheduleSlotId,
      teacher_id: trimOrNull(args.teacherId),
      student_id: trimOrNull(args.studentId),
      started_at: new Date().toISOString(),
      status: "active",
      context: args.context ?? {},
    })
    .select(
      "id, room_id, lesson_id, schedule_slot_id, teacher_id, student_id, started_at, ended_at, status, transcript_status, context, created_at"
    )
    .single<LessonSessionRow>()

  if (error) throw new Error(error.message)
  return data
}

export async function findLatestLessonSessionByRoomName(
  adminSupabase: AdminSupabase,
  roomName: string
): Promise<LessonSessionRow | null> {
  const { data: room, error: roomError } = await adminSupabase
    .from("rooms")
    .select("id")
    .eq("daily_room_name", roomName)
    .maybeSingle<{ id: string }>()

  if (roomError) throw new Error(roomError.message)
  if (!room) return null

  const { data: session, error: sessionError } = await adminSupabase
    .from("lesson_sessions")
    .select(
      "id, room_id, lesson_id, schedule_slot_id, teacher_id, student_id, started_at, ended_at, status, transcript_status, context, created_at"
    )
    .eq("room_id", room.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<LessonSessionRow>()

  if (sessionError) throw new Error(sessionError.message)
  return session ?? null
}

export async function recordDailyWebhookEvent(args: {
  adminSupabase: AdminSupabase
  eventId: string
  eventType: string
  roomName?: string | null
  payload: Record<string, unknown>
  sessionId?: string | null
}): Promise<"inserted" | "duplicate"> {
  const { error } = await args.adminSupabase.from("daily_webhook_events").insert({
    id: args.eventId,
    event_type: args.eventType,
    room_name: trimOrNull(args.roomName),
    session_id: trimOrNull(args.sessionId),
    payload: args.payload,
  })

  if (!error) return "inserted"
  if ((error as { code?: string }).code === "23505") return "duplicate"
  throw new Error(error.message)
}

export async function updateDailyWebhookEventSession(
  adminSupabase: AdminSupabase,
  eventId: string,
  sessionId: string | null
) {
  const { error } = await adminSupabase
    .from("daily_webhook_events")
    .update({ session_id: trimOrNull(sessionId) })
    .eq("id", eventId)

  if (error) throw new Error(error.message)
}

export async function updateSessionFromWebhook(args: {
  adminSupabase: AdminSupabase
  sessionId: string
  patch: Partial<{
    started_at: string | null
    ended_at: string | null
    daily_meeting_id: string | null
    daily_recording_id: string | null
    daily_recording_type: string | null
    daily_transcript_id: string | null
    recording_status: string
    transcript_status: string
    status: string
    processing_error: string | null
  }>
  contextPatch?: Record<string, unknown>
}) {
  const { data: existing, error: existingError } = await args.adminSupabase
    .from("lesson_sessions")
    .select("context")
    .eq("id", args.sessionId)
    .single<{ context: Record<string, unknown> | null }>()

  if (existingError) throw new Error(existingError.message)

  const updatePayload = {
    ...args.patch,
    context: mergeContext(existing.context, args.contextPatch),
  }

  const { error } = await args.adminSupabase
    .from("lesson_sessions")
    .update(updatePayload)
    .eq("id", args.sessionId)

  if (error) throw new Error(error.message)
}

export async function queueSessionAnalysis(args: {
  adminSupabase: AdminSupabase
  sessionId: string
  availableAfterSeconds?: number
  reason?: string
}) {
  const availableAfter = new Date(Date.now() + (args.availableAfterSeconds ?? 45) * 1000).toISOString()
  const { data: existing, error: existingError } = await args.adminSupabase
    .from("lesson_processing_jobs")
    .select("id, status, payload")
    .eq("session_id", args.sessionId)
    .eq("job_type", "analyze_session")
    .maybeSingle<{ id: string; status: "pending" | "processing" | "done" | "failed"; payload: Record<string, unknown> | null }>()

  if (existingError) throw new Error(existingError.message)
  if (existing?.status === "done") return

  const payload = mergeContext(existing?.payload, {
    reason: args.reason ?? "session_completed",
    queued_at: new Date().toISOString(),
  })

  if (existing) {
    const { error } = await args.adminSupabase
      .from("lesson_processing_jobs")
      .update({
        status: "pending",
        payload,
        available_after: availableAfter,
        locked_at: null,
        last_error: null,
      })
      .eq("id", existing.id)

    if (error) throw new Error(error.message)
    return
  }

  const { error } = await args.adminSupabase.from("lesson_processing_jobs").insert({
    session_id: args.sessionId,
    job_type: "analyze_session",
    status: "pending",
    payload,
    available_after: availableAfter,
  })

  if (error) throw new Error(error.message)
}

export async function completeLessonSession(args: {
  adminSupabase: AdminSupabase
  sessionId: string
  endedAt?: string
  contextPatch?: Record<string, unknown>
  queueDelaySeconds?: number
  reason?: string
}) {
  const endedAt = args.endedAt ?? new Date().toISOString()
  await updateSessionFromWebhook({
    adminSupabase: args.adminSupabase,
    sessionId: args.sessionId,
    patch: {
      ended_at: endedAt,
      status: "awaiting_artifacts",
      processing_error: null,
    },
    contextPatch: args.contextPatch,
  })

  await queueSessionAnalysis({
    adminSupabase: args.adminSupabase,
    sessionId: args.sessionId,
    availableAfterSeconds: args.queueDelaySeconds ?? 90,
    reason: args.reason ?? "session_completed",
  })
}

export async function appendLiveTranscriptSnippets(args: {
  adminSupabase: AdminSupabase
  sessionId: string
  snippets: LiveTranscriptSnippet[]
}) {
  const normalizedSnippets = args.snippets
    .map((snippet) => ({
      participantId: snippet.participantId.trim(),
      participantUserId: trimOrNull(snippet.participantUserId),
      participantName: trimOrNull(snippet.participantName),
      trackType: trimOrNull(snippet.trackType),
      text: snippet.text.trim(),
      timestamp: snippet.timestamp.trim(),
      dedupeKey: trimOrNull(snippet.dedupeKey),
    }))
    .filter((snippet) => snippet.participantId && snippet.text && snippet.timestamp)

  if (normalizedSnippets.length === 0) return

  const { data: session, error: sessionError } = await args.adminSupabase
    .from("lesson_sessions")
    .select("id, teacher_id, student_id, started_at")
    .eq("id", args.sessionId)
    .single<{ id: string; teacher_id: string | null; student_id: string | null; started_at: string | null }>()

  if (sessionError) throw new Error(sessionError.message)

  const { data: lastSequenceRow, error: sequenceError } = await args.adminSupabase
    .from("lesson_transcripts")
    .select("sequence")
    .eq("session_id", args.sessionId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle<{ sequence: number }>()

  if (sequenceError) throw new Error(sequenceError.message)

  let nextSequence = (lastSequenceRow?.sequence ?? -1) + 1
  const sessionStartMs = session.started_at ? Date.parse(session.started_at) : Number.NaN

  const rows = normalizedSnippets.map((snippet) => {
    const snippetMs = Date.parse(snippet.timestamp)
    const relativeSec =
      Number.isFinite(sessionStartMs) && Number.isFinite(snippetMs)
        ? Math.max((snippetMs - sessionStartMs) / 1000, 0)
        : null
    const speakerRole =
      snippet.participantUserId && snippet.participantUserId === session.teacher_id
        ? "teacher"
        : snippet.participantUserId && snippet.participantUserId === session.student_id
          ? "student"
          : "unknown"

    return {
      session_id: args.sessionId,
      sequence: nextSequence++,
      dedupe_key: snippet.dedupeKey ?? transcriptDedupeKey(args.sessionId, snippet),
      speaker_label: snippet.participantName ?? snippet.participantId,
      speaker_role: speakerRole,
      text: snippet.text,
      started_at_sec: relativeSec,
      ended_at_sec: relativeSec,
      source: "daily-live",
      metadata: {
        participant_id: snippet.participantId,
        participant_user_id: snippet.participantUserId,
        track_type: snippet.trackType,
        timestamp: snippet.timestamp,
      },
    }
  })

  const { error: insertError } = await args.adminSupabase
    .from("lesson_transcripts")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })

  if (insertError) throw new Error(insertError.message)

  await updateSessionFromWebhook({
    adminSupabase: args.adminSupabase,
    sessionId: args.sessionId,
    patch: {
      transcript_status: "starting",
    },
    contextPatch: {
      last_transcript_chunk_at: new Date().toISOString(),
      transcript_source: "daily-live",
    },
  })
}

export async function importStoredDailyTranscriptForSession(args: {
  adminSupabase: AdminSupabase
  sessionId: string
  transcriptId?: string | null
}): Promise<StoredTranscriptImportResult> {
  const transcriptId = trimOrNull(args.transcriptId)
  if (!transcriptId) {
    const { data: session, error: sessionError } = await args.adminSupabase
      .from("lesson_sessions")
      .select("daily_transcript_id")
      .eq("id", args.sessionId)
      .single<{ daily_transcript_id: string | null }>()

    if (sessionError) throw new Error(sessionError.message)
    if (!session.daily_transcript_id?.trim()) {
      return { status: "skipped-no-transcript-id", inserted: 0, transcriptId: null }
    }

    return importStoredDailyTranscriptForSession({
      adminSupabase: args.adminSupabase,
      sessionId: args.sessionId,
      transcriptId: session.daily_transcript_id,
    })
  }

  const { count: existingRows, error: countError } = await args.adminSupabase
    .from("lesson_transcripts")
    .select("id", { head: true, count: "exact" })
    .eq("session_id", args.sessionId)

  if (countError) throw new Error(countError.message)
  if ((existingRows ?? 0) > 0) {
    return {
      status: "skipped-existing-rows",
      inserted: 0,
      transcriptId,
    }
  }

  const { data: session, error: sessionError } = await args.adminSupabase
    .from("lesson_sessions")
    .select(
      "id, teacher_id, student_id, teacher_profile:profiles!lesson_sessions_teacher_id_fkey(first_name, last_name, full_name), student_profile:profiles!lesson_sessions_student_id_fkey(first_name, last_name, full_name)"
    )
    .eq("id", args.sessionId)
    .single<{
      id: string
      teacher_id: string | null
      student_id: string | null
      teacher_profile: SessionParticipantProfile | null
      student_profile: SessionParticipantProfile | null
    }>()

  if (sessionError) throw new Error(sessionError.message)

  const transcriptLink = await getDailyTranscriptAccessLink(transcriptId)
  if (!transcriptLink) {
    return { status: "skipped-no-vtt", inserted: 0, transcriptId }
  }

  const response = await fetch(transcriptLink, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Daily transcript download failed (${response.status})`)
  }

  const vttContent = await response.text()
  const parsedSegments = parseDailyTranscriptVtt(vttContent)
  if (parsedSegments.length === 0) {
    return { status: "skipped-empty-vtt", inserted: 0, transcriptId }
  }

  const teacherNames = candidateDisplayNames(session.teacher_profile)
  const studentNames = candidateDisplayNames(session.student_profile)

  const rows = parsedSegments.map((segment, index) => ({
    session_id: args.sessionId,
    sequence: index,
    dedupe_key: storedTranscriptDedupeKey({
      sessionId: args.sessionId,
      transcriptId,
      cueIndex: segment.cueIndex,
      speakerLabel: segment.speakerLabel,
      text: segment.text,
      startedAtSec: segment.startedAtSec,
      endedAtSec: segment.endedAtSec,
    }),
    speaker_label: segment.speakerLabel,
    speaker_role: detectStoredTranscriptSpeakerRole({
      speakerLabel: segment.speakerLabel,
      teacherNames,
      studentNames,
    }),
    text: segment.text,
    started_at_sec: segment.startedAtSec,
    ended_at_sec: segment.endedAtSec,
    source: "daily-webvtt",
    metadata: {
      cue_index: segment.cueIndex,
      transcript_id: transcriptId,
      imported_from: "daily-stored-transcript",
    },
  }))

  const { error: insertError } = await args.adminSupabase
    .from("lesson_transcripts")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })

  if (insertError) throw new Error(insertError.message)

  await updateSessionFromWebhook({
    adminSupabase: args.adminSupabase,
    sessionId: args.sessionId,
    patch: {
      transcript_status: "ready",
    },
    contextPatch: {
      last_transcript_import_at: new Date().toISOString(),
      transcript_source: "daily-webvtt",
      stored_transcript_imported_rows: rows.length,
      stored_transcript_id: transcriptId,
    },
  })

  return {
    status: "imported",
    inserted: rows.length,
    transcriptId,
  }
}
