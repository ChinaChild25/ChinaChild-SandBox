-- Weekly availability templates for teacher schedule UX (interval-first model).

CREATE TABLE IF NOT EXISTS public.teacher_schedule_templates (
  teacher_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  weekly_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_teacher_schedule_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_teacher_schedule_templates_updated_at ON public.teacher_schedule_templates;
CREATE TRIGGER on_teacher_schedule_templates_updated_at
  BEFORE UPDATE ON public.teacher_schedule_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_teacher_schedule_templates_updated_at();

ALTER TABLE public.teacher_schedule_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_schedule_templates_select_own_or_curator" ON public.teacher_schedule_templates;
CREATE POLICY "teacher_schedule_templates_select_own_or_curator"
  ON public.teacher_schedule_templates
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.auth_is_curator()
  );

DROP POLICY IF EXISTS "teacher_schedule_templates_insert_own" ON public.teacher_schedule_templates;
CREATE POLICY "teacher_schedule_templates_insert_own"
  ON public.teacher_schedule_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_schedule_templates_update_own" ON public.teacher_schedule_templates;
CREATE POLICY "teacher_schedule_templates_update_own"
  ON public.teacher_schedule_templates
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid() OR public.auth_is_curator())
  WITH CHECK (teacher_id = auth.uid() OR public.auth_is_curator());

GRANT SELECT, INSERT, UPDATE ON public.teacher_schedule_templates TO authenticated;
