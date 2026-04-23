-- Назначение кастомных курсов ученикам (закреплённым за преподавателем). Ученик видит курс в ЛК после назначения.

CREATE TABLE IF NOT EXISTS public.course_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (course_id, student_id)
);

CREATE INDEX IF NOT EXISTS course_student_assignments_course_id_idx
  ON public.course_student_assignments(course_id);
CREATE INDEX IF NOT EXISTS course_student_assignments_student_id_idx
  ON public.course_student_assignments(student_id);

ALTER TABLE public.course_student_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_student_assignments_select_teacher ON public.course_student_assignments;
CREATE POLICY course_student_assignments_select_teacher
ON public.course_student_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_id AND c.is_custom AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS course_student_assignments_select_student ON public.course_student_assignments;
CREATE POLICY course_student_assignments_select_student
ON public.course_student_assignments
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS course_student_assignments_insert_teacher ON public.course_student_assignments;
CREATE POLICY course_student_assignments_insert_teacher
ON public.course_student_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_id AND c.is_custom AND c.teacher_id = auth.uid()
  )
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
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_id AND c.is_custom AND c.teacher_id = auth.uid()
  )
);

GRANT SELECT, INSERT, DELETE ON public.course_student_assignments TO authenticated;

-- Атомарная замена списка учеников на курсе (проверки внутри функции).
CREATE OR REPLACE FUNCTION public.set_teacher_course_student_assignments(p_course_id uuid, p_student_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid := auth.uid();
BEGIN
  IF tid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id AND c.is_custom AND c.teacher_id = tid
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.course_student_assignments WHERE course_id = p_course_id;

  INSERT INTO public.course_student_assignments (course_id, student_id, assigned_by)
  SELECT p_course_id, sid, tid
  FROM unnest(coalesce(p_student_ids, array[]::uuid[])) AS sid
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = sid AND p.role = 'student' AND p.assigned_teacher_id = tid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_teacher_course_student_assignments(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_teacher_course_student_assignments(uuid, uuid[]) TO authenticated;

-- Курсы: ученик видит кастомный курс, на который назначен.
DROP POLICY IF EXISTS courses_select_ready_or_own ON public.courses;
CREATE POLICY courses_select_ready_or_own
ON public.courses
FOR SELECT
TO authenticated
USING (
  NOT is_custom
  OR teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.course_student_assignments csa
    WHERE csa.course_id = courses.id AND csa.student_id = auth.uid()
  )
);

-- Уроки и блоки: тот же доступ по курсу.
DROP POLICY IF EXISTS lessons_select_visible_courses ON public.lessons;
CREATE POLICY lessons_select_visible_courses
ON public.lessons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = lessons.course_id
      AND (
        NOT c.is_custom
        OR c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_student_assignments csa
          WHERE csa.course_id = c.id AND csa.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS lesson_blocks_select_visible_courses ON public.lesson_blocks;
CREATE POLICY lesson_blocks_select_visible_courses
ON public.lesson_blocks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_blocks.lesson_id
      AND (
        NOT c.is_custom
        OR c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_student_assignments csa
          WHERE csa.course_id = c.id AND csa.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS course_modules_select_visible_courses ON public.course_modules;
CREATE POLICY course_modules_select_visible_courses
ON public.course_modules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_modules.course_id
      AND (
        NOT c.is_custom
        OR c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_student_assignments csa
          WHERE csa.course_id = c.id AND csa.student_id = auth.uid()
        )
      )
  )
);
