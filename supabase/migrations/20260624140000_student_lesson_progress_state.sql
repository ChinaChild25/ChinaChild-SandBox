ALTER TABLE public.student_lesson_completions
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS response_state jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.student_lesson_completions
SET
  is_completed = true,
  response_state = COALESCE(response_state, '{}'::jsonb)
WHERE is_completed IS DISTINCT FROM true
   OR response_state IS NULL;
