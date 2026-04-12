-- Политика «преподаватель видит учеников» с подзапросом к public.profiles может давать
-- рекурсию RLS и ломать даже SELECT своей строки при входе.
-- Проверка роли преподавателя вынесена в SECURITY DEFINER (обход RLS только внутри функции).

CREATE OR REPLACE FUNCTION public.is_current_user_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_teacher() TO authenticated;

DROP POLICY IF EXISTS "profiles_teacher_select_students" ON public.profiles;

CREATE POLICY "profiles_teacher_select_students"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'student'
    AND public.is_current_user_teacher()
  );

-- На случай если политика «своя строка» отсутствует или была перезаписана
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
