-- Hotfix: remove recursive RLS dependency in profiles policy.
-- Root cause: policy queried public.profiles inside itself, which can trigger 42P17.

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
DROP POLICY IF EXISTS "profiles_teacher_select_own_students" ON public.profiles;

CREATE POLICY "profiles_teacher_select_own_students"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND role = 'student'
    AND assigned_teacher_id = auth.uid()
  );
