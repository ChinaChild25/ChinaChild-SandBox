import type { SupabaseClient } from "@supabase/supabase-js"
import {
  LOW_BALANCE_THRESHOLD,
  type BillingLedgerItem,
  type BillingPackage,
  type BillingPaymentOrder,
  type StudentBillingSummary
} from "@/lib/billing"

type BalanceRow = {
  lessons_left: number | null
}

type PackageRow = {
  id: string
  title: string
  description: string | null
  price_rub: number | string
  paid_lessons: number
  bonus_lessons: number
}

type LedgerRow = {
  id: string
  created_at: string
  entry_kind: BillingLedgerItem["entryKind"]
  lessons_delta: number
  description: string
  lesson_date_key: string | null
  lesson_time: string | null
}

type PaymentOrderRow = {
  id: string
  package_id: string
  package_title: string
  amount_rub: number | string
  lessons_to_credit: number
  status: BillingPaymentOrder["status"]
  created_at: string
  paid_at: string | null
}

export function coerceRub(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getStudentLessonsLeft(
  supabase: SupabaseClient,
  studentId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("student_balances")
    .select("lessons_left")
    .eq("student_id", studentId)
    .maybeSingle<BalanceRow>()

  if (error) throw new Error(error.message)
  return Number(data?.lessons_left ?? 0)
}

export async function getStudentBalanceState(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ lessonsLeft: number; lowBalance: boolean; blocked: boolean }> {
  const lessonsLeft = await getStudentLessonsLeft(supabase, studentId)
  return {
    lessonsLeft,
    lowBalance: lessonsLeft <= LOW_BALANCE_THRESHOLD,
    blocked: lessonsLeft <= 0
  }
}

export async function getStudentBillingSummary(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentBillingSummary> {
  const [{ data: balanceRow, error: balanceError }, { data: packageRows, error: packageError }, { data: ledgerRows, error: ledgerError }, { data: orderRows, error: orderError }] =
    await Promise.all([
      supabase.from("student_balances").select("lessons_left").eq("student_id", studentId).maybeSingle<BalanceRow>(),
      supabase
        .from("lesson_packages")
        .select("id, title, description, price_rub, paid_lessons, bonus_lessons")
        .or(`student_id.is.null,student_id.eq.${studentId}`)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .returns<PackageRow[]>(),
      supabase
        .from("balance_ledger")
        .select("id, created_at, entry_kind, lessons_delta, description, lesson_date_key, lesson_time")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<LedgerRow[]>(),
      supabase
        .from("payment_orders")
        .select("id, package_id, package_title, amount_rub, lessons_to_credit, status, created_at, paid_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<PaymentOrderRow[]>()
    ])

  if (balanceError) throw new Error(balanceError.message)
  if (packageError) throw new Error(packageError.message)
  if (ledgerError) throw new Error(ledgerError.message)
  if (orderError) throw new Error(orderError.message)

  const lessonsLeft = Number(balanceRow?.lessons_left ?? 0)

  const packages: BillingPackage[] = (packageRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priceRub: coerceRub(row.price_rub),
    paidLessons: row.paid_lessons,
    bonusLessons: row.bonus_lessons,
    totalLessons: row.paid_lessons + row.bonus_lessons
  }))

  const ledger: BillingLedgerItem[] = (ledgerRows ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    entryKind: row.entry_kind,
    lessonsDelta: row.lessons_delta,
    description: row.description,
    lessonDateKey: row.lesson_date_key,
    lessonTime: row.lesson_time
  }))

  const paymentOrders: BillingPaymentOrder[] = (orderRows ?? []).map((row) => ({
    id: row.id,
    packageId: row.package_id,
    packageTitle: row.package_title,
    amountRub: coerceRub(row.amount_rub),
    lessonsToCredit: row.lessons_to_credit,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at
  }))

  const balanceState = {
    lessonsLeft,
    lowBalance: lessonsLeft <= LOW_BALANCE_THRESHOLD,
    blocked: lessonsLeft <= 0
  }

  return {
    ...balanceState,
    packages,
    ledger,
    paymentOrders
  }
}
