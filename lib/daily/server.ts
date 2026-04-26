const DAILY_API_BASE = "https://api.daily.co/v1"
const DEFAULT_DAILY_TOKEN_TTL_SECONDS = 60 * 60 * 4

type DailyRoomResponse = {
  name?: string
  url?: string
}

type DailyTokenResponse = {
  token?: string
}

type DailyTranscriptResponse = {
  id?: string
  status?: string
  isVttAvailable?: boolean
}

type DailyTranscriptAccessLinkResponse = {
  link?: string
}

class DailyApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "DailyApiError"
    this.status = status
    this.payload = payload
  }
}

function getDailyApiKey(): string | undefined {
  return process.env.DAILY_API_KEY?.trim() || undefined
}

function getDailyTokenTtlSeconds(): number {
  const raw = Number(process.env.DAILY_TOKEN_TTL_SECONDS ?? DEFAULT_DAILY_TOKEN_TTL_SECONDS)
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return DEFAULT_DAILY_TOKEN_TTL_SECONDS
}

function extractDailyErrorMessage(payload: unknown): string | undefined {
  if (!payload) return undefined
  if (typeof payload === "string") return payload.trim() || undefined
  if (typeof payload !== "object") return undefined

  const record = payload as Record<string, unknown>
  const message =
    record.error ??
    record.message ??
    record.info ??
    record.reason ??
    record.details

  return typeof message === "string" && message.trim() ? message.trim() : undefined
}

async function dailyApiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = getDailyApiKey()
  if (!apiKey) {
    throw new Error("DAILY_API_KEY is not configured")
  }

  const response = await fetch(`${DAILY_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null)

  if (!response.ok) {
    throw new DailyApiError(
      extractDailyErrorMessage(payload) ?? `Daily API request failed (${response.status})`,
      response.status,
      payload
    )
  }

  return payload as T
}

export function isDailyConfigured(): boolean {
  return Boolean(getDailyApiKey())
}

export function shouldEnforceTeacherStart(): boolean {
  const raw = process.env.DAILY_ENFORCE_TEACHER_START?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

function createDailyScopedRoomName(scope: "lesson" | "schedule" | "private", id: string): string {
  const normalized = id
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return `${scope}-${normalized}`.slice(0, 128)
}

export function createDailyLessonRoomName(lessonId: string): string {
  return createDailyScopedRoomName("lesson", lessonId)
}

export function createDailyScheduleSlotRoomName(scheduleSlotId: string): string {
  return createDailyScopedRoomName("schedule", scheduleSlotId)
}

export function createDailyPrivateRoomName(teacherId: string, studentId: string): string {
  const pair = [teacherId.trim(), studentId.trim()].filter(Boolean).join("-")
  return createDailyScopedRoomName("private", pair)
}

export function getDailyRoomNameFromUrl(roomUrl: string | null | undefined): string | null {
  const value = roomUrl?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    const roomName = url.pathname.replace(/^\/+/, "").split("/")[0]?.trim()
    return roomName || null
  } catch {
    return null
  }
}

export async function getDailyRoomByName(roomName: string): Promise<{ name: string; url: string } | null> {
  try {
    const room = await dailyApiRequest<DailyRoomResponse>(`/rooms/${encodeURIComponent(roomName)}`, {
      method: "GET"
    })

    if (!room.url) return null
    return {
      name: room.name?.trim() || roomName,
      url: room.url
    }
  } catch (error) {
    if (error instanceof DailyApiError && error.status === 404) return null
    throw error
  }
}

export async function createOrGetDailyLessonRoom(lessonId: string): Promise<{ name: string; url: string }> {
  return createOrGetDailyRoomByName(createDailyLessonRoomName(lessonId))
}

export async function createOrGetDailyScheduleSlotRoom(scheduleSlotId: string): Promise<{ name: string; url: string }> {
  return createOrGetDailyRoomByName(createDailyScheduleSlotRoomName(scheduleSlotId))
}

export async function createOrGetDailyPrivateRoom(
  teacherId: string,
  studentId: string
): Promise<{ name: string; url: string }> {
  return createOrGetDailyRoomByName(createDailyPrivateRoomName(teacherId, studentId))
}

async function createOrGetDailyRoomByName(roomName: string): Promise<{ name: string; url: string }> {
  try {
    const room = await dailyApiRequest<DailyRoomResponse>("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          enable_transcription_storage: true,
          start_video_off: false,
          start_audio_off: false
        }
      })
    })

    if (!room.url) {
      throw new Error("Daily room was created without a URL")
    }

    return {
      name: room.name?.trim() || roomName,
      url: room.url
    }
  } catch (error) {
    const existingRoom = await getDailyRoomByName(roomName)
    if (existingRoom) return existingRoom
    throw error
  }
}

export async function createDailyLessonMeetingToken({
  roomName,
  userId,
  userName,
  isOwner
}: {
  roomName: string
  userId: string
  userName: string
  isOwner: boolean
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const token = await dailyApiRequest<DailyTokenResponse>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId.slice(0, 36),
        user_name: userName,
        is_owner: isOwner,
        exp: now + getDailyTokenTtlSeconds(),
        enable_screenshare: true,
        auto_start_transcription: isOwner,
        auto_transcription_settings: isOwner
          ? {
              language: "zh"
            }
          : undefined,
        start_video_off: false,
        start_audio_off: false
      }
    })
  })

  if (!token.token) {
    throw new Error("Daily did not return a meeting token")
  }

  return token.token
}

export async function getDailyTranscriptById(transcriptId: string): Promise<DailyTranscriptResponse> {
  return dailyApiRequest<DailyTranscriptResponse>(`/transcript/${encodeURIComponent(transcriptId)}`, {
    method: "GET",
  })
}

export async function getDailyTranscriptAccessLink(transcriptId: string): Promise<string> {
  const transcript = await getDailyTranscriptById(transcriptId)
  if (!transcript.isVttAvailable) {
    throw new Error("Daily transcript VTT is not available yet")
  }

  const accessLink = await dailyApiRequest<DailyTranscriptAccessLinkResponse>(
    `/transcript/${encodeURIComponent(transcriptId)}/access-link`,
    {
      method: "GET",
    }
  )

  const link = accessLink.link?.trim()
  if (!link) {
    throw new Error("Daily did not return a transcript access link")
  }

  return link
}

function countPresenceEntries(payload: unknown): number {
  if (!payload) return 0
  if (Array.isArray(payload)) return payload.length
  if (typeof payload !== "object") return 0

  const record = payload as Record<string, unknown>
  if (typeof record.total_count === "number") return record.total_count
  if (Array.isArray(record.data)) return record.data.length
  if (Array.isArray(record.participants)) return record.participants.length
  if (record.present === true) return 1
  if (typeof record.user_id === "string" && record.user_id.trim()) return 1
  return 0
}

export async function isDailyUserPresentInRoom(roomName: string, userId: string): Promise<boolean> {
  try {
    const search = new URLSearchParams({ userId }).toString()
    const payload = await dailyApiRequest<unknown>(
      `/rooms/${encodeURIComponent(roomName)}/presence?${search}`,
      {
        method: "GET"
      }
    )

    return countPresenceEntries(payload) > 0
  } catch (error) {
    if (error instanceof DailyApiError && error.status === 404) return false
    throw error
  }
}
