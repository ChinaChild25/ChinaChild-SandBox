-- Lesson-balance billing with YooKassa-backed payment orders.
-- Source of truth:
-- - lesson_packages: what can be purchased
-- - payment_orders: internal order state tied to YooKassa payment id
-- - balance_ledger: immutable credits/debits/reversals
-- - student_balances: cached current lessons_left per student

CREATE TABLE IF NOT EXISTS public.lesson_packages (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NULL,
  student_id uuid NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  price_rub numeric(12,2) NOT NULL CHECK (price_rub >= 0),
  paid_lessons integer NOT NULL CHECK (paid_lessons > 0),
  bonus_lessons integer NOT NULL DEFAULT 0 CHECK (bonus_lessons >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_packages_student_id_idx
  ON public.lesson_packages (student_id, is_active, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_balances (
  student_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  lessons_left integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  package_id text NOT NULL REFERENCES public.lesson_packages (id) ON DELETE RESTRICT,
  package_title text NOT NULL,
  amount_rub numeric(12,2) NOT NULL CHECK (amount_rub >= 0),
  lessons_to_credit integer NOT NULL CHECK (lessons_to_credit > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled', 'failed')),
  yookassa_payment_id text NULL UNIQUE,
  yookassa_status text NULL,
  latest_error text NULL,
  raw_notification jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payment jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz NULL,
  canceled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_orders_student_created_idx
  ON public.payment_orders (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_orders_status_created_idx
  ON public.payment_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.balance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  entry_kind text NOT NULL CHECK (entry_kind IN ('payment_credit', 'lesson_debit', 'lesson_reversal', 'manual_adjustment')),
  lessons_delta integer NOT NULL CHECK (lessons_delta <> 0),
  description text NOT NULL,
  payment_order_id uuid NULL UNIQUE REFERENCES public.payment_orders (id) ON DELETE SET NULL,
  schedule_slot_id uuid NULL REFERENCES public.student_schedule_slots (id) ON DELETE SET NULL,
  lesson_date_key date NULL,
  lesson_time text NULL CHECK (lesson_time IS NULL OR lesson_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  lesson_status_before text NULL,
  lesson_status_after text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS balance_ledger_student_created_idx
  ON public.balance_ledger (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS balance_ledger_schedule_slot_idx
  ON public.balance_ledger (schedule_slot_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_lesson_packages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_student_balances_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_payment_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lesson_packages_updated_at ON public.lesson_packages;
CREATE TRIGGER on_lesson_packages_updated_at
  BEFORE UPDATE ON public.lesson_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lesson_packages_updated_at();

DROP TRIGGER IF EXISTS on_student_balances_updated_at ON public.student_balances;
CREATE TRIGGER on_student_balances_updated_at
  BEFORE UPDATE ON public.student_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_student_balances_updated_at();

DROP TRIGGER IF EXISTS on_payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER on_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_orders_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_read_student_billing(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() = p_student_id
    OR public.auth_can_teacher_manage_student(p_student_id)
    OR public.auth_is_curator();
$$;

REVOKE ALL ON FUNCTION public.auth_can_read_student_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_read_student_billing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lesson_status_is_billable(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(lower(trim(p_status)), '') IN ('completed', 'charged_absence', 'late_cancel');
$$;

CREATE OR REPLACE FUNCTION public.record_balance_ledger_entry(
  p_student_id uuid,
  p_entry_kind text,
  p_lessons_delta integer,
  p_description text,
  p_payment_order_id uuid DEFAULT NULL,
  p_schedule_slot_id uuid DEFAULT NULL,
  p_lesson_date_key date DEFAULT NULL,
  p_lesson_time text DEFAULT NULL,
  p_lesson_status_before text DEFAULT NULL,
  p_lesson_status_after text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_lessons_delta = 0 THEN
    RAISE EXCEPTION 'lessons delta cannot be zero';
  END IF;

  INSERT INTO public.balance_ledger (
    student_id,
    entry_kind,
    lessons_delta,
    description,
    payment_order_id,
    schedule_slot_id,
    lesson_date_key,
    lesson_time,
    lesson_status_before,
    lesson_status_after,
    metadata
  )
  VALUES (
    p_student_id,
    p_entry_kind,
    p_lessons_delta,
    p_description,
    p_payment_order_id,
    p_schedule_slot_id,
    p_lesson_date_key,
    p_lesson_time,
    p_lesson_status_before,
    p_lesson_status_after,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.student_balances (student_id, lessons_left)
  VALUES (p_student_id, p_lessons_delta)
  ON CONFLICT (student_id) DO UPDATE
    SET lessons_left = public.student_balances.lessons_left + EXCLUDED.lessons_left,
        updated_at = now();

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_balance_ledger_entry(uuid, text, integer, text, uuid, uuid, date, text, text, text, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_billing_for_student_schedule_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_billable boolean;
  v_new_billable boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.lesson_status_is_billable(NEW.type) THEN
      PERFORM public.record_balance_ledger_entry(
        NEW.student_id,
        'lesson_debit',
        -1,
        CASE
          WHEN lower(trim(COALESCE(NEW.type, ''))) IN ('charged_absence', 'late_cancel')
            THEN 'Late cancellation charged'
          ELSE 'Lesson completed'
        END,
        NULL,
        NEW.id,
        NEW.date_key,
        NEW.time,
        NULL,
        NEW.type,
        jsonb_build_object('source', 'student_schedule_slots')
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF public.lesson_status_is_billable(OLD.type) THEN
      PERFORM public.record_balance_ledger_entry(
        OLD.student_id,
        'lesson_reversal',
        1,
        'Lesson charge reversed after slot removal',
        NULL,
        OLD.id,
        OLD.date_key,
        OLD.time,
        OLD.type,
        NULL,
        jsonb_build_object('source', 'student_schedule_slots')
      );
    END IF;
    RETURN OLD;
  END IF;

  v_old_billable := public.lesson_status_is_billable(OLD.type);
  v_new_billable := public.lesson_status_is_billable(NEW.type);

  IF OLD.student_id IS DISTINCT FROM NEW.student_id THEN
    IF v_old_billable THEN
      PERFORM public.record_balance_ledger_entry(
        OLD.student_id,
        'lesson_reversal',
        1,
        'Lesson charge moved to another student',
        NULL,
        OLD.id,
        OLD.date_key,
        OLD.time,
        OLD.type,
        NEW.type,
        jsonb_build_object('source', 'student_schedule_slots')
      );
    END IF;

    IF v_new_billable THEN
      PERFORM public.record_balance_ledger_entry(
        NEW.student_id,
        'lesson_debit',
        -1,
        CASE
          WHEN lower(trim(COALESCE(NEW.type, ''))) IN ('charged_absence', 'late_cancel')
            THEN 'Late cancellation charged'
          ELSE 'Lesson completed'
        END,
        NULL,
        NEW.id,
        NEW.date_key,
        NEW.time,
        OLD.type,
        NEW.type,
        jsonb_build_object('source', 'student_schedule_slots')
      );
    END IF;

    RETURN NEW;
  END IF;

  IF NOT v_old_billable AND v_new_billable THEN
    PERFORM public.record_balance_ledger_entry(
      NEW.student_id,
      'lesson_debit',
      -1,
      CASE
        WHEN lower(trim(COALESCE(NEW.type, ''))) IN ('charged_absence', 'late_cancel')
          THEN 'Late cancellation charged'
        ELSE 'Lesson completed'
      END,
      NULL,
      NEW.id,
      NEW.date_key,
      NEW.time,
      OLD.type,
      NEW.type,
      jsonb_build_object('source', 'student_schedule_slots')
    );
  ELSIF v_old_billable AND NOT v_new_billable THEN
    PERFORM public.record_balance_ledger_entry(
      NEW.student_id,
      'lesson_reversal',
      1,
      'Lesson charge reversed after status change',
      NULL,
      NEW.id,
      NEW.date_key,
      NEW.time,
      OLD.type,
      NEW.type,
      jsonb_build_object('source', 'student_schedule_slots')
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_billing_for_student_schedule_slot() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_student_schedule_slots_sync_billing ON public.student_schedule_slots;
CREATE TRIGGER on_student_schedule_slots_sync_billing
  AFTER INSERT OR UPDATE OR DELETE ON public.student_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_billing_for_student_schedule_slot();

CREATE OR REPLACE FUNCTION public.mark_payment_order_paid(
  p_order_id uuid,
  p_yookassa_payment_id text,
  p_yookassa_status text DEFAULT 'succeeded',
  p_raw_notification jsonb DEFAULT '{}'::jsonb,
  p_raw_payment jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM public.payment_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment order not found';
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN false;
  END IF;

  IF v_order.status = 'canceled' THEN
    RETURN false;
  END IF;

  IF v_order.yookassa_payment_id IS NOT NULL AND p_yookassa_payment_id IS NOT NULL AND v_order.yookassa_payment_id <> p_yookassa_payment_id THEN
    RAISE EXCEPTION 'payment id mismatch';
  END IF;

  UPDATE public.payment_orders
  SET status = 'paid',
      yookassa_payment_id = COALESCE(v_order.yookassa_payment_id, p_yookassa_payment_id),
      yookassa_status = p_yookassa_status,
      raw_notification = COALESCE(p_raw_notification, '{}'::jsonb),
      raw_payment = COALESCE(p_raw_payment, '{}'::jsonb),
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = p_order_id;

  IF EXISTS (
    SELECT 1
    FROM public.balance_ledger
    WHERE payment_order_id = p_order_id
  ) THEN
    RETURN false;
  END IF;

  PERFORM public.record_balance_ledger_entry(
    v_order.student_id,
    'payment_credit',
    v_order.lessons_to_credit,
    'YooKassa payment credited',
    v_order.id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'package_id', v_order.package_id,
      'package_title', v_order.package_title,
      'yookassa_payment_id', COALESCE(v_order.yookassa_payment_id, p_yookassa_payment_id),
      'yookassa_status', p_yookassa_status
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_order_paid(uuid, text, text, jsonb, jsonb) FROM PUBLIC;

ALTER TABLE public.lesson_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_packages_select_for_students" ON public.lesson_packages;
CREATE POLICY "lesson_packages_select_for_students"
  ON public.lesson_packages
  FOR SELECT
  TO authenticated
  USING (
    is_active
    AND (
      student_id IS NULL
      OR student_id = auth.uid()
      OR public.auth_can_teacher_manage_student(student_id)
      OR public.auth_is_curator()
    )
  );

DROP POLICY IF EXISTS "student_balances_select_own_or_staff" ON public.student_balances;
CREATE POLICY "student_balances_select_own_or_staff"
  ON public.student_balances
  FOR SELECT
  TO authenticated
  USING (public.auth_can_read_student_billing(student_id));

DROP POLICY IF EXISTS "payment_orders_select_own_or_staff" ON public.payment_orders;
CREATE POLICY "payment_orders_select_own_or_staff"
  ON public.payment_orders
  FOR SELECT
  TO authenticated
  USING (public.auth_can_read_student_billing(student_id));

DROP POLICY IF EXISTS "payment_orders_insert_own" ON public.payment_orders;
CREATE POLICY "payment_orders_insert_own"
  ON public.payment_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "payment_orders_update_own" ON public.payment_orders;
CREATE POLICY "payment_orders_update_own"
  ON public.payment_orders
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "balance_ledger_select_own_or_staff" ON public.balance_ledger;
CREATE POLICY "balance_ledger_select_own_or_staff"
  ON public.balance_ledger
  FOR SELECT
  TO authenticated
  USING (public.auth_can_read_student_billing(student_id));

GRANT SELECT ON public.lesson_packages TO authenticated;
GRANT SELECT ON public.student_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO authenticated;
GRANT SELECT ON public.balance_ledger TO authenticated;
