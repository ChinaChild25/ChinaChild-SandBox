import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { importStoredDailyTranscriptForSession } from "@/lib/live-lessons/server"

type AdminSupabase = ReturnType<typeof createAdminSupabaseClient>
type ProfileRole = "student" | "teacher" | "curator"
export type UiAccentKey = "sage" | "pink" | "blue" | "orange"

type TranscriptRow = {
  id: string
  sequence: number
  speaker_label: string | null
  speaker_role: "teacher" | "student" | "unknown" | "system"
  text: string
  started_at_sec: number | null
  ended_at_sec: number | null
}

type SessionRow = {
  id: string
  lesson_id: string | null
  student_id: string | null
  teacher_id: string | null
  daily_transcript_id: string | null
  status: "active" | "awaiting_artifacts" | "processing" | "done" | "failed"
  transcript_status: "not_started" | "starting" | "ready" | "error"
  started_at: string | null
  ended_at: string | null
  context: Record<string, unknown> | null
  lessons: { title: string | null } | null
  student_profile: { full_name: string | null } | null
  teacher_profile: { full_name: string | null } | null
}

type ProcessingJobRow = {
  id: string
  session_id: string
  attempts: number
  payload: Record<string, unknown> | null
}

type AnalyticsRow = {
  session_id: string
  summary: string | null
  grammar_score: number | null
  vocabulary_score: number | null
  fluency_score: number | null
  speaking_ratio: number | null
  mistakes: unknown
  strengths: unknown
  recommendations: unknown
  topics_practiced: unknown
  raw_analysis: unknown
  created_at: string
}

type LessonAnalyticsOutput = {
  summary: string
  grammar_score: number
  vocabulary_score: number
  fluency_score: number
  speaking_ratio: number
  mistakes: Array<{
    type: "grammar" | "vocabulary" | "pronunciation" | "tones"
    original: string
    correction: string
    explanation: string
    hsk_level: number
  }>
  strengths: string[]
  recommendations: string[]
  topics_practiced: string[]
}

export const SKILL_AXES = {
  speaking: ["speaking", "pronunciation", "tones", "fluency"],
  phrases: ["phrases", "chengyu", "expressions", "patterns"],
  vocabulary: ["vocabulary", "words", "characters", "hanzi"],
  listening: ["listening", "comprehension"],
  grammar: ["grammar", "particles", "measure_words", "ba_sentence"],
  reading: ["reading", "pinyin"],
} as const

export type SkillAxisKey = keyof typeof SKILL_AXES

export type SkillMap = Record<SkillAxisKey, number>

export type LessonTranscriptSegment = {
  sequence: number
  speakerRole: TranscriptRow["speaker_role"]
  speakerLabel: string | null
  text: string
  startedAtSec: number | null
  endedAtSec: number | null
}

export type LessonFeedItem = {
  sessionId: string
  lessonId: string | null
  title: string
  studentName: string | null
  teacherName: string | null
  studentAvatarUrl: string | null
  teacherAvatarUrl: string | null
  startedAt: string | null
  endedAt: string | null
  status: SessionRow["status"]
  summary: string | null
  grammarScore: number | null
  vocabularyScore: number | null
  fluencyScore: number | null
  speakingRatio: number | null
  averageScore: number | null
  mistakes: LessonAnalyticsOutput["mistakes"]
  strengths: string[]
  recommendations: string[]
  topicsPracticed: string[]
  transcript: LessonTranscriptSegment[]
}

export type StudentProgressOverview = {
  studentId: string
  studentName: string | null
  studentAvatarUrl: string | null
  studentAccent: UiAccentKey | null
  skillMap: SkillMap
  previousSkillMap: SkillMap | null
  sessions: LessonFeedItem[]
}

export type LatestLessonReport = {
  sessionId: string
  status: SessionRow["status"]
  startedAt: string | null
  endedAt: string | null
  summary: string | null
  grammarScore: number | null
  vocabularyScore: number | null
  fluencyScore: number | null
  speakingRatio: number | null
  mistakes: LessonAnalyticsOutput["mistakes"]
  strengths: string[]
  recommendations: string[]
  topicsPracticed: string[]
  transcriptPreview: Array<{
    speakerRole: TranscriptRow["speaker_role"]
    speakerLabel: string | null
    text: string
  }>
}

type StudentMasteryRow = {
  topic: string
  confidence: number | null
  lessons_seen: number | null
  mistake_count: number | null
  last_practiced_at: string | null
}

