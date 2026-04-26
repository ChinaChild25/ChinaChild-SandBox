-- Foundation for persistent Daily rooms, live lesson sessions,
-- transcript storage, analytics, personalization, and async processing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'set_current_timestamp_updated_at'
  ) THEN
    CREATE FUNCTION public.set_current_timestamp_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = timezone('utc', now());
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type text NOT NULL CHECK (room_type IN ('private', 'lesson', 'group')),
  teacher_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  lesson_id uuid NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
  daily_room_name text NOT NULL UNIQUE,
  daily_room_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT rooms_private_pair_required CHECK (
    room_type <> 'private' OR (teacher_id IS NOT NULL AND student_id IS NOT NULL)
  ),
  CONSTRAINT rooms_lesson_scope_required CHECK (
    room_type <> 'lesson' OR lesson_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS rooms_private_teacher_student_uk
  ON public.rooms (teacher_id, student_id)
  WHERE room_type = 'private' AND teacher_id IS NOT NULL AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rooms_lesson_scope_uk
  ON public.rooms (lesson_id)
  WHERE room_type = 'lesson' AND lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rooms_teacher_id_idx ON public.rooms (teacher_id);
CREATE INDEX IF NOT EXISTS rooms_student_id_idx ON public.rooms (student_id);

DROP TRIGGER IF EXISTS set_rooms_updated_at ON public.rooms;
CREATE TRIGGER set_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.lesson_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  lesson_id uuid NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
  schedule_slot_id uuid NULL REFERENCES public.teacher_schedule_slots(id) ON DELETE SET NULL,
  teacher_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  daily_meeting_id text NULL,
  daily_recording_id text NULL,
  daily_recording_type text NULL CHECK (daily_recording_type IN ('cloud', 'cloud-audio-only', 'raw-tracks')),
  daily_transcript_id text NULL,
  recording_status text NOT NULL DEFAULT 'not_started'
    CHECK (recording_status IN ('not_started', 'starting', 'ready', 'error', 'deleted')),
  transcript_status text NOT NULL DEFAULT 'not_started'
    CHECK (transcript_status IN ('not_started', 'starting', 'ready', 'error')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'awaiting_artifacts', 'processing', 'done', 'failed')),
  recording_retention_until timestamptz NULL,
  recording_deleted_at timestamptz NULL,
  processing_attempts integer NOT NULL DEFAULT 0,
  processing_error text NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS lesson_sessions_room_id_created_at_idx
  ON public.lesson_sessions (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lesson_sessions_lesson_id_created_at_idx
  ON public.lesson_sessions (lesson_id, created_at DESC)
  WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lesson_sessions_schedule_slot_created_at_idx
  ON public.lesson_sessions (schedule_slot_id, created_at DESC)
  WHERE schedule_slot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lesson_sessions_student_id_created_at_idx
  ON public.lesson_sessions (student_id, created_at DESC)
  WHERE student_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_lesson_sessions_updated_at ON public.lesson_sessions;
CREATE TRIGGER set_lesson_sessions_updated_at
BEFORE UPDATE ON public.lesson_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.lesson_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 0,
  dedupe_key text NULL,
  speaker_label text NULL,
  speaker_role text NOT NULL DEFAULT 'unknown'
    CHECK (speaker_role IN ('teacher', 'student', 'unknown', 'system')),
  text text NOT NULL,
  started_at_sec double precision NULL,
  ended_at_sec double precision NULL,
  source text NOT NULL DEFAULT 'daily-webvtt',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS lesson_transcripts_session_sequence_idx
  ON public.lesson_transcripts (session_id, sequence ASC);

CREATE INDEX IF NOT EXISTS lesson_transcripts_session_role_idx
  ON public.lesson_transcripts (session_id, speaker_role);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_transcripts_dedupe_key_uk
  ON public.lesson_transcripts (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lesson_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
  student_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary text NULL,
  grammar_score integer NULL CHECK (grammar_score BETWEEN 0 AND 100),
  vocabulary_score integer NULL CHECK (vocabulary_score BETWEEN 0 AND 100),
  fluency_score integer NULL CHECK (fluency_score BETWEEN 0 AND 100),
  speaking_ratio double precision NULL CHECK (speaking_ratio >= 0 AND speaking_ratio <= 1),
  mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  topics_practiced jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_analytics_session_id_uk
  ON public.lesson_analytics (session_id);

CREATE INDEX IF NOT EXISTS lesson_analytics_student_created_at_idx
  ON public.lesson_analytics (student_id, created_at DESC)
  WHERE student_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_lesson_analytics_updated_at ON public.lesson_analytics;
CREATE TRIGGER set_lesson_analytics_updated_at
BEFORE UPDATE ON public.lesson_analytics
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.student_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  hsk_level integer NULL CHECK (hsk_level BETWEEN 1 AND 6),
  confidence double precision NOT NULL DEFAULT 0.35 CHECK (confidence >= 0 AND confidence <= 1),
  last_practiced_at timestamptz NULL,
  lessons_seen integer NOT NULL DEFAULT 0,
  mistake_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS student_mastery_student_topic_uk
  ON public.student_mastery (student_id, topic);

CREATE INDEX IF NOT EXISTS student_mastery_student_confidence_idx
  ON public.student_mastery (student_id, confidence ASC, updated_at DESC);

DROP TRIGGER IF EXISTS set_student_mastery_updated_at ON public.student_mastery;
CREATE TRIGGER set_student_mastery_updated_at
BEFORE UPDATE ON public.student_mastery
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.lesson_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('analyze_session')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  available_after timestamptz NOT NULL DEFAULT timezone('utc', now()),
  locked_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_processing_jobs_session_type_uk
  ON public.lesson_processing_jobs (session_id, job_type);

CREATE INDEX IF NOT EXISTS lesson_processing_jobs_status_available_idx
  ON public.lesson_processing_jobs (status, available_after ASC, created_at ASC);

DROP TRIGGER IF EXISTS set_lesson_processing_jobs_updated_at ON public.lesson_processing_jobs;
CREATE TRIGGER set_lesson_processing_jobs_updated_at
BEFORE UPDATE ON public.lesson_processing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.daily_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  room_name text NULL,
  session_id uuid NULL REFERENCES public.lesson_sessions(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rooms IS
  'Persistent Daily rooms. Private rooms belong to a teacher-student pair; lesson rooms are compatibility fallback for generic lesson previews.';

COMMENT ON TABLE public.lesson_sessions IS
  'Concrete live lesson attempts / calls. One room can have many sessions over time.';

COMMENT ON TABLE public.lesson_transcripts IS
  'Permanent transcript segments parsed from Daily WebVTT transcript storage.';

COMMENT ON TABLE public.lesson_analytics IS
  'Structured AI analysis generated from live lesson transcripts.';

COMMENT ON TABLE public.student_mastery IS
  'Lightweight mastery map updated after each analyzed session.';

COMMENT ON TABLE public.lesson_processing_jobs IS
  'Async processing queue for post-call transcript/analytics jobs.';

COMMENT ON TABLE public.daily_webhook_events IS
  'Idempotency ledger for Daily webhook deliveries.';
