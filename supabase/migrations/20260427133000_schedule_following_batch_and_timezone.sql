-- Batch atomic operations for "following" scope and timezone-safe student mirror.

CREATE OR REPLACE FUNCTION public.assert_valid_timezone(p_timezone text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_timezone IS NULL OR btrim(p_timezone) = '' THEN
    RETURN 'UTC';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'invalid timezone';
  END IF;

  RETURN p_timezone;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_slot_atomic(
  p_teacher_id uuid,
  p_slot_at timestamptz,
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
  v_status text;
  v_booked_student uuid;
  v_date_key date;
  v_time text;
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

  v_date_key := (p_slot_at AT TIME ZONE v_timezone)::date;
  v_time := to_char((p_slot_at AT TIME ZONE v_timezone), 'HH24:MI');

  INSERT INTO public.student_schedule_slots (student_id, date_key, time, title, type, teacher_name)
  VALUES (p_student_id, v_date_key, v_time, 'Занятие', 'lesson', NULL)
  ON CONFLICT (student_id, date_key, time)
  DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, teacher_name = EXCLUDED.teacher_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_slot_atomic(
  p_slot_at timestamptz,
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
  v_status text;
  v_booked_student uuid;
  v_date_key date;
  v_time text;
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

  v_date_key := (p_slot_at AT TIME ZONE v_timezone)::date;
  v_time := to_char((p_slot_at AT TIME ZONE v_timezone), 'HH24:MI');

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

  v_old_date_key := (p_old_slot_at AT TIME ZONE v_timezone)::date;
  v_old_time := to_char((p_old_slot_at AT TIME ZONE v_timezone), 'HH24:MI');
  v_new_date_key := (p_new_slot_at AT TIME ZONE v_timezone)::date;
  v_new_time := to_char((p_new_slot_at AT TIME ZONE v_timezone), 'HH24:MI');

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

CREATE OR REPLACE FUNCTION public.cancel_following_slots_atomic(
  p_teacher_id uuid,
  p_student_id uuid,
  p_anchor_slot_at timestamptz,
  p_anchor_weekday integer,
  p_anchor_time text,
  p_timezone text DEFAULT 'UTC'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_cancelled integer := 0;
  v_wall_date date;
  v_wall_weekday integer;
  v_wall_time text;
  v_anchor_date date;
BEGIN
  v_anchor_date := (p_anchor_slot_at AT TIME ZONE public.assert_valid_timezone(p_timezone))::date;

  FOR v_row IN
    SELECT slot_at
    FROM public.teacher_schedule_slots
    WHERE teacher_id = p_teacher_id
      AND booked_student_id = p_student_id
      AND status = 'booked'
    ORDER BY slot_at
    FOR UPDATE
  LOOP
    v_wall_date := (v_row.slot_at AT TIME ZONE p_timezone)::date;
    v_wall_weekday := EXTRACT(DOW FROM v_wall_date);
    v_wall_time := to_char((v_row.slot_at AT TIME ZONE p_timezone), 'HH24:MI');
    IF v_wall_date < v_anchor_date OR v_wall_weekday <> p_anchor_weekday OR v_wall_time <> p_anchor_time THEN
      CONTINUE;
    END IF;

    PERFORM public.cancel_slot_atomic(v_row.slot_at, p_teacher_id, p_student_id, p_timezone);
    v_cancelled := v_cancelled + 1;
  END LOOP;

  RETURN v_cancelled;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_following_slots_atomic(
  p_teacher_id uuid,
  p_student_id uuid,
  p_slot_ats timestamptz[],
  p_timezone text DEFAULT 'UTC'
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
  PERFORM public.assert_valid_timezone(p_timezone);

  IF p_slot_ats IS NULL OR cardinality(p_slot_ats) = 0 THEN
    RETURN 0;
  END IF;

  FOREACH v_slot_at IN ARRAY p_slot_ats LOOP
    BEGIN
      PERFORM public.book_slot_atomic(p_teacher_id, v_slot_at, p_student_id, p_timezone);
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

CREATE OR REPLACE FUNCTION public.reschedule_following_slots_atomic(
  p_teacher_id uuid,
  p_student_id uuid,
  p_anchor_slot_at timestamptz,
  p_anchor_weekday integer,
  p_anchor_time text,
  p_delta_days integer,
  p_target_time text,
  p_timezone text DEFAULT 'UTC'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_moved integer := 0;
  v_wall_date date;
  v_wall_weekday integer;
  v_wall_time text;
  v_anchor_date date;
  v_target_slot timestamptz;
BEGIN
  v_anchor_date := (p_anchor_slot_at AT TIME ZONE public.assert_valid_timezone(p_timezone))::date;

  FOR v_row IN
    SELECT slot_at
    FROM public.teacher_schedule_slots
    WHERE teacher_id = p_teacher_id
      AND booked_student_id = p_student_id
      AND status = 'booked'
    ORDER BY slot_at
    FOR UPDATE
  LOOP
    v_wall_date := (v_row.slot_at AT TIME ZONE p_timezone)::date;
    v_wall_weekday := EXTRACT(DOW FROM v_wall_date);
    v_wall_time := to_char((v_row.slot_at AT TIME ZONE p_timezone), 'HH24:MI');
    IF v_wall_date < v_anchor_date OR v_wall_weekday <> p_anchor_weekday OR v_wall_time <> p_anchor_time THEN
      CONTINUE;
    END IF;

    v_target_slot := ((v_wall_date + p_delta_days)::text || ' ' || p_target_time || ':00')::timestamp AT TIME ZONE p_timezone;

    BEGIN
      PERFORM public.reschedule_slot_atomic(v_row.slot_at, v_target_slot, p_teacher_id, p_student_id, p_timezone);
      v_moved := v_moved + 1;
    EXCEPTION
      WHEN others THEN
        IF SQLERRM ~* 'new slot is not available|same slot' THEN
          CONTINUE;
        END IF;
        RAISE;
    END;
  END LOOP;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_valid_timezone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_valid_timezone(text) TO authenticated;

REVOKE ALL ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_slot_atomic(timestamptz, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_slot_atomic(timestamptz, uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reschedule_slot_atomic(timestamptz, timestamptz, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_slot_atomic(timestamptz, timestamptz, uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_following_slots_atomic(uuid, uuid, timestamptz, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_following_slots_atomic(uuid, uuid, timestamptz, integer, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.book_following_slots_atomic(uuid, uuid, timestamptz[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_following_slots_atomic(uuid, uuid, timestamptz[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.reschedule_following_slots_atomic(uuid, uuid, timestamptz, integer, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_following_slots_atomic(uuid, uuid, timestamptz, integer, text, integer, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
