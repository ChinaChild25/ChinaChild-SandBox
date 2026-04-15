-- Согласовать с GET /api/schedule и ensure_slot_for_student_reschedule:
-- «зелёный» час в weekly_template, но в teacher_schedule_slots осталась строка busy —
-- book_slot_atomic иначе отвечал slot is not available, хотя слот показывался свободным.

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
  v_weekday_key text;
  v_wall_time time;
  v_is_template_free boolean := false;
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

    CASE EXTRACT(DOW FROM (p_slot_at AT TIME ZONE v_teacher_tz))::int
      WHEN 0 THEN v_weekday_key := 'sunday';
      WHEN 1 THEN v_weekday_key := 'monday';
      WHEN 2 THEN v_weekday_key := 'tuesday';
      WHEN 3 THEN v_weekday_key := 'wednesday';
      WHEN 4 THEN v_weekday_key := 'thursday';
      WHEN 5 THEN v_weekday_key := 'friday';
      ELSE v_weekday_key := 'saturday';
    END CASE;

    v_wall_time := (p_slot_at AT TIME ZONE v_teacher_tz)::time;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_template -> v_weekday_key, '[]'::jsonb)) AS interval_item
      WHERE (interval_item ->> 'start')::time <= v_wall_time
        AND v_wall_time < (interval_item ->> 'end')::time
    )
      INTO v_is_template_free;

    IF NOT v_is_template_free THEN
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

    CASE EXTRACT(DOW FROM (p_slot_at AT TIME ZONE v_teacher_tz))::int
      WHEN 0 THEN v_weekday_key := 'sunday';
      WHEN 1 THEN v_weekday_key := 'monday';
      WHEN 2 THEN v_weekday_key := 'tuesday';
      WHEN 3 THEN v_weekday_key := 'wednesday';
      WHEN 4 THEN v_weekday_key := 'thursday';
      WHEN 5 THEN v_weekday_key := 'friday';
      ELSE v_weekday_key := 'saturday';
    END CASE;

    v_wall_time := (p_slot_at AT TIME ZONE v_teacher_tz)::time;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_template -> v_weekday_key, '[]'::jsonb)) AS interval_item
      WHERE (interval_item ->> 'start')::time <= v_wall_time
        AND v_wall_time < (interval_item ->> 'end')::time
    )
      INTO v_is_template_free;

    IF NOT v_is_template_free THEN
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
