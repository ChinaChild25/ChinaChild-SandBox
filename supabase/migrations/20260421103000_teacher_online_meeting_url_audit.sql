-- Журнал изменений персональной ссылки на видеозвонок (Zoom, VooV и т.д.).

CREATE TABLE IF NOT EXISTS public.teacher_online_meeting_url_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_url text,
  new_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_meeting_url_audit_teacher_idx
  ON public.teacher_online_meeting_url_audit (teacher_id, created_at DESC);

ALTER TABLE public.teacher_online_meeting_url_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_meeting_url_audit_select_own" ON public.teacher_online_meeting_url_audit;
CREATE POLICY "teacher_meeting_url_audit_select_own"
  ON public.teacher_online_meeting_url_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "teacher_meeting_url_audit_insert_own" ON public.teacher_online_meeting_url_audit;
CREATE POLICY "teacher_meeting_url_audit_insert_own"
  ON public.teacher_online_meeting_url_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

COMMENT ON TABLE public.teacher_online_meeting_url_audit IS
  'История смены online_meeting_url у преподавателя (заполняется триггером).';

CREATE OR REPLACE FUNCTION public.log_teacher_online_meeting_url_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.online_meeting_url IS DISTINCT FROM NEW.online_meeting_url) THEN
    INSERT INTO public.teacher_online_meeting_url_audit (teacher_id, old_url, new_url)
    VALUES (NEW.id, OLD.online_meeting_url, NEW.online_meeting_url);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profiles_online_meeting_url_audit ON public.profiles;
CREATE TRIGGER on_profiles_online_meeting_url_audit
  AFTER UPDATE OF online_meeting_url ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_teacher_online_meeting_url_change();
