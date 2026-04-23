-- Fix: Populate teacher_name when booking slots to enable fallback teacher visibility.
-- Previously, book_slot_atomic set teacher_name to NULL, which prevented lessons from being visible
-- through the get_teacher_feed_lessons_by_name fallback RPC if the student lacked assigned_teacher_id.
-- This ensures teachers can see their students' lessons even if assignment is missing (safety net).

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
  v_teacher_name text;
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

  -- Fetch teacher name for fallback RPC visibility (get_teacher_feed_lessons_by_name)
  SELECT COALESCE(
    NULLIF(TRIM(full_name), ''),
    CASE WHEN first_name IS NOT NULL OR last_name IS NOT NULL THEN
      TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    END
  ) INTO v_teacher_name
  FROM public.profiles
  WHERE id = p_teacher_id;

  INSERT INTO public.student_schedule_slots (student_id, date_key, time, title, type, teacher_name)
  VALUES (p_student_id, v_date_key, v_time, 'Занятие', 'lesson', v_teacher_name)
  ON CONFLICT (student_id, date_key, time)
  DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, teacher_name = EXCLUDED.teacher_name;
END;
$$;

-- Also update book_following_slots_atomic to pass the timezone consistently
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
  v_me uuid := auth.uid();
  v_me_role text;
  v_count integer := 0;
  v_slot_at timestamptz;
BEGIN
  v_me := auth.uid();

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

  FOREACH v_slot_at IN ARRAY p_slot_ats LOOP
    BEGIN
      PERFORM public.book_slot_atomic(p_teacher_id, v_slot_at, p_student_id, p_timezone);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot_atomic(uuid, timestamptz, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.book_following_slots_atomic(uuid, uuid, timestamptz[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_following_slots_atomic(uuid, uuid, timestamptz[], text) TO authenticated;
