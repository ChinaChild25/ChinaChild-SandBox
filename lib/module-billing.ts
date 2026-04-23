export const MODULE_BILLING_KEY = "chinachild-module-billing"

export const MODULE_LESSONS_TOTAL = 8
export const MODULE_PRICE_RUB = 15990

export type BillingLedgerKind = "payment" | "lesson"

export type BillingLedgerEntry = {
  id: string
  at: string
  kind: BillingLedgerKind
  /** Для kind === "payment" */
  amountRub?: number
  /** Для kind === "lesson" — порядковый номер занятия в модуле */
  lessonNumber?: number
}

export type ModuleBillingState = {
  lessonsConsumed: number
  balanceRub: number
  ledger: BillingLedgerEntry[]
}

function seedBillingState(): ModuleBillingState {
  const lessonsConsumed = 3
  return {
    lessonsConsumed,
    balanceRub: 0,
    ledger: [
      {
        id: "b-seed-pay",
        at: "2026-03-01T10:00:00.000Z",
        kind: "payment",
        amountRub: MODULE_PRICE_RUB
      },
      {
        id: "b-seed-l1",
        at: "2026-03-05T16:30:00.000Z",
        kind: "lesson",
        lessonNumber: 1
      },
      {
        id: "b-seed-l2",
        at: "2026-03-12T16:30:00.000Z",
        kind: "lesson",
        lessonNumber: 2
      },
      {
        id: "b-seed-l3",
        at: "2026-03-19T16:30:00.000Z",
        kind: "lesson",
        lessonNumber: 3
      }
    ]
  }
}

function clampLessons(n: number): number {
  return Math.max(0, Math.min(MODULE_LESSONS_TOTAL, Math.floor(Number.isFinite(n) ? n : 0)))
}

export function readModuleBilling(): ModuleBillingState {
  if (typeof window === "undefined") return seedBillingState()
  try {
    const raw = window.localStorage.getItem(MODULE_BILLING_KEY)
    if (!raw) {
      const initial = seedBillingState()
      persistModuleBilling(initial)
      return initial
    }
    const p = JSON.parse(raw) as Partial<ModuleBillingState>
    const lessonsConsumed = clampLessons(p.lessonsConsumed ?? 0)
    const balanceRub = typeof p.balanceRub === "number" && Number.isFinite(p.balanceRub) ? Math.max(0, p.balanceRub) : 0
    const ledger = Array.isArray(p.ledger) ? p.ledger.filter(isValidLedgerEntry) : []
    if (ledger.length === 0 && lessonsConsumed === 0 && balanceRub === 0) return seedBillingState()
    return { lessonsConsumed, balanceRub, ledger }
  } catch {
    return seedBillingState()
  }
}

function isValidLedgerEntry(x: unknown): x is BillingLedgerEntry {
  if (!x || typeof x !== "object") return false
  const e = x as BillingLedgerEntry
  return (
    typeof e.id === "string" &&
    typeof e.at === "string" &&
    (e.kind === "payment" || e.kind === "lesson")
  )
}

export function persistModuleBilling(state: ModuleBillingState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MODULE_BILLING_KEY, JSON.stringify(state))
}

/** URL оплаты через ЮKassa (страница оплаты выдаётся бэкендом). */
export function getYooKassaPaymentUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_YOOKASSA_PAYMENT_URL) {
    return process.env.NEXT_PUBLIC_YOOKASSA_PAYMENT_URL
  }
  return "https://yookassa.ru/"
}
