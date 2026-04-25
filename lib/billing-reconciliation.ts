import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { BillingOrderStatus } from "@/lib/billing"
import { coerceRub } from "@/lib/billing-server"
import { fetchYooKassaPayment, type YooKassaPayment } from "@/lib/yookassa"

type PaymentOrderAdminRow = {
  id: string
  student_id: string
  package_id: string
  amount_rub: number | string
  lessons_to_credit: number
  status: BillingOrderStatus
  yookassa_payment_id: string | null
  yookassa_status: string | null
}

function normalizeMetadataValue(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function paymentAmountMatches(order: PaymentOrderAdminRow, payment: YooKassaPayment) {
  return coerceRub(order.amount_rub).toFixed(2) === coerceRub(payment.amount?.value).toFixed(2)
}

function paymentMetadataMatches(order: PaymentOrderAdminRow, payment: YooKassaPayment) {
  const internalOrderId = normalizeMetadataValue(payment.metadata?.internal_order_id)
  const studentId = normalizeMetadataValue(payment.metadata?.student_id)
  const packageId = normalizeMetadataValue(payment.metadata?.package_id)
  const lessonsToCredit = Number.parseInt(normalizeMetadataValue(payment.metadata?.lessons_to_credit), 10)

  if (!internalOrderId || !studentId || !packageId || !Number.isFinite(lessonsToCredit)) {
    return false
  }

  return (
    internalOrderId === order.id &&
    studentId === order.student_id &&
    packageId === order.package_id &&
    lessonsToCredit === order.lessons_to_credit &&
    paymentAmountMatches(order, payment)
  )
}

async function getPaymentOrderById(orderId: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from("payment_orders")
    .select("id, student_id, package_id, amount_rub, lessons_to_credit, status, yookassa_payment_id, yookassa_status")
    .eq("id", orderId)
    .maybeSingle<PaymentOrderAdminRow>()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Payment order not found")
  return data
}

export async function reconcilePaymentOrderById(orderId: string): Promise<{ status: BillingOrderStatus; credited: boolean }> {
  const admin = createAdminSupabaseClient()
  const order = await getPaymentOrderById(orderId)

  if (!order.yookassa_payment_id || order.status === "paid" || order.status === "failed") {
    return { status: order.status, credited: false }
  }

  const payment = await fetchYooKassaPayment(order.yookassa_payment_id)

  if (payment.status === "succeeded" && payment.paid === true) {
    if (!paymentMetadataMatches(order, payment)) {
      throw new Error("Payment metadata mismatch")
    }

    const { data: credited, error } = await admin.rpc("mark_payment_order_paid", {
      p_order_id: order.id,
      p_yookassa_payment_id: payment.id,
      p_yookassa_status: payment.status,
      p_raw_notification: {
        source: "order-status-poll",
        event: "payment.succeeded",
        object: { id: payment.id }
      },
      p_raw_payment: payment
    })

    if (error) throw new Error(error.message)
    return { status: "paid", credited: Boolean(credited) }
  }

  if (payment.status === "canceled") {
    const { error } = await admin
      .from("payment_orders")
      .update({
        status: "canceled",
        yookassa_status: payment.status,
        raw_notification: {
          source: "order-status-poll",
          event: "payment.canceled",
          object: { id: payment.id }
        },
        raw_payment: payment,
        canceled_at: new Date().toISOString(),
        latest_error: null
      })
      .eq("id", order.id)
      .neq("status", "paid")

    if (error) throw new Error(error.message)
    return { status: "canceled", credited: false }
  }

  const { error } = await admin
    .from("payment_orders")
    .update({
      yookassa_status: payment.status,
      raw_payment: payment,
      latest_error: null
    })
    .eq("id", order.id)

  if (error) throw new Error(error.message)
  return { status: order.status, credited: false }
}

export async function reconcilePendingPaymentOrdersForStudent(studentId: string, limit = 5) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from("payment_orders")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "pending")
    .not("yookassa_payment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Array<{ id: string }>>()

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    try {
      await reconcilePaymentOrderById(row.id)
    } catch {
      // Best-effort reconciliation. Summary should still render even if YooKassa is temporarily unavailable.
    }
  }
}
