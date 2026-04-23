-- Hardening for schedule flows:
-- 1) students can insert only their own booked rows (not free) into teacher_schedule_slots
-- 2) students can read assigned teacher templates for availability-driven booking

DROP POLICY IF EXISTS "teacher_schedule_insert_student_booking" ON public.teacher_schedule_slots;
CREATE POLICY "teacher_schedule_insert_student_booking"
  ON public.teacher_schedule_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_current_student_access_teacher_schedule(teacher_id)
    AND status = 'booked'
    AND booked_student_id = auth.uid()
  );

DROP POLICY IF EXISTS "teacher_schedule_templates_select_own_or_curator" ON public.teacher_schedule_templates;
DROP POLICY IF EXISTS "teacher_schedule_templates_select_own_or_curator_or_assigned_student" ON public.teacher_schedule_templates;
CREATE POLICY "teacher_schedule_templates_select_own_or_curator_or_assigned_student"
  ON public.teacher_schedule_templates
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.auth_is_curator()
    OR public.can_current_student_access_teacher_schedule(teacher_id)
  );

NOTIFY pgrst, 'reload schema';