type ProgressSessionRow = {
  id: string
  lesson_id: string | null
  student_id: string | null
  teacher_id: string | null
  started_at: string | null
  ended_at: string | null
  status: SessionRow["status"]
  context: Record<string, unknown> | null
  lessons: Array<{ title: string | null }> | null
  student_profile:
    | { full_name: string | null; avatar_url: string | null }
    | Array<{ full_name: string | null; avatar_url: string | null }>
    | null
  teacher_profile:
    | { full_name: string | null; avatar_url: string | null }
    | Array<{ full_name: string | null; avatar_url: string | null }>
    | null
}

type ProgressTranscriptRow = {
  session_id: string
  sequence: number
  speaker_label: string | null
  speaker_role: TranscriptRow["speaker_role"]
  text: string
  started_at_sec: number | null
  ended_at_sec: number | null
}

const ANALYTICS_MODEL = process.env.LESSON_ANALYTICS_OPENAI_MODEL?.trim() || "gpt-4o-mini"
const MAX_TRANSCRIPT_CHARS = 80_000
const MAX_JOB_RETRIES = 3

export function isLessonAnalyticsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

const LESSON_ANALYTICS_SCHEMA = {
  name: "lesson_analytics_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      grammar_score: { type: "integer", minimum: 0, maximum: 100 },
      vocabulary_score: { type: "integer", minimum: 0, maximum: 100 },
      fluency_score: { type: "integer", minimum: 0, maximum: 100 },
      speaking_ratio: { type: "number", minimum: 0, maximum: 1 },
      mistakes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: ["grammar", "vocabulary", "pronunciation", "tones"],
            },
            original: { type: "string" },
            correction: { type: "string" },
            explanation: { type: "string" },
            hsk_level: { type: "integer", minimum: 1, maximum: 6 },
          },
          required: ["type", "original", "correction", "explanation", "hsk_level"],
        },
      },
      strengths: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      topics_practiced: { type: "array", items: { type: "string" } },
    },
    required: [
      "summary",
      "grammar_score",
      "vocabulary_score",
      "fluency_score",
      "speaking_ratio",
      "mistakes",
      "strengths",
      "recommendations",
      "topics_practiced",
    ],
  },
} as const

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalizeAvatarUrl(adminSupabase: AdminSupabase, raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value

  const normalizedPath = value.replace(/^avatars\//, "")
  const { data } = adminSupabase.storage.from("avatars").getPublicUrl(normalizedPath)
  return data.publicUrl || null
}

function fallbackTeacherAvatarByName(name: string | null | undefined): string | null {
  const normalized = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  if (!normalized) return null
  if (normalized === "чжао ли" || normalized === "zhao li") return "/staff/zhao-li.png"
  if (normalized === "денис гасенко" || normalized === "denis gasenko") return "/staff/denis-gasenko-curator.png"
  return null
}

function contextDisplayName(
  context: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!context) return null

  for (const key of keys) {
    const value = context[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return null
}

function transcriptDisplayName(
  transcript: LessonTranscriptSegment[],
  role: LessonTranscriptSegment["speakerRole"]
): string | null {
  for (const segment of transcript) {
    if (segment.speakerRole !== role) continue
    const label = segment.speakerLabel?.trim()
    if (label) return label
  }

  return null
}

function resolveEmbeddedProfile(
  value:
    | { full_name: string | null; avatar_url?: string | null }
    | Array<{ full_name: string | null; avatar_url?: string | null }>
    | null
    | undefined
): { full_name: string | null; avatar_url?: string | null } | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
}

function asMistakes(value: unknown): LessonAnalyticsOutput["mistakes"] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      const type = typeof record.type === "string" ? record.type : ""
      const original = typeof record.original === "string" ? record.original.trim() : ""
      const correction = typeof record.correction === "string" ? record.correction.trim() : ""
      const explanation = typeof record.explanation === "string" ? record.explanation.trim() : ""
      const hskLevel = Number(record.hsk_level)
      if (!original || !correction || !explanation) return null
      if (!["grammar", "vocabulary", "pronunciation", "tones"].includes(type)) return null
      return {
        type: type as LessonAnalyticsOutput["mistakes"][number]["type"],
        original,
        correction,
        explanation,
        hsk_level: clampInt(hskLevel, 1, 6),
      }
    })
    .filter((entry): entry is LessonAnalyticsOutput["mistakes"][number] => Boolean(entry))
}

function normalizeAnalyticsOutput(value: unknown): LessonAnalyticsOutput {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {}

  return {
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    grammar_score: clampInt(Number(record.grammar_score), 0, 100),
    vocabulary_score: clampInt(Number(record.vocabulary_score), 0, 100),
    fluency_score: clampInt(Number(record.fluency_score), 0, 100),
    speaking_ratio: clampRatio(Number(record.speaking_ratio)),
    mistakes: asMistakes(record.mistakes),
    strengths: asStringArray(record.strengths).slice(0, 8),
    recommendations: asStringArray(record.recommendations).slice(0, 8),
    topics_practiced: asStringArray(record.topics_practiced).slice(0, 24),
  }
}

