-- Ученик: отметка пройденных уроков в назначенных курсах преподавателя (прогресс на карточке курса).

CREATE TABLE IF NOT EXISTS public.student_lesson_completions (
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS student_lesson_completions_student_id_idx
  ON public.student_lesson_completions (student_id);

CREATE INDEX IF NOT EXISTS student_lesson_completions_lesson_id_idx
  ON public.student_lesson_completions (lesson_id);

ALTER TABLE public.student_lesson_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_lesson_completions_select_own ON public.student_lesson_completions;
CREATE POLICY student_lesson_completions_select_own
  ON public.student_lesson_completions
  FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS student_lesson_completions_insert_assigned ON public.student_lesson_completions;
CREATE POLICY student_lesson_completions_insert_assigned
  ON public.student_lesson_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      JOIN public.course_student_assignments csa
        ON csa.course_id = c.id AND csa.student_id = (SELECT auth.uid())
      WHERE l.id = lesson_id
        AND c.is_custom IS TRUE
    )
  );

DROP POLICY IF EXISTS student_lesson_completions_delete_own ON public.student_lesson_completions;
CREATE POLICY student_lesson_completions_delete_own
  ON public.student_lesson_completions
  FOR DELETE
  TO authenticated
  USING (student_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.student_lesson_completions TO authenticated;
