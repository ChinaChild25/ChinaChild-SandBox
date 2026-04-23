import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { coerceRub } from "@/lib/billing-server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createYooKassaPayment } from "@/lib/yookassa"

type Body = {
  package_id?: string
}

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
}

type PackageRow = {
  id: string
  title: string
  description: string | null
  price_rub: number | string
  paid_lessons: number
  bonus_lessons: number
}

type PaymentOrderInsert = {
  id: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null
  const packageId = body?.package_id?.trim() ?? ""
  if (!packageId) {
    return NextResponse.json({ error: "package_id is required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileLite>()
  if (meError || !me || me.role !== "student") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 })
  }

  const { data: pkg, error: packageError } = await supabase
    .from("lesson_packages")
    .select("id, title, description, price_rub, paid_lessons, bonus_lessons")
    .eq("id", packageId)
    .eq("is_active", true)
    .or(`student_id.is.null,student_id.eq.${me.id}`)
    .maybeSingle<PackageRow>()

  if (packageError) return NextResponse.json({ error: packageError.message }, { status: 400 })
  if (!pkg) return NextResponse.json({ error: "Lesson package not found" }, { status: 404 })

  const amountRub = coerceRub(pkg.price_rub)
  const lessonsToCredit = pkg.paid_lessons + pkg.bonus_lessons

  const { data: order, error: orderInsertError } = await supabase
    .from("payment_orders")
    .insert({
      student_id: me.id,
      package_id: pkg.id,
      package_title: pkg.title,
      amount_rub: amountRub,
      lessons_to_credit: lessonsToCredit,
      status: "pending"
    })
    .select("id")
    .maybeSingle<PaymentOrderInsert>()

  if (orderInsertError || !order) {
    return NextResponse.json(
      { error: orderInsertError?.message ?? "Failed to create internal payment order" },
      { status: 400 }
    )
  }

  try {
    const payment = await createYooKassaPayment({
      amountRub,
      description: `${pkg.title} - ${lessonsToCredit} lessons`,
      idempotenceKey: randomUUID(),
      metadata: {
        internal_order_id: order.id,
        student_id: me.id,
        package_id: pkg.id,
        lessons_to_credit: String(lessonsToCredit)
      }
    })

    const confirmationToken = payment.confirmation?.confirmation_token?.trim() ?? ""
    if (!payment.id || !confirmationToken) {
      throw new Error("YooKassa did not return payment id or confirmation token")
    }

    const { error: updateOrderError } = await supabase
      .from("payment_orders")
      .update({
        yookassa_payment_id: payment.id,
        yookassa_status: payment.status,
        raw_payment: payment,
        latest_error: null
      })
      .eq("id", order.id)

    if (updateOrderError) {
      throw new Error(updateOrderError.message)
    }

    return NextResponse.json({
      orderId: order.id,
      confirmationToken
    })
  } catch (error) {
    await supabase
      .from("payment_orders")
      .update({
        status: "failed",
        latest_error: error instanceof Error ? error.message : "YooKassa payment creation failed"
      })
      .eq("id", order.id)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create YooKassa payment" },
      { status: 502 }
    )
  }
}