function createEmptySkillMap(): SkillMap {
  return {
    speaking: 0,
    phrases: 0,
    vocabulary: 0,
    listening: 0,
    grammar: 0,
    reading: 0,
  }
}

function hasSkillMapData(skillMap: SkillMap): boolean {
  return Object.values(skillMap).some((value) => value > 0)
}

function normalizeTopicKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

function resolveSkillAxesForTopic(topic: string): SkillAxisKey[] {
  const normalizedTopic = normalizeTopicKey(topic)
  if (!normalizedTopic) return []

  return (Object.entries(SKILL_AXES) as Array<[SkillAxisKey, readonly string[]]>)
    .filter(([axis, aliases]) =>
      [axis, ...aliases].some((alias) => {
        const normalizedAlias = normalizeTopicKey(alias)
        return (
          normalizedTopic === normalizedAlias ||
          normalizedTopic.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedTopic)
        )
      })
    )
    .map(([axis]) => axis)
}

function buildSkillMapFromAnalyticsSnapshot(args: {
  grammarScore: number | null
  vocabularyScore: number | null
  fluencyScore: number | null
  speakingRatio: number | null
  topicsPracticed: string[]
}): SkillMap {
  const grammar = clampInt(Number(args.grammarScore), 0, 100)
  const vocabulary = clampInt(Number(args.vocabularyScore), 0, 100)
  const fluency = clampInt(Number(args.fluencyScore), 0, 100)
  const speakingRatioScore = clampInt(clampRatio(Number(args.speakingRatio)) * 100, 0, 100)
  const overall = clampInt((grammar + vocabulary + fluency) / 3, 0, 100)
  const baseline = overall > 0 ? clampInt(overall * 0.45, 12, 100) : 0

  const skillMap: SkillMap = {
    speaking: Math.max(baseline, clampInt(fluency * 0.7 + speakingRatioScore * 0.3, 0, 100)),
    phrases: baseline,
    vocabulary: Math.max(baseline, vocabulary),
    listening: Math.max(baseline, clampInt(overall * 0.7 + speakingRatioScore * 0.3, 0, 100)),
    grammar: Math.max(baseline, grammar),
    reading: Math.max(baseline, clampInt((grammar + vocabulary) / 2, 0, 100)),
  }

  for (const topic of args.topicsPracticed) {
    for (const axis of resolveSkillAxesForTopic(topic)) {
      const emphasizedScore =
        axis === "speaking"
          ? clampInt((skillMap.speaking + fluency + overall) / 3, 0, 100)
          : axis === "grammar"
            ? Math.max(grammar, overall)
            : axis === "vocabulary"
              ? Math.max(vocabulary, overall)
              : axis === "listening"
                ? clampInt((skillMap.listening + overall) / 2, 0, 100)
                : axis === "reading"
                  ? clampInt((skillMap.reading + vocabulary) / 2, 0, 100)
                  : clampInt((vocabulary + overall) / 2, 0, 100)

      skillMap[axis] = Math.max(skillMap[axis], emphasizedScore)
    }
  }

  return skillMap
}

function hasAnalyticsPayload(lesson: LessonFeedItem): boolean {
  return (
    Boolean(lesson.summary?.trim()) ||
    lesson.mistakes.length > 0 ||
    lesson.strengths.length > 0 ||
    lesson.recommendations.length > 0 ||
    lesson.topicsPracticed.length > 0 ||
    lesson.grammarScore !== null ||
    lesson.vocabularyScore !== null ||
    lesson.fluencyScore !== null
  )
}

function resolveSessionTitle(session: ProgressSessionRow): string {
  const lessonTitle = session.lessons?.[0]?.title?.trim()
  if (lessonTitle) return lessonTitle

  const contextTitle =
    typeof session.context?.lesson_title === "string"
      ? session.context.lesson_title.trim()
      : typeof session.context?.lessonTitle === "string"
        ? session.context.lessonTitle.trim()
        : ""

  return contextTitle || "Онлайн-занятие"
}

