ALTER TABLE public.student_lesson_completions
  ADD COLUMN IF NOT EXISTS score_percent integer,
  ADD COLUMN IF NOT EXISTS answered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.student_lesson_completions
SET
  score_percent = COALESCE(score_percent, 100),
  answered_count = COALESCE(answered_count, 0),
  total_count = COALESCE(total_count, 0),
  updated_at = COALESCE(updated_at, completed_at, now())
WHERE score_percent IS NULL
   OR answered_count IS NULL
   OR total_count IS NULL
   OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_lesson_completions_score_percent_range'
  ) THEN
    ALTER TABLE public.student_lesson_completions
      ADD CONSTRAINT student_lesson_completions_score_percent_range
      CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100));
  END IF;
END
$$;

DROP POLICY IF EXISTS student_lesson_completions_update_own ON public.student_lesson_completions;
CREATE POLICY student_lesson_completions_update_own
  ON public.student_lesson_completions
  FOR UPDATE
  TO authenticated
  USING (student_id = (SELECT auth.uid()))
  WITH CHECK (student_id = (SELECT auth.uid()));

GRANT UPDATE ON public.student_lesson_completions TO authenticated;
