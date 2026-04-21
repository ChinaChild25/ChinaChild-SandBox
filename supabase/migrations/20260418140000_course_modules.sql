-- Course curriculum: named modules (sections) containing ordered lessons.

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Раздел',
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS course_modules_course_id_order_idx ON public.course_modules(course_id, "order");

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lessons_course_module_order_idx ON public.lessons(course_id, module_id, "order");

DROP TRIGGER IF EXISTS set_course_modules_updated_at ON public.course_modules;
CREATE TRIGGER set_course_modules_updated_at
BEFORE UPDATE ON public.course_modules
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

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
      AND (NOT c.is_custom OR c.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS course_modules_mutate_own_custom_courses ON public.course_modules;
CREATE POLICY course_modules_mutate_own_custom_courses
ON public.course_modules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_modules.course_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_modules.course_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
