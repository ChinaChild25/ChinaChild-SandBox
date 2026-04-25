export const LOW_BALANCE_THRESHOLD = 2

export type BillingPackage = {
  id: string
  title: string
  description: string | null
  priceRub: number
  paidLessons: number
  bonusLessons: number
  totalLessons: number
  noticeHours: number
  isPersonal: boolean
}

export type StudentBillingTariffProfile = {
  tariffName: string | null
  modulePriceRub: number
  moduleLessons: number
  defaultNoticeHours: number
}

export type BillingLedgerItem = {
  id: string
  createdAt: string
  entryKind: "payment_credit" | "lesson_debit" | "lesson_reversal" | "manual_adjustment"
  lessonsDelta: number
  description: string
  lessonDateKey: string | null
  lessonTime: string | null
}

export type BillingOrderStatus = "pending" | "paid" | "canceled" | "failed"

export type BillingPaymentOrder = {
  id: string
  packageId: string
  packageTitle: string
  amountRub: number
  lessonsToCredit: number
  status: BillingOrderStatus
  createdAt: string
  paidAt: string | null
}

export type StudentBillingSummary = {
  lessonsLeft: number
  lowBalance: boolean
  blocked: boolean
  tariffProfile: StudentBillingTariffProfile | null
  packages: BillingPackage[]
  ledger: BillingLedgerItem[]
  paymentOrders: BillingPaymentOrder[]
}

export function formatRub(amount: number, locale = "ru-RU"): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ₽`
}
