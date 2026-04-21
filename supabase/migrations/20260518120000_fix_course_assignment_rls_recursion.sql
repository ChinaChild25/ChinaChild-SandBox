-- Break RLS recursion: courses SELECT referenced course_student_assignments, whose
-- teacher SELECT referenced courses again (infinite recursion).

CREATE OR REPLACE FUNCTION public.teacher_owns_custom_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND c.is_custom
      AND c.teacher_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.student_assigned_to_custom_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_student_assignments csa
    WHERE csa.course_id = p_course_id
      AND csa.student_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.teacher_owns_custom_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_owns_custom_course(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.student_assigned_to_custom_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_assigned_to_custom_course(uuid) TO authenticated;

-- Assignments: use helper instead of sub-SELECT on courses (avoids re-entering courses RLS).
DROP POLICY IF EXISTS course_student_assignments_select_teacher ON public.course_student_assignments;
CREATE POLICY course_student_assignments_select_teacher
ON public.course_student_assignments
FOR SELECT
TO authenticated
USING (public.teacher_owns_custom_course(course_id));

DROP POLICY IF EXISTS course_student_assignments_insert_teacher ON public.course_student_assignments;
CREATE POLICY course_student_assignments_insert_teacher
ON public.course_student_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_by = auth.uid()
  AND public.teacher_owns_custom_course(course_id)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = student_id AND p.role = 'student' AND p.assigned_teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS course_student_assignments_delete_teacher ON public.course_student_assignments;
CREATE POLICY course_student_assignments_delete_teacher
ON public.course_student_assignments
FOR DELETE
TO authenticated
USING (public.teacher_owns_custom_course(course_id));

-- Courses: use helper instead of EXISTS on course_student_assignments under courses RLS.
DROP POLICY IF EXISTS courses_select_ready_or_own ON public.courses;
CREATE POLICY courses_select_ready_or_own
ON public.courses
FOR SELECT
TO authenticated
USING (
  NOT is_custom
  OR teacher_id = auth.uid()
  OR public.student_assigned_to_custom_course(id)
);
