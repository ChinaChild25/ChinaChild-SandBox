-- Гарантирует политику выбора учеников преподавателем (список в «Новый диалог»).
-- Идемпотентно: безопасно, если 20260413120000 уже применялась.

DROP POLICY IF EXISTS "profiles_teacher_select_students" ON public.profiles;

CREATE POLICY "profiles_teacher_select_students"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    profiles.role = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS me
      WHERE me.id = (SELECT auth.uid())
        AND me.role = 'teacher'
    )
  );
