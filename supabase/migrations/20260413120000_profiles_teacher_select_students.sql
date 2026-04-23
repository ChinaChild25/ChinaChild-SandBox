-- Преподаватель видит профили учеников (для выбора в чате). Собственный профиль и чужие teacher — по прежним политикам.

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
