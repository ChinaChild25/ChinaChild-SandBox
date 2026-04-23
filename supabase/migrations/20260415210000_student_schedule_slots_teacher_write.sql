-- Преподаватель может менять расписание закреплённых учеников (перенос с ослабленными правилами на клиенте).

DROP POLICY IF EXISTS "student_schedule_insert_assigned_teacher" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_insert_assigned_teacher"
  ON public.student_schedule_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_current_teacher_read_student_schedule(student_id));

DROP POLICY IF EXISTS "student_schedule_update_assigned_teacher" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_update_assigned_teacher"
  ON public.student_schedule_slots
  FOR UPDATE
  TO authenticated
  USING (public.can_current_teacher_read_student_schedule(student_id))
  WITH CHECK (public.can_current_teacher_read_student_schedule(student_id));

DROP POLICY IF EXISTS "student_schedule_delete_assigned_teacher" ON public.student_schedule_slots;
CREATE POLICY "student_schedule_delete_assigned_teacher"
  ON public.student_schedule_slots
  FOR DELETE
  TO authenticated
  USING (public.can_current_teacher_read_student_schedule(student_id));
