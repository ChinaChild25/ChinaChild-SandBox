-- ensure_slot_for_student_reschedule: раньше при status = busy (или booked не этим учеником)
-- сразу выходили без ошибки → серийный перенос глотал «new slot is not available» и оставлял часть серии на старом дне.
-- reschedule_following_slots_atomic: не подавлять «new slot is not available» — перенос всей серии атомарно откатывается вместо «успеха» с разорванной цепочкой.

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
  v_weekday_key text;
  v_wall_time time;
  v_is_template_free boolean := false;
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

  IF v_status IS NOT NULL THEN
    IF v_status = 'free' THEN
      RETURN;
    END IF;
    IF v_status = 'booked' AND v_booked_student = v_me THEN
      RETURN;
    END IF;
    IF v_status = 'busy' OR (v_status = 'booked' AND v_booked_student IS DISTINCT FROM v_me) THEN
      RAISE EXCEPTION 'slot not available';
    END IF;
    RAISE EXCEPTION 'slot not available';
  END IF;

  SELECT weekly_template, COALESCE(NULLIF(timezone, ''), p_timezone)
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
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_following_slots_atomic(
  p_teacher_id uuid,
  p_student_id uuid,
  p_anchor_slot_at timestamptz,
  p_cluster_weekday_a integer,
  p_cluster_weekday_b integer,
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
  v_tz text;
  v_anchor_date date;
  v_anchor_time text;
  v_wall_date date;
  v_wall_weekday integer;
  v_wall_time text;
  v_shift_days integer;
  v_target_date date;
  v_target_slot timestamptz;
BEGIN
  v_tz := public.assert_valid_timezone(p_timezone);

  v_anchor_date := (p_anchor_slot_at AT TIME ZONE v_tz)::date;
  v_anchor_time := trim(both from to_char((p_anchor_slot_at AT TIME ZONE v_tz), 'HH24:MI'));

  FOR v_row IN
    SELECT slot_at
    FROM public.teacher_schedule_slots
    WHERE teacher_id = p_teacher_id
      AND booked_student_id = p_student_id
      AND status = 'booked'
    ORDER BY slot_at
    FOR UPDATE
  LOOP
    v_wall_date := (v_row.slot_at AT TIME ZONE v_tz)::date;
    v_wall_weekday := EXTRACT(DOW FROM v_wall_date)::integer;
    v_wall_time := trim(both from to_char((v_row.slot_at AT TIME ZONE v_tz), 'HH24:MI'));

    IF v_wall_date < v_anchor_date THEN
      CONTINUE;
    END IF;

    IF v_wall_time <> v_anchor_time THEN
      CONTINUE;
    END IF;

    IF v_wall_weekday <> p_cluster_weekday_a AND v_wall_weekday <> p_cluster_weekday_b THEN
      CONTINUE;
    END IF;

    v_shift_days := (p_cluster_weekday_b - v_wall_weekday + 7) % 7;
    IF v_shift_days > 3 THEN
      v_shift_days := v_shift_days - 7;
    END IF;
    v_target_date := v_wall_date + v_shift_days;
    v_target_slot := (v_target_date::text || ' ' || trim(both from p_target_time) || ':00')::timestamp AT TIME ZONE v_tz;

    IF v_row.slot_at = v_target_slot THEN
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.reschedule_slot_atomic(v_row.slot_at, v_target_slot, p_teacher_id, p_student_id, p_timezone);
      v_moved := v_moved + 1;
    EXCEPTION
      WHEN others THEN
        IF SQLERRM ~* 'same slot' THEN
          CONTINUE;
        END IF;
        RAISE;
    END;
  END LOOP;

  RETURN v_moved;
END;
$$;

NOTIFY pgrst, 'reload schema';
