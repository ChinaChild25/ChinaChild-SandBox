BEGIN;

UPDATE public.balance_ledger
SET description = CASE description
  WHEN 'Late cancellation charged' THEN 'Поздняя отмена засчитана'
  WHEN 'Lesson completed' THEN 'Занятие проведено'
  WHEN 'Lesson charge reversed after slot removal' THEN 'Списание отменено после удаления занятия'
  WHEN 'Lesson charge moved to another student' THEN 'Списание перенесено на другого ученика'
  WHEN 'Lesson charge reversed after status change' THEN 'Списание отменено после изменения статуса'
  WHEN 'YooKassa payment credited' THEN 'Оплата через ЮKassa подтверждена'
  ELSE description
END
WHERE description IN (
  'Late cancellation charged',
  'Lesson completed',
  'Lesson charge reversed after slot removal',
  'Lesson charge moved to another student',
  'Lesson charge reversed after status change',
  'YooKassa payment credited'
);

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
            THEN 'Поздняя отмена засчитана'
          ELSE 'Занятие проведено'
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
        'Списание отменено после удаления занятия',
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
        'Списание перенесено на другого ученика',
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
            THEN 'Поздняя отмена засчитана'
          ELSE 'Занятие проведено'
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
          THEN 'Поздняя отмена засчитана'
        ELSE 'Занятие проведено'
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
      'Списание отменено после изменения статуса',
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
    'Оплата через ЮKassa подтверждена',
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

COMMIT;