function trimTranscriptForPrompt(transcripts: TranscriptRow[]): string {
  const lines = transcripts.map((segment) => {
    const ts = Number.isFinite(segment.started_at_sec ?? Number.NaN)
      ? `[${(segment.started_at_sec ?? 0).toFixed(1)}s] `
      : ""
    const label = segment.speaker_role === "system" ? "system" : segment.speaker_role
    return `${ts}${label}: ${segment.text.trim()}`
  })

  let transcript = lines.join("\n")
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript

  transcript = transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS)
  const firstBreak = transcript.indexOf("\n")
  return firstBreak >= 0 ? transcript.slice(firstBreak + 1) : transcript
}

async function runOpenAiLessonAnalysis(args: {
  lessonTitle: string
  studentName: string | null
  teacherName: string | null
  transcript: string
}): Promise<LessonAnalyticsOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const userPrompt = [
    `Lesson title: ${args.lessonTitle || "Untitled lesson"}`,
    `Student name: ${args.studentName || "Unknown"}`,
    `Teacher name: ${args.teacherName || "Unknown"}`,
    "",
    "Analyze the transcript below.",
    "Focus primarily on the student's Mandarin Chinese output.",
    "Teacher lines give context and should only be used to interpret the student's mistakes and strengths.",
    "",
    args.transcript,
  ].join("\n")

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANALYTICS_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: LESSON_ANALYTICS_SCHEMA,
      },
      messages: [
        {
          role: "system",
          content:
            "You are an expert Mandarin Chinese teacher. Return only JSON that matches the provided schema. Be concise, accurate, and practical. Score the student's performance based on this single lesson only."
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string }
        choices?: Array<{
          message?: {
            content?: string | null
            refusal?: string | null
          }
        }>
      }
    | null

  if (!response.ok) {
    throw new Error(payload?.error?.message?.trim() || `OpenAI request failed (${response.status})`)
  }

  const message = payload?.choices?.[0]?.message
  if (message?.refusal?.trim()) {
    throw new Error(message.refusal.trim())
  }

  const content = message?.content?.trim()
  if (!content) {
    throw new Error("OpenAI returned an empty analytics payload")
  }

  return normalizeAnalyticsOutput(JSON.parse(content))
}

async function claimPendingJobs(adminSupabase: AdminSupabase, limit: number): Promise<ProcessingJobRow[]> {
  const now = new Date().toISOString()
  const { data: jobs, error } = await adminSupabase
    .from("lesson_processing_jobs")
    .select("id, session_id, attempts, payload")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_JOB_RETRIES)
    .lte("available_after", now)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const claimed: ProcessingJobRow[] = []
  for (const job of (jobs ?? []) as ProcessingJobRow[]) {
    const { data: updated, error: updateError } = await adminSupabase
      .from("lesson_processing_jobs")
      .update({
        status: "processing",
        locked_at: new Date().toISOString(),
        attempts: job.attempts + 1,
        last_error: null,
      })
      .eq("id", job.id)
      .in("status", ["pending", "failed"])
      .select("id, session_id, attempts, payload")
      .maybeSingle<ProcessingJobRow>()

    if (updateError) throw new Error(updateError.message)
    if (updated) claimed.push(updated)
  }

  return claimed
}

async function loadSessionForProcessing(
  adminSupabase: AdminSupabase,
  sessionId: string
): Promise<{ session: SessionRow; transcripts: TranscriptRow[] }> {
  const { data: session, error: sessionError } = await adminSupabase
    .from("lesson_sessions")
    .select(
      "id, lesson_id, student_id, teacher_id, daily_transcript_id, status, transcript_status, started_at, ended_at, context, lessons(title), student_profile:profiles!lesson_sessions_student_id_fkey(full_name), teacher_profile:profiles!lesson_sessions_teacher_id_fkey(full_name)"
    )
    .eq("id", sessionId)
    .single<SessionRow>()

  if (sessionError) throw new Error(sessionError.message)

  const { data: transcripts, error: transcriptsError } = await adminSupabase
    .from("lesson_transcripts")
    .select("id, sequence, speaker_label, speaker_role, text, started_at_sec, ended_at_sec")
    .eq("session_id", sessionId)
    .order("sequence", { ascending: true })

  if (transcriptsError) throw new Error(transcriptsError.message)

  return {
    session,
    transcripts: (transcripts ?? []) as TranscriptRow[],
  }
}

