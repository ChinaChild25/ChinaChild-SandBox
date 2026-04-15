-- Если в teacher_schedule_slots лежит status = busy, но по weekly_template час всё ещё в «зелёной зоне»,
-- считаем строку устаревшей относительно шаблона и переводим в free — иначе ученик видит слот в /api/schedule,
-- а ensure_slot_for_student_reschedule отклонял перенос после фикса «не глотать busy».

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

NOTIFY pgrst, 'reload schema';
