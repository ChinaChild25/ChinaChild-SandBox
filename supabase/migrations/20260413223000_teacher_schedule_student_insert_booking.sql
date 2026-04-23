-- Allow assigned students to insert booking/free rows for their teacher schedule.
-- This is required for student reschedule flow that uses upsert on teacher_schedule_slots.

DROP POLICY IF EXISTS "teacher_schedule_insert_student_booking" ON public.teacher_schedule_slots;
CREATE POLICY "teacher_schedule_insert_student_booking"
  ON public.teacher_schedule_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_current_student_access_teacher_schedule(teacher_id)
    AND (
      (status = 'booked' AND booked_student_id = auth.uid())
      OR (status = 'free' AND booked_student_id IS NULL)
    )
  );
