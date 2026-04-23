-- Уровень HSK (0–5), выставляет только преподаватель (или куратор с доступом к ученику).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hsk_level smallint;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_hsk_level_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_hsk_level_range
  CHECK (hsk_level IS NULL OR (hsk_level >= 0 AND hsk_level <= 5));

COMMENT ON COLUMN public.profiles.hsk_level IS 'Уровень HSK 0–5; задаёт преподаватель, ученик не меняет сам.';

-- Доступ: закреплённый учитель или запись в слотах этого преподавателя.
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

-- Ученик не может менять свой hsk_level через обычный UPDATE профиля.
CREATE OR REPLACE FUNCTION public.profiles_block_student_hsk_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.role = 'student'
     AND NEW.id = auth.uid()
     AND NEW.hsk_level IS DISTINCT FROM OLD.hsk_level THEN
    RAISE EXCEPTION 'hsk_level is read-only for students'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_student_hsk_self_update ON public.profiles;
CREATE TRIGGER profiles_block_student_hsk_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_student_hsk_self_update();
