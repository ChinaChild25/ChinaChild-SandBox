-- Регулярный перенос: учитывать «переходный» кластер (исходный и целевой день недели),
-- сдвиг по фактическому дню строки, пропуск same_slot до вызова reschedule_slot_atomic.
-- Снимает кейс: после частичного переноса остались среды + четверги — RPC раньше цеплялся только к одному weekday.

DROP FUNCTION IF EXISTS public.reschedule_following_slots_atomic(uuid, uuid, timestamptz, integer, text, integer, text, text);

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
        IF SQLERRM ~* 'new slot is not available|same slot' THEN
          CONTINUE;
        END IF;
        RAISE;
    END;
  END LOOP;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_following_slots_atomic(uuid, uuid, timestamptz, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_following_slots_atomic(uuid, uuid, timestamptz, integer, integer, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
