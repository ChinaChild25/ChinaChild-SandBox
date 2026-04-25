-- Personal billing tariff per student.
-- Keeps package rows in lesson_packages, but generates a clean 8 / 16 / 32 module set
-- from a single per-student base tariff.

ALTER TABLE public.lesson_packages
  ADD COLUMN IF NOT EXISTS reschedule_notice_hours integer NOT NULL DEFAULT 24
  CHECK (reschedule_notice_hours BETWEEN 1 AND 168);

CREATE TABLE IF NOT EXISTS public.student_billing_profiles (
  student_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  tariff_name text NULL,
  module_price_rub numeric(12,2) NOT NULL CHECK (module_price_rub > 0),
  module_lessons integer NOT NULL DEFAULT 8 CHECK (module_lessons > 0),
  default_notice_hours integer NOT NULL DEFAULT 24 CHECK (default_notice_hours BETWEEN 1 AND 168),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_student_billing_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_student_billing_profiles_updated_at ON public.student_billing_profiles;
CREATE TRIGGER on_student_billing_profiles_updated_at
  BEFORE UPDATE ON public.student_billing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_student_billing_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.sync_student_billing_packages(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.student_billing_profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.student_billing_profiles
  WHERE student_id = p_student_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.lesson_packages (
    id,
    title,
    description,
    student_id,
    price_rub,
    paid_lessons,
    bonus_lessons,
    is_active,
    sort_order,
    reschedule_notice_hours
  )
  VALUES
    (
      format('student-billing:%s:8', p_student_id::text),
      '8 занятий',
      COALESCE(v_profile.tariff_name, 'Персональный тариф ученика'),
      p_student_id,
      v_profile.module_price_rub,
      8,
      0,
      true,
      10,
      v_profile.default_notice_hours
    ),
    (
      format('student-billing:%s:16', p_student_id::text),
      '16 занятий',
      COALESCE(v_profile.tariff_name, 'Персональный тариф ученика'),
      p_student_id,
      v_profile.module_price_rub * 2,
      16,
      0,
      true,
      20,
      v_profile.default_notice_hours
    ),
    (
      format('student-billing:%s:32', p_student_id::text),
      '32 занятия',
      COALESCE(v_profile.tariff_name, 'Персональный тариф ученика'),
      p_student_id,
      v_profile.module_price_rub * 4,
      32,
      0,
      true,
      30,
      v_profile.default_notice_hours
    )
  ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title,
        description = EXCLUDED.description,
        student_id = EXCLUDED.student_id,
        price_rub = EXCLUDED.price_rub,
        paid_lessons = EXCLUDED.paid_lessons,
        bonus_lessons = EXCLUDED.bonus_lessons,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        reschedule_notice_hours = EXCLUDED.reschedule_notice_hours,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_billing_packages(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_student_billing_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_student_billing_packages(NEW.student_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_student_billing_profile_sync() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_student_billing_profile_sync_packages ON public.student_billing_profiles;
CREATE TRIGGER on_student_billing_profile_sync_packages
  AFTER INSERT OR UPDATE ON public.student_billing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_student_billing_profile_sync();

ALTER TABLE public.student_billing_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_billing_profiles_select_own_or_staff" ON public.student_billing_profiles;
CREATE POLICY "student_billing_profiles_select_own_or_staff"
  ON public.student_billing_profiles
  FOR SELECT
  TO authenticated
  USING (public.auth_can_read_student_billing(student_id));

GRANT SELECT ON public.student_billing_profiles TO authenticated;
