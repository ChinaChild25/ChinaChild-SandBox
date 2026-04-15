DROP FUNCTION IF EXISTS public.book_following_slots_atomic(uuid, uuid, timestamptz[], text);
DROP FUNCTION IF EXISTS public.book_slot_atomic(uuid, timestamptz, uuid, text);

CREATE OR REPLACE FUNCTION public.book_slot_atomic(
  p_teacher_id uuid,
  p_slot_at timestamptz,
  p_student_id uuid,
  p_timezone text DEFAULT 'UTC',
  p_now_date_key text DEFAULT NULL,
  p_now_time text DEFAULT NULL
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
  v_timezone text;
  v_now_ts timestamp;
  v_slot_wall_ts timestamp;
BEGIN
  v_timezone := public.assert_valid_timezone(p_timezone);

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_me_role
  FROM public.profiles
  WHERE id = v_me;

  IF v_me_role IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_me <> p_student_id THEN
    IF v_me_role NOT IN ('teacher', 'curator') OR v_me <> p_teacher_id THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSE
    IF v_me_role <> 'student' OR NOT public.can_current_student_access_teacher_schedule(p_teacher_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  -- Student policy guard in DB: booking must be strictly more than 24h ahead.
  -- Compare in wall-clock domain to match client-side validation semantics.
  IF v_me_role = 'student' THEN
    IF p_now_date_key IS NULL OR p_now_time IS NULL THEN
      RAISE EXCEPTION 'client wall-clock now is required for student booking';
    END IF;
    IF p_now_date_key !~ '^\d{4}-\d{2}-\d{2}$' OR p_now_time !~ '^\d{2}:\d{2}$' THEN
      RAISE EXCEPTION 'invalid client wall-clock now format';
    END IF;

    v_now_ts := ((p_now_date_key || ' ' || p_now_time || ':00')::timestamp);
    v_slot_wall_ts := (p_slot_at AT TIME ZONE v_timezone);
    IF v_slot_wall_ts <= v_now_ts + interval '24 hours' THEN
      RAISE EXCEPTION 'student booking requires >24h lead time';
    END IF;
  END IF;

  SELECT status, booked_student_id
    INTO v_status, v_booked_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at
  FOR UPDATE;

  IF v_status IS NULL OR (v_status = 'busy' AND v_booked_student IS NULL) THEN
    PERFORM public.teacher_schedule_materialize_or_reconcile_free_slot(
      p_teacher_id,
      p_slot_at,
      v_timezone,
      CASE WHEN v_status IS NULL THEN 'slot not found' ELSE 'slot is not available' END,
      CASE WHEN v_status IS NULL THEN 'slot not found' ELSE 'slot is not available' END
    );
    SELECT status, booked_student_id
      INTO v_status, v_booked_student
    FROM public.teacher_schedule_slots
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_slot_at
    FOR UPDATE;
  END IF;

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

  v_date_key := (p_slot_at AT TIME ZONE v_timezone)::date;
  v_time := to_char((p_slot_at AT TIME ZONE v_timezone), 'HH24:MI');

  INSERT INTO public.student_schedule_slots (student_id, date_key, time, title, type, teacher_name)
  VALUES (p_student_id, v_date_key, v_time, 'Занятие', 'lesson', NULL)
  ON CONFLICT (student_id, date_key, time)
  DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, teacher_name = EXCLUDED.teacher_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_following_slots_atomic(
  p_teacher_id uuid,
  p_student_id uuid,
  p_slot_ats timestamptz[],
  p_timezone text DEFAULT 'UTC',
  p_now_date_key text DEFAULT NULL,
  p_now_time text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_at timestamptz;
  v_booked integer := 0;
BEGIN
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM public.assert_valid_timezone(p_timezone);

  IF p_slot_ats IS NULL OR cardinality(p_slot_ats) = 0 THEN
    RETURN 0;
  END IF;

  FOREACH v_slot_at IN ARRAY p_slot_ats LOOP
    BEGIN
      PERFORM public.book_slot_atomic(
        p_teacher_id => p_teacher_id,
        p_slot_at => v_slot_at,
        p_student_id => p_student_id,
        p_timezone => p_timezone,
        p_now_date_key => p_now_date_key,
        p_now_time => p_now_time
      );
      v_booked := v_booked + 1;
    EXCEPTION
      WHEN others THEN
        IF SQLERRM ~* 'slot is not available' THEN
          CONTINUE;
        END IF;
        RAISE;
    END;
  END LOOP;

  RETURN v_booked;
END;
$$;

REVOKE ALL ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.book_following_slots_atomic(uuid, uuid, timestamptz[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_following_slots_atomic(uuid, uuid, timestamptz[], text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

