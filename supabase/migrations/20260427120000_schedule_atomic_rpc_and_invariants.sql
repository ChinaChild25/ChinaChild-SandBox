-- Atomic booking/cancel/reschedule primitives for schedule consistency under concurrency.

ALTER TABLE public.teacher_schedule_slots
  DROP CONSTRAINT IF EXISTS teacher_schedule_slots_booking_consistency;

ALTER TABLE public.teacher_schedule_slots
  ADD CONSTRAINT teacher_schedule_slots_booking_consistency
  CHECK (
    (status = 'free' AND booked_student_id IS NULL)
    OR (status = 'booked' AND booked_student_id IS NOT NULL)
    OR (status = 'busy' AND booked_student_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS teacher_schedule_slots_teacher_slot_booked_uk
  ON public.teacher_schedule_slots (teacher_id, slot_at)
  WHERE status = 'booked';

DROP POLICY IF EXISTS "teacher_schedule_update_student_booking" ON public.teacher_schedule_slots;
DROP POLICY IF EXISTS "student_schedule_insert_own" ON public.student_schedule_slots;
DROP POLICY IF EXISTS "student_schedule_update_own" ON public.student_schedule_slots;
DROP POLICY IF EXISTS "student_schedule_delete_own" ON public.student_schedule_slots;

CREATE OR REPLACE FUNCTION public.book_slot_atomic(
  p_teacher_id uuid,
  p_slot_at timestamptz,
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_me_role text;
  v_status text;
  v_booked_student uuid;
  v_date_key date;
  v_time text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_me <> p_student_id THEN
    SELECT role INTO v_me_role FROM public.profiles WHERE id = v_me;
    IF v_me_role NOT IN ('teacher', 'curator') OR v_me <> p_teacher_id THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSE
    IF NOT public.can_current_student_access_teacher_schedule(p_teacher_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  SELECT status, booked_student_id
    INTO v_status, v_booked_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'slot not found';
  END IF;

  IF v_status <> 'free' THEN
    RAISE EXCEPTION 'slot is not available';
  END IF;

  UPDATE public.teacher_schedule_slots
  SET status = 'booked',
      booked_student_id = p_student_id
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at;

  v_date_key := (p_slot_at AT TIME ZONE 'Europe/Moscow')::date;
  v_time := to_char((p_slot_at AT TIME ZONE 'Europe/Moscow'), 'HH24:MI');

  INSERT INTO public.student_schedule_slots (student_id, date_key, time, title, type, teacher_name)
  VALUES (p_student_id, v_date_key, v_time, 'Занятие', 'lesson', NULL)
  ON CONFLICT (student_id, date_key, time)
  DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, teacher_name = EXCLUDED.teacher_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_slot_atomic(
  p_slot_at timestamptz,
  p_teacher_id uuid,
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_me_role text;
  v_status text;
  v_booked_student uuid;
  v_date_key date;
  v_time text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_me <> p_student_id THEN
    SELECT role INTO v_me_role FROM public.profiles WHERE id = v_me;
    IF v_me_role NOT IN ('teacher', 'curator') OR v_me <> p_teacher_id THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  SELECT status, booked_student_id
    INTO v_status, v_booked_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'slot not found';
  END IF;

  IF v_status <> 'booked' OR v_booked_student <> p_student_id THEN
    RAISE EXCEPTION 'slot ownership mismatch';
  END IF;

  UPDATE public.teacher_schedule_slots
  SET status = 'free',
      booked_student_id = NULL
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at;

  v_date_key := (p_slot_at AT TIME ZONE 'Europe/Moscow')::date;
  v_time := to_char((p_slot_at AT TIME ZONE 'Europe/Moscow'), 'HH24:MI');

  DELETE FROM public.student_schedule_slots
  WHERE student_id = p_student_id
    AND date_key = v_date_key
    AND time = v_time;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_slot_atomic(
  p_old_slot_at timestamptz,
  p_new_slot_at timestamptz,
  p_teacher_id uuid,
  p_student_id uuid
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
  v_new_date_key date;
  v_new_time text;
BEGIN
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

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'old slot not found';
  END IF;

  IF v_old_status <> 'booked' OR v_old_student <> p_student_id THEN
    RAISE EXCEPTION 'slot ownership mismatch';
  END IF;

  SELECT status, booked_student_id
    INTO v_new_status, v_new_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_new_slot_at
  FOR UPDATE;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'new slot not found';
  END IF;

  IF v_new_status <> 'free' THEN
    RAISE EXCEPTION 'new slot is not available';
  END IF;

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

  v_old_date_key := (p_old_slot_at AT TIME ZONE 'Europe/Moscow')::date;
  v_old_time := to_char((p_old_slot_at AT TIME ZONE 'Europe/Moscow'), 'HH24:MI');
  v_new_date_key := (p_new_slot_at AT TIME ZONE 'Europe/Moscow')::date;
  v_new_time := to_char((p_new_slot_at AT TIME ZONE 'Europe/Moscow'), 'HH24:MI');

  DELETE FROM public.student_schedule_slots
  WHERE student_id = p_student_id
    AND date_key = v_old_date_key
    AND time = v_old_time;

  INSERT INTO public.student_schedule_slots (student_id, date_key, time, title, type, teacher_name)
  VALUES (p_student_id, v_new_date_key, v_new_time, 'Занятие', 'lesson', NULL)
  ON CONFLICT (student_id, date_key, time)
  DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, teacher_name = EXCLUDED.teacher_name;
END;
$$;

REVOKE ALL ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_slot_atomic(timestamptz, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_slot_atomic(timestamptz, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reschedule_slot_atomic(timestamptz, timestamptz, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_slot_atomic(timestamptz, timestamptz, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