async function upsertStudentMastery(args: {
  adminSupabase: AdminSupabase
  studentId: string
  topics: string[]
  mistakesCount: number
  averageScore: number
  practicedAt: string | null
}) {
  for (const topic of args.topics) {
    const trimmedTopic = topic.trim()
    if (!trimmedTopic) continue

    const { data: existing, error: existingError } = await args.adminSupabase
      .from("student_mastery")
      .select("confidence, lessons_seen, mistake_count")
      .eq("student_id", args.studentId)
      .eq("topic", trimmedTopic)
      .maybeSingle<{ confidence: number; lessons_seen: number; mistake_count: number }>()

    if (existingError) throw new Error(existingError.message)

    const baseConfidence = existing?.confidence ?? 0.35
    const nextConfidence = Math.max(
      0.1,
      Math.min(0.98, baseConfidence * 0.7 + (args.averageScore / 100) * 0.3)
    )

    const { error } = await args.adminSupabase.from("student_mastery").upsert(
      {
        student_id: args.studentId,
        topic: trimmedTopic,
        confidence: nextConfidence,
        lessons_seen: (existing?.lessons_seen ?? 0) + 1,
        mistake_count: (existing?.mistake_count ?? 0) + args.mistakesCount,
        last_practiced_at: args.practicedAt,
        metadata: {
          updated_by: "lesson_analytics",
          average_score: args.averageScore,
        },
      },
      { onConflict: "student_id,topic" }
    )

    if (error) throw new Error(error.message)
  }
}

async function markJobDone(adminSupabase: AdminSupabase, jobId: string) {
  const { error } = await adminSupabase
    .from("lesson_processing_jobs")
    .update({
      status: "done",
      locked_at: null,
      last_error: null,
    })
    .eq("id", jobId)

  if (error) throw new Error(error.message)
}

async function markJobFailure(args: {
  adminSupabase: AdminSupabase
  job: ProcessingJobRow
  errorMessage: string
  sessionId: string
}) {
  const shouldRetry = args.job.attempts < MAX_JOB_RETRIES
  const nextDelaySeconds = Math.min(90 * Math.max(args.job.attempts, 1), 15 * 60)
  const { error } = await args.adminSupabase
    .from("lesson_processing_jobs")
    .update({
      status: shouldRetry ? "failed" : "failed",
      locked_at: null,
      last_error: args.errorMessage,
      available_after: shouldRetry ? new Date(Date.now() + nextDelaySeconds * 1000).toISOString() : new Date().toISOString(),
    })
    .eq("id", args.job.id)

  if (error) throw new Error(error.message)

  if (!shouldRetry) {
    const { error: sessionError } = await args.adminSupabase
      .from("lesson_sessions")
      .update({
        status: "failed",
        processing_error: args.errorMessage,
      })
      .eq("id", args.sessionId)

    if (sessionError) throw new Error(sessionError.message)
  }
}

async function processSingleJob(adminSupabase: AdminSupabase, job: ProcessingJobRow) {
  let { session, transcripts } = await loadSessionForProcessing(adminSupabase, job.session_id)
  const { error: markProcessingError } = await adminSupabase
    .from("lesson_sessions")
    .update({
      status: "processing",
      processing_error: null,
    })
    .eq("id", session.id)

  if (markProcessingError) throw new Error(markProcessingError.message)

  if (transcripts.length === 0 && session.daily_transcript_id?.trim()) {
    await importStoredDailyTranscriptForSession({
      adminSupabase,
      sessionId: session.id,
      transcriptId: session.daily_transcript_id,
    })
    const reloaded = await loadSessionForProcessing(adminSupabase, job.session_id)
    session = reloaded.session
    transcripts = reloaded.transcripts
  }

  const transcriptText = trimTranscriptForPrompt(
    transcripts.filter((segment) => segment.text.trim() && segment.speaker_role !== "system")
  )

  if (!transcriptText.trim()) {
    throw new Error("No transcript segments are available for analysis yet.")
  }

  const analysis = await runOpenAiLessonAnalysis({
    lessonTitle: session.lessons?.title?.trim() || "Урок",
    studentName: session.student_profile?.full_name?.trim() || null,
    teacherName: session.teacher_profile?.full_name?.trim() || null,
    transcript: transcriptText,
  })

  const averageScore =
    Math.round((analysis.grammar_score + analysis.vocabulary_score + analysis.fluency_score) / 3)

  const { error: analyticsError } = await adminSupabase.from("lesson_analytics").upsert(
    {
      session_id: session.id,
      student_id: session.student_id,
      summary: analysis.summary,
      grammar_score: analysis.grammar_score,
      vocabulary_score: analysis.vocabulary_score,
      fluency_score: analysis.fluency_score,
      speaking_ratio: analysis.speaking_ratio,
      mistakes: analysis.mistakes,
      strengths: analysis.strengths,
      recommendations: analysis.recommendations,
      topics_practiced: analysis.topics_practiced,
      raw_analysis: analysis,
    },
    { onConflict: "session_id" }
  )

  if (analyticsError) throw new Error(analyticsError.message)

  if (session.student_id && analysis.topics_practiced.length > 0) {
    await upsertStudentMastery({
      adminSupabase,
      studentId: session.student_id,
      topics: analysis.topics_practiced,
      mistakesCount: analysis.mistakes.length,
      averageScore,
      practicedAt: session.ended_at ?? session.started_at,
    })
  }

  const { error: sessionError } = await adminSupabase
    .from("lesson_sessions")
    .update({
      status: "done",
      transcript_status: transcripts.length > 0 ? "ready" : session.transcript_status,
      processing_error: null,
    })
    .eq("id", session.id)

  if (sessionError) throw new Error(sessionError.message)
}

