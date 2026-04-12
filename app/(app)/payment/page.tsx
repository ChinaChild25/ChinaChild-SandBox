"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, CreditCard, Receipt, Wallet } from "lucide-react"

import {
  getYooKassaPaymentUrl,
  MODULE_LESSONS_TOTAL,
  MODULE_PRICE_RUB,
  readModuleBilling,
  type BillingLedgerEntry,
  type ModuleBillingState
} from "@/lib/module-billing"
import { localeToBcp47, useUiLocale } from "@/lib/ui-locale"

function formatRub(locale: string, amount: number) {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)
  return `${n} ₽`
}

export default function PaymentPage() {
  const { t, locale } = useUiLocale()
  const [billing, setBilling] = useState<ModuleBillingState | null>(null)

  useEffect(() => {
    setBilling(readModuleBilling())
  }, [])

  const bcp47 = localeToBcp47(locale)
  const priceLabel = useMemo(() => formatRub(bcp47, MODULE_PRICE_RUB), [bcp47])

  const consumed = billing?.lessonsConsumed ?? 0
  const remaining = Math.max(0, MODULE_LESSONS_TOTAL - consumed)
  const pct = MODULE_LESSONS_TOTAL > 0 ? Math.round((consumed / MODULE_LESSONS_TOTAL) * 100) : 0
  const balanceRub = billing?.balanceRub ?? 0

  const sortedLedger = useMemo(() => {
    const list = [...(billing?.ledger ?? [])]
    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return list
  }, [billing?.ledger])

  const formatEntryDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(bcp47, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch {
      return iso
    }
  }

  const ledgerLabel = (e: BillingLedgerEntry) => {
    if (e.kind === "payment") return t("payment.ledgerPayment")
    return t("payment.ledgerLesson", { n: String(e.lessonNumber ?? "—") })
  }

  const ledgerAmount = (e: BillingLedgerEntry) => {
    if (e.kind === "payment" && e.amountRub != null) return `+${formatRub(bcp47, e.amountRub)}`
    if (e.kind === "lesson") return `−1 ${t("payment.ledgerLessonUnit")}`
    return "—"
  }

  const openYooKassa = () => {
    const url = getYooKassaPaymentUrl()
    window.open(url, "_blank", "noopener,noreferrer")
  }

  if (!billing) {
    return (
      <div className="ds-figma-page ds-payment-page ds-settings-page-bleed">
        <div className="ds-settings-v0-stack">
          <p className="text-[14px] text-ds-text-tertiary">{t("app.loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ds-figma-page ds-payment-page ds-settings-page-bleed">
      <div className="ds-settings-v0-stack">
        <header className="ds-settings-page-header">
          <h1 className="ds-settings-page-title">{t("payment.title")}</h1>
          <p className="ds-settings-page-lead">{t("payment.lead")}</p>
        </header>

        <div className="ds-settings-panels-grid">
          <section
            className="ds-settings-panel ds-payment-panel ds-payment-panel--neutral"
            aria-labelledby="payment-module-heading"
          >
            <h2 id="payment-module-heading" className="ds-settings-section-head">
              <BookOpen size={22} strokeWidth={1.75} aria-hidden />
              {t("payment.moduleSection")}
            </h2>
            <p className="mb-4 text-[12px] leading-snug text-ds-text-tertiary">{t("payment.moduleHint")}</p>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold text-ds-ink">
                {t("payment.progressLine", {
                  done: String(consumed),
                  total: String(MODULE_LESSONS_TOTAL)
                })}
              </span>
              <span className="text-[14px] text-ds-text-tertiary">
                {t("payment.remainingLine", { n: String(remaining) })}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-[#ebebeb] dark:bg-white/10"
              role="progressbar"
              aria-valuenow={consumed}
              aria-valuemin={0}
              aria-valuemax={MODULE_LESSONS_TOTAL}
              aria-label={t("payment.progressAria")}
            >
              <div
                className="h-full rounded-full bg-ds-sage-strong transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </section>

          <section
            className="ds-settings-panel ds-payment-panel ds-payment-panel--sage"
            aria-labelledby="payment-balance-heading"
          >
            <h2 id="payment-balance-heading" className="ds-settings-section-head">
              <Wallet size={22} strokeWidth={1.75} aria-hidden />
              {t("payment.balanceSection")}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] bg-white/70 px-4 py-3 dark:bg-black/25">
                <span className="text-[15px] text-ds-ink">{t("payment.balanceRub")}</span>
                <span className="text-[17px] font-semibold tabular-nums text-ds-ink">
                  {formatRub(bcp47, balanceRub)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-white/50 px-4 py-3 dark:border-white/15 dark:bg-black/20">
                <span className="text-[15px] text-ds-ink">{t("payment.deductedTitle")}</span>
                <span className="text-[17px] font-semibold tabular-nums text-ds-ink">
                  {t("payment.deductedCount", { n: String(consumed) })}
                </span>
              </div>
            </div>
          </section>

          <section
            className="ds-settings-panel ds-payment-panel ds-payment-panel--ink"
            aria-labelledby="payment-pay-heading"
          >
            <h2 id="payment-pay-heading" className="ds-settings-section-head">
              <CreditCard size={22} strokeWidth={1.75} aria-hidden />
              {t("payment.paySection")}
            </h2>
            <p className="ds-settings-subtitle mb-1">{t("payment.modulePriceLine", { price: priceLabel })}</p>
            <p className="mb-6 text-[12px] leading-snug text-ds-text-tertiary">{t("payment.payEnvNote")}</p>
            <button
              type="button"
              onClick={openYooKassa}
              className="ds-payment-panel--ink-cta flex h-12 w-full items-center justify-center rounded-[var(--ds-radius-md)] text-[15px] font-semibold transition-opacity hover:opacity-90"
            >
              {t("payment.payYooKassa")}
            </button>
          </section>

          <section
            className="ds-settings-panel ds-payment-panel ds-payment-panel--neutral lg:col-span-2"
            aria-labelledby="payment-history-heading"
          >
            <h2 id="payment-history-heading" className="ds-settings-section-head">
              <Receipt size={22} strokeWidth={1.75} aria-hidden />
              {t("payment.historySection")}
            </h2>
            {sortedLedger.length === 0 ? (
              <p className="text-[14px] text-ds-text-tertiary">{t("payment.historyEmpty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-[var(--ds-radius-md)] border border-[#ebebeb] dark:border-white/10">
                <table className="w-full min-w-[280px] border-collapse text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-[#ebebeb] bg-[var(--ds-neutral-row)] dark:border-white/10 dark:bg-white/5">
                      <th className="px-4 py-3 font-medium text-ds-text-tertiary">{t("payment.colDate")}</th>
                      <th className="px-4 py-3 font-medium text-ds-text-tertiary">{t("payment.colOp")}</th>
                      <th className="px-4 py-3 text-right font-medium text-ds-text-tertiary">
                        {t("payment.colAmount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLedger.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-[#f0f0f0] last:border-b-0 dark:border-white/8"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-ds-text-tertiary tabular-nums">
                          {formatEntryDate(e.at)}
                        </td>
                        <td className="px-4 py-3 text-ds-ink">{ledgerLabel(e)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-ds-ink">
                          {ledgerAmount(e)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
