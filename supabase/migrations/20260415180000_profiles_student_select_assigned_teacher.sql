-- Ученик не имел отдельного права читать строку преподавателя в profiles (кроме «собеседник в чате»).
-- Если политика чата ещё не сработала или uuid не совпал с ожиданиями UI, avatar_url не приходит — в чате/списке нет фото.
-- Закреплённый преподаватель (assigned_teacher_id) должен быть виден ученику так же, как в карточке на дашборде.

CREATE OR REPLACE FUNCTION public.is_profile_assigned_teacher_of_current_student(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role = 'student'
      AND me.assigned_teacher_id IS NOT NULL
      AND me.assigned_teacher_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_profile_assigned_teacher_of_current_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profile_assigned_teacher_of_current_student(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_student_select_assigned_teacher" ON public.profiles;

CREATE POLICY "profiles_student_select_assigned_teacher"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_profile_assigned_teacher_of_current_student(id));
