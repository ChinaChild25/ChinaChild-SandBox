-- Make single-slot reschedule idempotent to avoid false conflict on duplicate requests.

CREATE OR REPLACE FUNCTION public.reschedule_slot_atomic(
  p_old_slot_at timestamptz,
  p_new_slot_at timestamptz,
  p_teacher_id uuid,
  p_student_id uuid,
  p_timezone text DEFAULT 'UTC'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_me_role text;
  v_old_status text;
  v_old_student uuid;
  v_new_status text;
  v_new_student uuid;
  v_old_date_key date;
  v_old_time text;
  v_old_time_legacy text;
  v_new_date_key date;
  v_new_time text;
  v_timezone text;
BEGIN
  v_timezone := public.assert_valid_timezone(p_timezone);

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_me <> p_student_id THEN
    SELECT role INTO v_me_role FROM public.profiles WHERE id = v_me;
    IF v_me_role NOT IN ('teacher', 'curator') OR v_me <> p_teacher_id THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  IF p_old_slot_at = p_new_slot_at THEN
    RAISE EXCEPTION 'same slot';
  END IF;

  SELECT status, booked_student_id
    INTO v_old_status, v_old_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_old_slot_at
  FOR UPDATE;

  SELECT status, booked_student_id
    INTO v_new_status, v_new_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_new_slot_at
  FOR UPDATE;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'new slot not found';
  END IF;

  -- Idempotent retry case: old already freed, new already booked by this student.
  IF v_old_status = 'free' AND v_new_status = 'booked' AND v_new_student = p_student_id THEN
    RETURN;
  END IF;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'old slot not found';
  END IF;

  IF v_old_status <> 'booked' OR v_old_student <> p_student_id THEN
    RAISE EXCEPTION 'slot ownership mismatch';
  END IF;

  IF v_new_status = 'booked' AND v_new_student = p_student_id THEN
    -- Treat as idempotent/partial-retry: clear old booking and keep target.
    UPDATE public.teacher_schedule_slots
    SET status = 'free',
        booked_student_id = NULL
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_old_slot_at;
  ELSIF v_new_status = 'free' THEN
    UPDATE public.teacher_schedule_slots
    SET status = 'booked',
        booked_student_id = p_student_id
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_new_slot_at;

    UPDATE public.teacher_schedule_slots
    SET status = 'free',
        booked_student_id = NULL
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_old_slot_at;
  ELSE
    RAISE EXCEPTION 'new slot is not available';
  END IF;

  v_old_date_key := (p_old_slot_at AT TIME ZONE v_timezone)::date;
  v_old_time := to_char((p_old_slot_at AT TIME ZONE v_timezone), 'HH24:MI');
  v_old_time_legacy := CONCAT(EXTRACT(HOUR FROM (p_old_slot_at AT TIME ZONE v_timezone))::int, ':', to_char((p_old_slot_at AT TIME ZONE v_timezone), 'MI'));
  v_new_date_key := (p_new_slot_at AT TIME ZONE v_timezone)::date;
  v_new_time := to_char((p_new_slot_at AT TIME ZONE v_timezone), 'HH24:MI');

  DELETE FROM public.student_schedule_slots
  WHERE student_id = p_student_id
    AND date_key = v_old_date_key
    AND (time = v_old_time OR time = v_old_time_legacy);

  INSERT INTO public.student_schedule_slots (student_id, date_key, time, title, type, teacher_name)
  VALUES (p_student_id, v_new_date_key, v_new_time, 'Занятие', 'lesson', NULL)
  ON CONFLICT (student_id, date_key, time)
  DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, teacher_name = EXCLUDED.teacher_name;
END;
$$;

NOTIFY pgrst, 'reload schema';
