-- Восстанавливает цепочку RPC для уровня/цели HSK, если в БД применялись миграции частично
-- или кэш PostgREST не видит функции. Порядок: helper → level → goal.

CREATE OR REPLACE FUNCTION public.teacher_can_set_student_hsk(p_teacher uuid, p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles st
    WHERE st.id = p_student
      AND st.role = 'student'
      AND (
        st.assigned_teacher_id = p_teacher
        OR EXISTS (
          SELECT 1
          FROM public.teacher_schedule_slots t
          WHERE t.teacher_id = p_teacher
            AND t.booked_student_id = p_student
            AND t.status = 'booked'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.teacher_can_set_student_hsk(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_set_student_hsk(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_student_hsk_level(p_student_id uuid, p_level integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_level IS NOT NULL AND (p_level < 0 OR p_level > 5) THEN
    RAISE EXCEPTION 'invalid level';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_me;
  IF v_role IS NULL OR v_role NOT IN ('teacher', 'curator') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.teacher_can_set_student_hsk(v_me, p_student_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET hsk_level = p_level
  WHERE id = p_student_id AND role = 'student';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_student_hsk_level(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_student_hsk_level(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_student_hsk_goal(p_student_id uuid, p_goal integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_goal IS NOT NULL AND (p_goal < 1 OR p_goal > 5) THEN
    RAISE EXCEPTION 'invalid goal';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_me;
  IF v_role IS NULL OR v_role NOT IN ('teacher', 'curator') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.teacher_can_set_student_hsk(v_me, p_student_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET hsk_goal = p_goal
  WHERE id = p_student_id AND role = 'student';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_student_hsk_goal(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_student_hsk_goal(uuid, integer) TO authenticated;

-- Обновить кэш схемы PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
