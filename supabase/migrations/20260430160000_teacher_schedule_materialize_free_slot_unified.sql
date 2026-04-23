-- Единый путь: шаблон покрывает слот → materialize free (INSERT) или reconcile busy → free.
-- Вызывается из ensure_slot_for_student_reschedule и book_slot_atomic.

CREATE OR REPLACE FUNCTION public.teacher_schedule_materialize_or_reconcile_free_slot(
  p_teacher_id uuid,
  p_slot_at timestamptz,
  p_fallback_tz text,
  p_not_covered_message text,
  p_bad_state_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  v_tpl jsonb;
  v_tz text;
  v_status text;
  v_booked uuid;
BEGIN
  SELECT weekly_template, COALESCE(NULLIF(trim(timezone), ''), trim(p_fallback_tz))
    INTO v_tpl, v_tz
  FROM public.teacher_schedule_templates
  WHERE teacher_id = p_teacher_id;

  IF v_tpl IS NULL THEN
    RAISE EXCEPTION '%', p_bad_state_message;
  END IF;

  IF NOT public.teacher_weekly_template_covers_slot_at(v_tpl, v_tz, p_slot_at) THEN
    RAISE EXCEPTION '%', p_not_covered_message;
  END IF;

  SELECT status, booked_student_id
    INTO v_status, v_booked
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at
  FOR UPDATE;

  IF v_status = 'free' THEN
    RETURN;
  END IF;

  IF v_status = 'booked' THEN
    RAISE EXCEPTION '%', p_bad_state_message;
  END IF;

  IF v_status = 'busy' THEN
    IF v_booked IS NOT NULL THEN
      RAISE EXCEPTION '%', p_bad_state_message;
    END IF;
    UPDATE public.teacher_schedule_slots
    SET status = 'free',
        booked_student_id = NULL
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_slot_at;
    RETURN;
  END IF;

  IF v_status IS NULL THEN
    INSERT INTO public.teacher_schedule_slots (teacher_id, slot_at, status, booked_student_id)
    VALUES (p_teacher_id, p_slot_at, 'free', NULL)
    ON CONFLICT (teacher_id, slot_at) DO NOTHING;
    RETURN;
  END IF;

  RAISE EXCEPTION '%', p_bad_state_message;
END;
$f$;

COMMENT ON FUNCTION public.teacher_schedule_materialize_or_reconcile_free_slot(uuid, timestamptz, text, text, text) IS
  'If weekly_template covers p_slot_at in teacher TZ: insert missing free row or downgrade busy→free; else raise.';

REVOKE ALL ON FUNCTION public.teacher_schedule_materialize_or_reconcile_free_slot(uuid, timestamptz, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ensure_slot_for_student_reschedule(
  p_teacher_id uuid,
  p_slot_at timestamptz,
  p_timezone text DEFAULT 'UTC'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
  v_booked_student uuid;
BEGIN
  PERFORM public.assert_valid_timezone(p_timezone);

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.can_current_student_access_teacher_schedule(p_teacher_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status, booked_student_id
    INTO v_status, v_booked_student
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at
  FOR UPDATE;

  IF v_status = 'free' THEN
    RETURN;
  END IF;

  IF v_status = 'booked' AND v_booked_student = v_me THEN
    RETURN;
  END IF;

  IF v_status = 'booked' AND v_booked_student IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'slot not available';
  END IF;

  IF v_status = 'busy' OR v_status IS NULL THEN
    PERFORM public.teacher_schedule_materialize_or_reconcile_free_slot(
      p_teacher_id,
      p_slot_at,
      p_timezone,
      CASE WHEN v_status IS NULL THEN 'slot not found' ELSE 'slot not available' END,
      CASE WHEN v_status IS NULL THEN 'slot not found' ELSE 'slot not available' END
    );
    RETURN;
  END IF;

  RAISE EXCEPTION 'slot not available';
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
  PERFORM set_config('statement_timeout', '120s', true);
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

NOTIFY pgrst, 'reload schema';
