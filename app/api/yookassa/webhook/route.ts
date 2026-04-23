import { NextResponse } from "next/server"
import { coerceRub } from "@/lib/billing-server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { fetchYooKassaPayment, type YooKassaPayment } from "@/lib/yookassa"

type YooKassaWebhookPayload = {
  event?: string
  object?: {
    id?: string
  }
}

type PaymentOrderRow = {
  id: string
  student_id: string
  package_id: string
  amount_rub: number | string
  lessons_to_credit: number
  status: "pending" | "paid" | "canceled" | "failed"
  yookassa_payment_id: string | null
}

function normalizeMetadataValue(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function paymentAmountMatches(order: PaymentOrderRow, payment: YooKassaPayment): boolean {
  return coerceRub(order.amount_rub).toFixed(2) === coerceRub(payment.amount?.value).toFixed(2)
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as YooKassaWebhookPayload | null
  const event = payload?.event?.trim() ?? ""
  const paymentId = payload?.object?.id?.trim() ?? ""

  if (!event || !paymentId) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  let payment: YooKassaPayment
  try {
    payment = await fetchYooKassaPayment(paymentId)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch payment from YooKassa" },
      { status: 502 }
    )
  }

  const admin = createAdminSupabaseClient()

  if (event === "payment.succeeded") {
    const internalOrderId = normalizeMetadataValue(payment.metadata?.internal_order_id)
    const studentId = normalizeMetadataValue(payment.metadata?.student_id)
    const packageId = normalizeMetadataValue(payment.metadata?.package_id)
    const lessonsToCredit = Number.parseInt(normalizeMetadataValue(payment.metadata?.lessons_to_credit), 10)

    if (!internalOrderId || !studentId || !packageId || !Number.isFinite(lessonsToCredit)) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing metadata" })
    }
    if (payment.status !== "succeeded" || payment.paid !== true) {
      return NextResponse.json({ ok: true, ignored: true, reason: "payment not settled" })
    }

    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select("id, student_id, package_id, amount_rub, lessons_to_credit, status, yookassa_payment_id")
      .eq("id", internalOrderId)
      .maybeSingle<PaymentOrderRow>()

    if (orderError) {
      return NextResponse.json({ ok: false, error: orderError.message }, { status: 400 })
    }
    if (!order) {
      return NextResponse.json({ ok: true, ignored: true, reason: "order not found" })
    }

    const metadataMatches =
      order.student_id === studentId &&
      order.package_id === packageId &&
      order.lessons_to_credit === lessonsToCredit &&
      (!order.yookassa_payment_id || order.yookassa_payment_id === payment.id) &&
      paymentAmountMatches(order, payment)

    if (!metadataMatches) {
      return NextResponse.json({ ok: false, error: "Payment metadata mismatch" }, { status: 409 })
    }

    const { data: credited, error: creditError } = await admin.rpc("mark_payment_order_paid", {
      p_order_id: order.id,
      p_yookassa_payment_id: payment.id,
      p_yookassa_status: payment.status,
      p_raw_notification: payload,
      p_raw_payment: payment
    })

    if (creditError) {
      return NextResponse.json({ ok: false, error: creditError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, credited: Boolean(credited) })
  }

  if (event === "payment.canceled") {
    const internalOrderId = normalizeMetadataValue(payment.metadata?.internal_order_id)

    let orderQuery = admin
      .from("payment_orders")
      .update({
        status: "canceled",
        yookassa_status: payment.status,
        raw_notification: payload,
        raw_payment: payment,
        canceled_at: new Date().toISOString()
      })
      .neq("status", "paid")

    if (internalOrderId) {
      orderQuery = orderQuery.eq("id", internalOrderId)
    } else {
      orderQuery = orderQuery.eq("yookassa_payment_id", payment.id)
    }

    const { error: cancelError } = await orderQuery
    if (cancelError) {
      return NextResponse.json({ ok: false, error: cancelError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, canceled: true })
  }

  return NextResponse.json({ ok: true, ignored: true })
}

