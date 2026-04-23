import { NextRequest, NextResponse } from "next/server"
import { LOW_BALANCE_THRESHOLD } from "@/lib/billing"
import { getStudentLessonsLeft } from "@/lib/billing-server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ProfileLite = {
  id: string
  role: "student" | "teacher" | "curator"
}

type OrderRow = {
  id: string
  status: "pending" | "paid" | "canceled" | "failed"
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order_id")?.trim() ?? ""
  if (!orderId) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 })
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

  const { data: order, error: orderError } = await supabase
    .from("payment_orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("student_id", me.id)
    .maybeSingle<OrderRow>()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 })
  }
  if (!order) {
    return NextResponse.json({ error: "Payment order not found" }, { status: 404 })
  }

  try {
    const lessonsLeft = await getStudentLessonsLeft(supabase, me.id)
    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      lessonsLeft,
      lowBalance: lessonsLeft <= LOW_BALANCE_THRESHOLD,
      blocked: lessonsLeft <= 0
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load order status" },
      { status: 400 }
    )
  }
}

