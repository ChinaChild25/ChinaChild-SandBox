-- Цель HSK (1–5): меняют и преподаватель (RPC), и сам ученик (UPDATE своей строки profiles).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hsk_goal smallint;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_hsk_goal_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_hsk_goal_range
  CHECK (hsk_goal IS NULL OR (hsk_goal >= 1 AND hsk_goal <= 5));

COMMENT ON COLUMN public.profiles.hsk_goal IS 'Цель экзамена HSK 1–5; ученик и преподаватель (через RPC).';

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