export async function processPendingLessonAnalyticsJobs(args: {
  adminSupabase: AdminSupabase
  limit?: number
}) {
  const jobs = await claimPendingJobs(args.adminSupabase, args.limit ?? 3)
  const summary = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const job of jobs) {
    try {
      await processSingleJob(args.adminSupabase, job)
      await markJobDone(args.adminSupabase, job.id)
      summary.completed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown analytics job error"
      await markJobFailure({
        adminSupabase: args.adminSupabase,
        job,
        errorMessage: message,
        sessionId: job.session_id,
      })
      summary.failed += 1
      summary.errors.push(`${job.session_id}: ${message}`)
    }
  }

  return summary
}

export async function processPendingLessonAnalyticsJobsIfConfigured(args: {
  adminSupabase: AdminSupabase
  limit?: number
}) {
  if (!isLessonAnalyticsConfigured()) {
    return {
      configured: false,
      claimed: 0,
      completed: 0,
      failed: 0,
      errors: [] as string[],
    }
  }

  const summary = await processPendingLessonAnalyticsJobs(args)
  return {
    configured: true,
    ...summary,
  }
}

export async function getLatestLessonReportForViewer(args: {
  adminSupabase: AdminSupabase
  lessonId: string
  viewerId: string
  viewerRole: ProfileRole
}): Promise<LatestLessonReport | null> {
  let query = args.adminSupabase
    .from("lesson_sessions")
    .select("id, status, started_at, ended_at")
    .eq("lesson_id", args.lessonId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (args.viewerRole === "student") {
    query = query.eq("student_id", args.viewerId)
  }

  const { data: session, error: sessionError } = await query.maybeSingle<{
    id: string
    status: SessionRow["status"]
    started_at: string | null
    ended_at: string | null
  }>()

  if (sessionError) throw new Error(sessionError.message)
  if (!session) return null

  const { data: analytics, error: analyticsError } = await args.adminSupabase
    .from("lesson_analytics")
    .select(
      "session_id, summary, grammar_score, vocabulary_score, fluency_score, speaking_ratio, mistakes, strengths, recommendations, topics_practiced, raw_analysis, created_at"
    )
    .eq("session_id", session.id)
    .maybeSingle<AnalyticsRow>()

  if (analyticsError) throw new Error(analyticsError.message)

  const { data: transcriptPreviewRows, error: previewError } = await args.adminSupabase
    .from("lesson_transcripts")
    .select("speaker_role, speaker_label, text")
    .eq("session_id", session.id)
    .order("sequence", { ascending: false })
    .limit(8)

  if (previewError) throw new Error(previewError.message)

  const transcriptPreview = [...(transcriptPreviewRows ?? [])]
    .reverse()
    .map((row) => ({
      speakerRole: row.speaker_role as TranscriptRow["speaker_role"],
      speakerLabel: row.speaker_label as string | null,
      text: row.text as string,
    }))

  return {
    sessionId: session.id,
    status: session.status,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    summary: analytics?.summary ?? null,
    grammarScore: analytics?.grammar_score ?? null,
    vocabularyScore: analytics?.vocabulary_score ?? null,
    fluencyScore: analytics?.fluency_score ?? null,
    speakingRatio: analytics?.speaking_ratio ?? null,
    mistakes: asMistakes(analytics?.mistakes).slice(0, 6),
    strengths: asStringArray(analytics?.strengths).slice(0, 6),
    recommendations: asStringArray(analytics?.recommendations).slice(0, 6),
    topicsPracticed: asStringArray(analytics?.topics_practiced).slice(0, 10),
    transcriptPreview,
  }
}

export async function getStudentSkillMap(
  adminSupabase: AdminSupabase,
  studentId: string
): Promise<SkillMap> {
  const { data, error } = await adminSupabase
    .from("student_mastery")
    .select("topic, confidence, lessons_seen, mistake_count, last_practiced_at")
    .eq("student_id", studentId)

  if (error) throw new Error(error.message)

  const totals = createEmptySkillMap()
  const counts: Record<SkillAxisKey, number> = {
    speaking: 0,
    phrases: 0,
    vocabulary: 0,
    listening: 0,
    grammar: 0,
    reading: 0,
  }

  for (const row of (data ?? []) as StudentMasteryRow[]) {
    const confidenceScore = clampInt(clampRatio(Number(row.confidence)) * 100, 0, 100)
    for (const axis of resolveSkillAxesForTopic(row.topic)) {
      totals[axis] += confidenceScore
      counts[axis] += 1
    }
  }

  return {
    speaking: counts.speaking > 0 ? clampInt(totals.speaking / counts.speaking, 0, 100) : 0,
    phrases: counts.phrases > 0 ? clampInt(totals.phrases / counts.phrases, 0, 100) : 0,
    vocabulary: counts.vocabulary > 0 ? clampInt(totals.vocabulary / counts.vocabulary, 0, 100) : 0,
    listening: counts.listening > 0 ? clampInt(totals.listening / counts.listening, 0, 100) : 0,
    grammar: counts.grammar > 0 ? clampInt(totals.grammar / counts.grammar, 0, 100) : 0,
    reading: counts.reading > 0 ? clampInt(totals.reading / counts.reading, 0, 100) : 0,
  }
}

export async function getStudentProgressOverview(args: {
  adminSupabase: AdminSupabase
  studentId: string
  limit?: number
}): Promise<StudentProgressOverview> {
  const limit = Math.max(1, Math.min(args.limit ?? 10, 20))

  const [{ data: profile, error: profileError }, skillMap, { data: sessionsData, error: sessionsError }] =
    await Promise.all([
      args.adminSupabase
        .from("profiles")
        .select("id, full_name, avatar_url, ui_accent")
        .eq("id", args.studentId)
        .maybeSingle<{ id: string; full_name: string | null; avatar_url: string | null; ui_accent: UiAccentKey | null }>(),
      getStudentSkillMap(args.adminSupabase, args.studentId),
      args.adminSupabase
        .from("lesson_sessions")
        .select(
          "id, lesson_id, student_id, teacher_id, started_at, ended_at, status, context, lessons(title), student_profile:profiles!lesson_sessions_student_id_fkey(full_name, avatar_url), teacher_profile:profiles!lesson_sessions_teacher_id_fkey(full_name, avatar_url)"
        )
        .eq("student_id", args.studentId)
        .order("ended_at", { ascending: false, nullsFirst: false })
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit),
    ])

  if (profileError) throw new Error(profileError.message)
  if (sessionsError) throw new Error(sessionsError.message)

  const sessionRows = (sessionsData ?? []) as ProgressSessionRow[]
  const sessionIds = sessionRows.map((session) => session.id)

  if (sessionIds.length === 0) {
    return {
      studentId: args.studentId,
      studentName: profile?.full_name?.trim() || null,
      studentAvatarUrl: normalizeAvatarUrl(args.adminSupabase, profile?.avatar_url) ?? null,
      studentAccent: profile?.ui_accent ?? null,
      skillMap,
      previousSkillMap: null,
      sessions: [],
    }
  }

  const [{ data: analyticsData, error: analyticsError }, { data: transcriptData, error: transcriptError }] =
    await Promise.all([
      args.adminSupabase
        .from("lesson_analytics")
        .select(
          "session_id, summary, grammar_score, vocabulary_score, fluency_score, speaking_ratio, mistakes, strengths, recommendations, topics_practiced, raw_analysis, created_at"
        )
        .in("session_id", sessionIds),
      args.adminSupabase
        .from("lesson_transcripts")
        .select("session_id, sequence, speaker_label, speaker_role, text, started_at_sec, ended_at_sec")
        .in("session_id", sessionIds)
        .order("session_id", { ascending: true })
        .order("sequence", { ascending: true }),
    ])

  if (analyticsError) throw new Error(analyticsError.message)
  if (transcriptError) throw new Error(transcriptError.message)

  const teacherIds = [...new Set(sessionRows.map((session) => session.teacher_id).filter((value): value is string => Boolean(value)))]
  const { data: teacherProfilesData, error: teacherProfilesError } = teacherIds.length
    ? await args.adminSupabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", teacherIds)
    : { data: [], error: null as { message?: string } | null }

  if (teacherProfilesError) throw new Error(teacherProfilesError.message)

  const teacherProfilesById = new Map(
    ((teacherProfilesData ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map((row) => [row.id, row])
  )

  const analyticsBySessionId = new Map(
    ((analyticsData ?? []) as AnalyticsRow[]).map((row) => [row.session_id, row])
  )
  const transcriptsBySessionId = new Map<string, LessonTranscriptSegment[]>()

  for (const row of (transcriptData ?? []) as ProgressTranscriptRow[]) {
    const existing = transcriptsBySessionId.get(row.session_id) ?? []
    existing.push({
      sequence: row.sequence,
      speakerRole: row.speaker_role,
      speakerLabel: row.speaker_label,
      text: row.text,
      startedAtSec: row.started_at_sec,
      endedAtSec: row.ended_at_sec,
    })
    transcriptsBySessionId.set(row.session_id, existing)
  }

  const sessions = sessionRows.map<LessonFeedItem>((session) => {
    const analytics = analyticsBySessionId.get(session.id)
    const transcript = transcriptsBySessionId.get(session.id) ?? []
    const relatedTeacherProfile = session.teacher_id ? teacherProfilesById.get(session.teacher_id) : null
    const embeddedStudentProfile = resolveEmbeddedProfile(session.student_profile)
    const embeddedTeacherProfile = resolveEmbeddedProfile(session.teacher_profile)
    const grammarScore = analytics?.grammar_score ?? null
    const vocabularyScore = analytics?.vocabulary_score ?? null
    const fluencyScore = analytics?.fluency_score ?? null
    const studentName =
      embeddedStudentProfile?.full_name?.trim() ||
      profile?.full_name?.trim() ||
      contextDisplayName(session.context, ["student_name", "studentName", "student_full_name", "studentFullName"]) ||
      transcriptDisplayName(transcript, "student") ||
      null
    const teacherName =
      embeddedTeacherProfile?.full_name?.trim() ||
      relatedTeacherProfile?.full_name?.trim() ||
      contextDisplayName(session.context, ["teacher_name", "teacherName", "teacher_full_name", "teacherFullName"]) ||
      transcriptDisplayName(transcript, "teacher") ||
      null
    const studentAvatarUrl =
      normalizeAvatarUrl(args.adminSupabase, embeddedStudentProfile?.avatar_url ?? profile?.avatar_url) ?? null
    const teacherAvatarUrl =
      normalizeAvatarUrl(args.adminSupabase, embeddedTeacherProfile?.avatar_url ?? relatedTeacherProfile?.avatar_url) ??
      fallbackTeacherAvatarByName(teacherName)

    return {
      sessionId: session.id,
      lessonId: session.lesson_id,
      title: resolveSessionTitle(session),
      studentName,
      teacherName,
      studentAvatarUrl,
      teacherAvatarUrl,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      status: session.status,
      summary: analytics?.summary?.trim() || null,
      grammarScore,
      vocabularyScore,
      fluencyScore,
      speakingRatio: analytics?.speaking_ratio ?? null,
      averageScore:
        grammarScore !== null && vocabularyScore !== null && fluencyScore !== null
          ? clampInt((grammarScore + vocabularyScore + fluencyScore) / 3, 0, 100)
          : null,
      mistakes: asMistakes(analytics?.mistakes),
      strengths: asStringArray(analytics?.strengths),
      recommendations: asStringArray(analytics?.recommendations),
      topicsPracticed: asStringArray(analytics?.topics_practiced),
      transcript,
    }
  })

  const sessionsWithAnalytics = sessions.filter(hasAnalyticsPayload)
  const currentSkillMap = hasSkillMapData(skillMap)
    ? skillMap
    : sessionsWithAnalytics[0]
      ? buildSkillMapFromAnalyticsSnapshot({
          grammarScore: sessionsWithAnalytics[0].grammarScore,
          vocabularyScore: sessionsWithAnalytics[0].vocabularyScore,
          fluencyScore: sessionsWithAnalytics[0].fluencyScore,
          speakingRatio: sessionsWithAnalytics[0].speakingRatio,
          topicsPracticed: sessionsWithAnalytics[0].topicsPracticed,
        })
      : createEmptySkillMap()

  const previousLesson = sessionsWithAnalytics[1]

  return {
    studentId: args.studentId,
    studentName: profile?.full_name?.trim() || null,
    studentAvatarUrl: normalizeAvatarUrl(args.adminSupabase, profile?.avatar_url) ?? null,
    studentAccent: profile?.ui_accent ?? null,
    skillMap: currentSkillMap,
    previousSkillMap: previousLesson
      ? buildSkillMapFromAnalyticsSnapshot({
          grammarScore: previousLesson.grammarScore,
          vocabularyScore: previousLesson.vocabularyScore,
          fluencyScore: previousLesson.fluencyScore,
          speakingRatio: previousLesson.speakingRatio,
          topicsPracticed: previousLesson.topicsPracticed,
        })
      : null,
    sessions,
  }
}
