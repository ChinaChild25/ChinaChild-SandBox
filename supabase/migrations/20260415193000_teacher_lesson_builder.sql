-- Lesson builder MVP: teacher custom courses, lessons and block-based editor.

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  level text NULL,
  teacher_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text', 'matching', 'fill_gaps', 'quiz_single', 'audio')),
  "order" integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS courses_teacher_id_idx ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS courses_is_custom_idx ON public.courses(is_custom);
CREATE INDEX IF NOT EXISTS lessons_course_id_order_idx ON public.lessons(course_id, "order");
CREATE INDEX IF NOT EXISTS lesson_blocks_lesson_id_order_idx ON public.lesson_blocks(lesson_id, "order");

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_courses_updated_at ON public.courses;
CREATE TRIGGER set_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_lessons_updated_at ON public.lessons;
CREATE TRIGGER set_lessons_updated_at
BEFORE UPDATE ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_lesson_blocks_updated_at ON public.lesson_blocks;
CREATE TRIGGER set_lesson_blocks_updated_at
BEFORE UPDATE ON public.lesson_blocks
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_select_ready_or_own ON public.courses;
CREATE POLICY courses_select_ready_or_own
ON public.courses
FOR SELECT
TO authenticated
USING (NOT is_custom OR teacher_id = auth.uid());

DROP POLICY IF EXISTS courses_insert_own_custom ON public.courses;
CREATE POLICY courses_insert_own_custom
ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (teacher_id = auth.uid() AND is_custom = true);

DROP POLICY IF EXISTS courses_update_own_custom ON public.courses;
CREATE POLICY courses_update_own_custom
ON public.courses
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid() AND is_custom = true)
WITH CHECK (teacher_id = auth.uid() AND is_custom = true);

DROP POLICY IF EXISTS courses_delete_own_custom ON public.courses;
CREATE POLICY courses_delete_own_custom
ON public.courses
FOR DELETE
TO authenticated
USING (teacher_id = auth.uid() AND is_custom = true);

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
      AND (NOT c.is_custom OR c.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS lessons_mutate_own_custom_courses ON public.lessons;
CREATE POLICY lessons_mutate_own_custom_courses
ON public.lessons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = lessons.course_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = lessons.course_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
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
      AND (NOT c.is_custom OR c.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS lesson_blocks_mutate_own_custom_courses ON public.lesson_blocks;
CREATE POLICY lesson_blocks_mutate_own_custom_courses
ON public.lesson_blocks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_blocks.lesson_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_blocks.lesson_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_blocks TO authenticated;
