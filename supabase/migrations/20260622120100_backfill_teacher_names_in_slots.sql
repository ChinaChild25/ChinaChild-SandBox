-- Backfill: Populate teacher_name for existing booked slots where it's NULL.
-- This ensures existing lessons become visible through the fallback RPC
-- (get_teacher_feed_lessons_by_name) if students lack assigned_teacher_id.

DO $$
DECLARE
  v_slot RECORD;
  v_teacher_name text;
BEGIN
  -- Find all student_schedule_slots with NULL or empty teacher_name
  -- that have corresponding booked slots in teacher_schedule_slots
  FOR v_slot IN
    SELECT DISTINCT
      sss.student_id,
      sss.date_key,
      sss.time,
      tss.teacher_id
    FROM public.student_schedule_slots sss
    INNER JOIN public.teacher_schedule_slots tss ON (
      (sss.date_key AT TIME ZONE 'UTC')::timestamp = DATE_TRUNC('day', tss.slot_at)
      AND to_char((tss.slot_at AT TIME ZONE 'UTC'), 'HH24:MI') = sss.time
    )
    WHERE (sss.teacher_name IS NULL OR TRIM(COALESCE(sss.teacher_name, '')) = '')
      AND tss.status = 'booked'
      AND tss.booked_student_id = sss.student_id
  LOOP
    -- Fetch the teacher name
    SELECT COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      CASE WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL THEN
        TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
      END
    ) INTO v_teacher_name
    FROM public.profiles p
    WHERE p.id = v_slot.teacher_id;

    -- Update the slot with the teacher name
    IF v_teacher_name IS NOT NULL AND v_teacher_name <> '' THEN
      UPDATE public.student_schedule_slots
      SET teacher_name = v_teacher_name
      WHERE student_id = v_slot.student_id
        AND date_key = v_slot.date_key
        AND time = v_slot.time;
    END IF;
  END LOOP;
END;
$$;
