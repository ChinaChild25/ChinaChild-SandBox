-- Общая проверка: попадает ли настенное время слота в «зелёную зону» weekly_template преподавателя.
-- Используется в ensure_slot_for_student_reschedule и book_slot_atomic, чтобы не дублировать CASE/EXISTS.

CREATE OR REPLACE FUNCTION public.teacher_weekly_template_covers_slot_at(
  p_weekly_template jsonb,
  p_teacher_tz text,
  p_slot_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $func$
  WITH tz AS (
    SELECT COALESCE(NULLIF(trim(p_teacher_tz), ''), 'UTC') AS id
  ),
  wk AS (
    SELECT
      CASE EXTRACT(DOW FROM (p_slot_at AT TIME ZONE tz.id))::integer
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        ELSE 'saturday'
      END AS day_key,
      (p_slot_at AT TIME ZONE tz.id)::time AS wall_t
    FROM tz
  )
  SELECT EXISTS (
    SELECT 1
    FROM wk
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p_weekly_template -> wk.day_key, '[]'::jsonb)) AS interval_item
    WHERE (interval_item ->> 'start')::time <= wk.wall_t
      AND wk.wall_t < (interval_item ->> 'end')::time
  );
$func$;

COMMENT ON FUNCTION public.teacher_weekly_template_covers_slot_at(jsonb, text, timestamptz) IS
  'True if p_slot_at wall clock in p_teacher_tz falls inside a free interval of p_weekly_template for that weekday.';

REVOKE ALL ON FUNCTION public.teacher_weekly_template_covers_slot_at(jsonb, text, timestamptz) FROM PUBLIC;

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
  v_template jsonb;
  v_teacher_tz text;
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

  SELECT weekly_template, COALESCE(NULLIF(timezone, ''), p_timezone)
    INTO v_template, v_teacher_tz
  FROM public.teacher_schedule_templates
  WHERE teacher_id = p_teacher_id;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'slot not found';
  END IF;

  IF NOT public.teacher_weekly_template_covers_slot_at(v_template, v_teacher_tz, p_slot_at) THEN
    IF v_status IS NULL THEN
      RAISE EXCEPTION 'slot not found';
    END IF;
    RAISE EXCEPTION 'slot not available';
  END IF;

  IF v_status = 'busy' THEN
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
  v_template jsonb;
  v_teacher_tz text;
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
    SELECT weekly_template, COALESCE(NULLIF(timezone, ''), v_timezone)
      INTO v_template, v_teacher_tz
    FROM public.teacher_schedule_templates
    WHERE teacher_id = p_teacher_id;

    IF v_template IS NULL THEN
      RAISE EXCEPTION 'slot not found';
    END IF;

    IF NOT public.teacher_weekly_template_covers_slot_at(v_template, v_teacher_tz, p_slot_at) THEN
      RAISE EXCEPTION 'slot not found';
    END IF;

    INSERT INTO public.teacher_schedule_slots (teacher_id, slot_at, status, booked_student_id)
    VALUES (p_teacher_id, p_slot_at, 'free', NULL)
    ON CONFLICT (teacher_id, slot_at) DO NOTHING;

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

  IF v_status = 'busy' THEN
    IF v_booked_student IS NOT NULL THEN
      RAISE EXCEPTION 'slot is not available';
    END IF;

    SELECT weekly_template, COALESCE(NULLIF(timezone, ''), v_timezone)
      INTO v_template, v_teacher_tz
    FROM public.teacher_schedule_templates
    WHERE teacher_id = p_teacher_id;

    IF v_template IS NULL THEN
      RAISE EXCEPTION 'slot is not available';
    END IF;

    IF NOT public.teacher_weekly_template_covers_slot_at(v_template, v_teacher_tz, p_slot_at) THEN
      RAISE EXCEPTION 'slot is not available';
    END IF;

    UPDATE public.teacher_schedule_slots
    SET status = 'free',
        booked_student_id = NULL
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_slot_at;

    SELECT status, booked_student_id
      INTO v_status, v_booked_student
    FROM public.teacher_schedule_slots
    WHERE teacher_id = p_teacher_id
      AND slot_at = p_slot_at
    FOR UPDATE;
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

NOTIFY pgrst, 'reload schema';
