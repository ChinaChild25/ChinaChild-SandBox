-- Teacher schedule grid with 24 hourly slots and booking statuses.

CREATE TABLE IF NOT EXISTS public.teacher_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  slot_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('free', 'busy', 'booked')),
  booked_student_id uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_schedule_slots_booking_consistency CHECK (
    (status = 'booked' AND booked_student_id IS NOT NULL)
    OR (status IN ('free', 'busy') AND booked_student_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_schedule_slots_teacher_slot_uk
  ON public.teacher_schedule_slots (teacher_id, slot_at);

CREATE INDEX IF NOT EXISTS teacher_schedule_slots_teacher_slot_idx
  ON public.teacher_schedule_slots (teacher_id, slot_at);

CREATE OR REPLACE FUNCTION public.handle_teacher_schedule_slots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_teacher_schedule_slots_updated_at ON public.teacher_schedule_slots;
CREATE TRIGGER on_teacher_schedule_slots_updated_at
  BEFORE UPDATE ON public.teacher_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_teacher_schedule_slots_updated_at();

CREATE OR REPLACE FUNCTION public.can_current_student_access_teacher_schedule(p_teacher_id uuid)
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
      AND me.assigned_teacher_id = p_teacher_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_current_student_access_teacher_schedule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_current_student_access_teacher_schedule(uuid) TO authenticated;

ALTER TABLE public.teacher_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_schedule_select_own_or_assigned_students" ON public.teacher_schedule_slots;
CREATE POLICY "teacher_schedule_select_own_or_assigned_students"
  ON public.teacher_schedule_slots
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.can_current_student_access_teacher_schedule(teacher_id)
  );

DROP POLICY IF EXISTS "teacher_schedule_insert_own_teacher" ON public.teacher_schedule_slots;
CREATE POLICY "teacher_schedule_insert_own_teacher"
  ON public.teacher_schedule_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_schedule_update_own_teacher" ON public.teacher_schedule_slots;
CREATE POLICY "teacher_schedule_update_own_teacher"
  ON public.teacher_schedule_slots
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_schedule_update_student_booking" ON public.teacher_schedule_slots;
CREATE POLICY "teacher_schedule_update_student_booking"
  ON public.teacher_schedule_slots
  FOR UPDATE
  TO authenticated
  USING (
    public.can_current_student_access_teacher_schedule(teacher_id)
    AND (status = 'free' OR (status = 'booked' AND booked_student_id = auth.uid()))
  )
  WITH CHECK (
    public.can_current_student_access_teacher_schedule(teacher_id)
    AND (
      (status = 'booked' AND booked_student_id = auth.uid())
      OR (status = 'free' AND booked_student_id IS NULL)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.teacher_schedule_slots TO authenticated;
