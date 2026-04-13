-- Единый источник расписания ученика в БД.
-- Преподаватель читает слоты закреплённых за ним учеников; ученик управляет только своим расписанием.

CREATE TABLE IF NOT EXISTS public.student_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  date_key date NOT NULL,
  time text NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'lesson',
  teacher_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_schedule_slots_time_hhmm CHECK (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  CONSTRAINT student_schedule_slots_title_nonempty CHECK (btrim(title) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS student_schedule_slots_student_date_time_uk
  ON public.student_schedule_slots (student_id, date_key, time);

CREATE INDEX IF NOT EXISTS student_schedule_slots_student_id_idx
  ON public.student_schedule_slots (student_id);

CREATE OR REPLACE FUNCTION public.handle_student_schedule_slots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_student_schedule_slots_updated_at ON public.student_schedule_slots;
CREATE TRIGGER on_student_schedule_slots_updated_at
  BEFORE UPDATE ON public.student_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_student_schedule_slots_updated_at();

CREATE OR REPLACE FUNCTION public.can_current_teacher_read_student_schedule(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    INNER JOIN public.profiles st ON st.id = p_student_id
    WHERE me.id = auth.uid()
      AND me.role = 'teacher'
      AND st.role = 'student'
      AND st.assigned_teacher_id = me.id
  );
$$;

REVOKE ALL ON FUNCTION public.can_current_teacher_read_student_schedule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_current_teacher_read_student_schedule(uuid) TO authenticated;

ALTER TABLE public.student_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_schedule_select_own_or_assigned_teacher" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_select_own_or_assigned_teacher"
  ON public.student_schedule_slots
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.can_current_teacher_read_student_schedule(student_id)
  );

DROP POLICY IF EXISTS "student_schedule_insert_own" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_insert_own"
  ON public.student_schedule_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "student_schedule_update_own" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_update_own"
  ON public.student_schedule_slots
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "student_schedule_delete_own" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_delete_own"
  ON public.student_schedule_slots
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_schedule_slots TO authenticated;
