-- Materialize target teacher slot for student reschedule under SECURITY DEFINER.

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

  SELECT status
    INTO v_status
  FROM public.teacher_schedule_slots
  WHERE teacher_id = p_teacher_id
    AND slot_at = p_slot_at
  FOR UPDATE;

  -- Slot already exists; no need to materialize.
  IF v_status IS NOT NULL THEN
    RETURN;
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

REVOKE ALL ON FUNCTION public.ensure_slot_for_student_reschedule(uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_slot_for_student_reschedule(uuid, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
