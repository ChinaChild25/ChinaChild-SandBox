"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Script from "next/script"
import { AlertTriangle, BookOpen, CreditCard, Loader2, Receipt, Wallet } from "lucide-react"
import { useStudentBillingSummary } from "@/hooks/use-student-billing-summary"
import { formatRub, type BillingLedgerItem, type BillingPaymentOrder, type BillingPackage } from "@/lib/billing"
import { localeToBcp47, useUiLocale } from "@/lib/ui-locale"

type WidgetEvent = "success" | "fail" | "modal_close" | "complete"

type YooMoneyCheckoutWidgetInstance = {
  on: (event: WidgetEvent, callback: () => void) => void
  render: (containerId?: string) => Promise<unknown> | void
  destroy: () => void
}

type YooMoneyCheckoutWidgetConstructor = new (options: {
  confirmation_token: string
  error_callback?: (error: unknown) => void
  customization?: {
    modal?: boolean
    colors?: {
      control_primary?: string
      background?: string
    }
  }
}) => YooMoneyCheckoutWidgetInstance

declare global {
  interface Window {
    YooMoneyCheckoutWidget?: YooMoneyCheckoutWidgetConstructor
  }
}

const ORDER_POLL_INTERVAL_MS = 2500
const ORDER_POLL_ATTEMPTS = 36

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function formatLedgerDelta(entry: BillingLedgerItem) {
  if (entry.lessonsDelta > 0) return `+${entry.lessonsDelta} урок${entry.lessonsDelta === 1 ? "" : "а"}`
  if (entry.lessonsDelta < 0) return `${entry.lessonsDelta} урок`
  return "0"
}

function formatOrderStatus(status: BillingPaymentOrder["status"]) {
  switch (status) {
    case "paid":
      return "Оплачен"
    case "canceled":
      return "Отменён"
    case "failed":
      return "Не создан"
    default:
      return "Ожидает оплаты"
  }
}

export default function PaymentPage() {
  const { locale } = useUiLocale()
  const bcp47 = localeToBcp47(locale)
  const { summary, loading, error, refresh } = useStudentBillingSummary()
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [processingMessage, setProcessingMessage] = useState<string | null>(null)
  const activeWidgetRef = useRef<YooMoneyCheckoutWidgetInstance | null>(null)

  useEffect(() => {
    return () => {
      activeWidgetRef.current?.destroy()
      activeWidgetRef.current = null
    }
  }, [])

  const sortedLedger = useMemo(() => summary?.ledger ?? [], [summary?.ledger])
  const paymentOrders = useMemo(() => summary?.paymentOrders ?? [], [summary?.paymentOrders])

  const formatEntryDate = useCallback(
    (iso: string) => {
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
    },
    [bcp47]
  )

  const pollOrderUntilSettled = useCallback(
    async (orderId: string) => {
      setProcessingMessage("Платёж получен. Обновляем баланс после подтверждения ЮKassa…")

      for (let attempt = 0; attempt < ORDER_POLL_ATTEMPTS; attempt += 1) {
        const res = await fetch(`/api/billing/order-status?order_id=${encodeURIComponent(orderId)}`, {
          cache: "no-store"
        })
        const payload = (await res.json().catch(() => null)) as
          | { status?: BillingPaymentOrder["status"]; error?: string }
          | null

        if (res.ok && payload?.status === "paid") {
          await refresh()
          setProcessingMessage("Баланс обновлён. Уроки начислены.")
          return
        }
        if (res.ok && (payload?.status === "canceled" || payload?.status === "failed")) {
          setProcessingMessage(null)
          setPaymentError(
            payload.status === "canceled"
              ? "Оплата была отменена до подтверждения."
              : "Платёж не был создан или завершён корректно."
          )
          await refresh()
          return
        }
        if (!res.ok && payload?.error) {
          setProcessingMessage("Оплата обрабатывается. Баланс обновится автоматически, как только придёт webhook.")
          return
        }

        await sleep(ORDER_POLL_INTERVAL_MS)
      }

      setProcessingMessage("Оплата обрабатывается. Баланс обновится автоматически, как только придёт webhook.")
      await refresh()
    },
    [refresh]
  )

  const openPaymentWidget = useCallback(
    async (pkg: BillingPackage) => {
      if (!window.YooMoneyCheckoutWidget) {
        setPaymentError("Скрипт виджета ЮKassa ещё не загрузился. Обновите страницу и попробуйте снова.")
        return
      }

      setCreatingPackageId(pkg.id)
      setPaymentError(null)
      setProcessingMessage(null)

      try {
        const res = await fetch("/api/billing/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: pkg.id })
        })
        const payload = (await res.json().catch(() => null)) as
          | { orderId?: string; confirmationToken?: string; error?: string }
          | null

        if (!res.ok || !payload?.orderId || !payload?.confirmationToken) {
          throw new Error(payload?.error ?? "Не удалось подготовить оплату")
        }

        activeWidgetRef.current?.destroy()
        const widget = new window.YooMoneyCheckoutWidget({
          confirmation_token: payload.confirmationToken,
          error_callback: () => {
            setPaymentError("Не удалось открыть платёжную форму ЮKassa.")
          },
          customization: {
            modal: true,
            colors: {
              control_primary: "#2d8cff",
              background: "#ffffff"
            }
          }
        })

        activeWidgetRef.current = widget

        widget.on("success", () => {
          widget.destroy()
          activeWidgetRef.current = null
          void pollOrderUntilSettled(payload.orderId!)
        })

        widget.on("fail", () => {
          widget.destroy()
          activeWidgetRef.current = null
          setPaymentError("Оплата не завершилась. Попробуйте ещё раз.")
        })

        widget.on("modal_close", () => {
          activeWidgetRef.current = null
        })

        await Promise.resolve(widget.render())
      } catch (error) {
        setPaymentError(error instanceof Error ? error.message : "Не удалось открыть оплату")
      } finally {
        setCreatingPackageId(null)
      }
    },
    [pollOrderUntilSettled]
  )

  return (
    <div className="ds-figma-page ds-payment-page ds-settings-page-bleed">
      <Script src="https://yookassa.ru/checkout-widget/v1/checkout-widget.js" strategy="afterInteractive" />

      <div className="ds-settings-v0-stack">
        <header className="ds-settings-page-header">
          <h1 className="ds-settings-page-title">Оплата</h1>
          <p className="ds-settings-page-lead">Баланс уроков, пакеты и история операций</p>
        </header>

        {loading ? (
          <div className="rounded-[var(--ds-radius-xl)] bg-[var(--ds-neutral-row)] px-4 py-5 text-[14px] text-ds-text-tertiary">
            Загружаем баланс занятий…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[var(--ds-radius-xl)] border border-red-500/20 bg-red-500/10 px-4 py-4 text-[14px] text-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        ) : null}

        {summary?.lowBalance ? (
          <div className="rounded-[var(--ds-radius-xl)] border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-[14px] text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <div className="font-semibold">
                  {summary.blocked
                    ? "Баланс уроков исчерпан"
                    : `Осталось мало уроков: ${summary.lessonsLeft}`}
                </div>
                <div className="mt-1 text-amber-900/90 dark:text-amber-100/85">
                  {summary.blocked
                    ? "Пополните пакет, чтобы снова записываться и подключаться к занятиям."
                    : "Лучше пополнить пакет заранее, чтобы не потерять доступ к записи на уроки."}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {paymentError ? (
          <div className="rounded-[var(--ds-radius-xl)] border border-red-500/20 bg-red-500/10 px-4 py-4 text-[14px] text-red-900 dark:bg-red-950/40 dark:text-red-100">
            {paymentError}
          </div>
        ) : null}

        {processingMessage ? (
          <div className="rounded-[var(--ds-radius-xl)] border border-[#2d8cff]/20 bg-[#2d8cff]/10 px-4 py-4 text-[14px] text-[#12498f] dark:bg-[#0b5cff]/15 dark:text-[#d5e4ff]">
            {processingMessage}
          </div>
        ) : null}

        {summary ? (
          <div className="ds-settings-panels-grid">
            <section className="ds-settings-panel ds-payment-panel ds-payment-panel--sage" aria-labelledby="billing-balance-heading">
              <h2 id="billing-balance-heading" className="ds-settings-section-head">
                <Wallet size={22} strokeWidth={1.75} aria-hidden />
                Баланс уроков
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] bg-white/70 px-4 py-3 dark:bg-black/25">
                  <span className="text-[15px] text-ds-ink">Доступно сейчас</span>
                  <span className="text-[22px] font-semibold tabular-nums text-ds-ink">{summary.lessonsLeft}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-white/50 px-4 py-3 dark:border-white/15 dark:bg-black/20">
                  <span className="text-[15px] text-ds-ink">Статус доступа</span>
                  <span className="text-[15px] font-semibold text-ds-ink">
                    {summary.blocked ? "Бронирование и подключение заблокированы" : "Доступ активен"}
                  </span>
                </div>
              </div>
            </section>

            <section className="ds-settings-panel ds-payment-panel ds-payment-panel--neutral lg:col-span-2" aria-labelledby="billing-packages-heading">
              <h2 id="billing-packages-heading" className="ds-settings-section-head">
                <CreditCard size={22} strokeWidth={1.75} aria-hidden />
                Пакеты занятий
              </h2>
              {summary.packages.length === 0 ? (
                <p className="text-[14px] text-ds-text-tertiary">
                  В базе пока нет активных пакетов для оплаты. Добавьте записи в таблицу
                  {" "}
                  <code>lesson_packages</code>.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {summary.packages.map((pkg) => {
                    const busy = creatingPackageId === pkg.id
                    return (
                      <article
                        key={pkg.id}
                        className="rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-white/70 p-4 dark:border-white/12 dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-[17px] font-semibold text-ds-ink">{pkg.title}</h3>
                            {pkg.description ? (
                              <p className="mt-1 text-[13px] leading-snug text-ds-text-tertiary">{pkg.description}</p>
                            ) : null}
                          </div>
                          <span className="text-[17px] font-semibold text-ds-ink">{formatRub(pkg.priceRub, bcp47)}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-[13px] text-ds-text-secondary">
                          <span className="rounded-full bg-[var(--ds-neutral-row)] px-3 py-1">
                            {pkg.paidLessons} оплачиваемых
                          </span>
                          {pkg.bonusLessons > 0 ? (
                            <span className="rounded-full bg-[var(--ds-sage)] px-3 py-1 text-ds-ink">
                              +{pkg.bonusLessons} бонусных
                            </span>
                          ) : null}
                          <span className="rounded-full bg-[var(--ds-neutral-row)] px-3 py-1">
                            Итого {pkg.totalLessons}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void openPaymentWidget(pkg)}
                          disabled={busy}
                          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-ds-ink px-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-[#1a1a1a]"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                          {busy ? "Готовим оплату…" : "Оплатить через ЮKassa"}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="ds-settings-panel ds-payment-panel ds-payment-panel--ink" aria-labelledby="billing-orders-heading">
              <h2 id="billing-orders-heading" className="ds-settings-section-head">
                <BookOpen size={22} strokeWidth={1.75} aria-hidden />
                Последние платежи
              </h2>
              {paymentOrders.length === 0 ? (
                <p className="text-[14px] text-white/70">Пока нет созданных оплат.</p>
              ) : (
                <div className="space-y-3">
                  {paymentOrders.slice(0, 4).map((order) => (
                    <div key={order.id} className="rounded-[var(--ds-radius-md)] bg-white/10 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] font-semibold text-white">{order.packageTitle}</span>
                        <span className="text-[14px] text-white/75">{formatOrderStatus(order.status)}</span>
                      </div>
                      <div className="mt-1 text-[13px] text-white/70">
                        {formatRub(order.amountRub, bcp47)} · {order.lessonsToCredit} уроков
                      </div>
                      <div className="mt-1 text-[12px] text-white/55">{formatEntryDate(order.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="ds-settings-panel ds-payment-panel ds-payment-panel--neutral lg:col-span-3" aria-labelledby="billing-history-heading">
              <h2 id="billing-history-heading" className="ds-settings-section-head">
                <Receipt size={22} strokeWidth={1.75} aria-hidden />
                История списаний и пополнений
              </h2>
              {sortedLedger.length === 0 ? (
                <p className="text-[14px] text-ds-text-tertiary">Пока нет операций в бухгалтерской ленте.</p>
              ) : (
                <div className="overflow-x-auto rounded-[var(--ds-radius-md)] border border-[#ebebeb] dark:border-white/10">
                  <table className="w-full min-w-[320px] border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-[#ebebeb] bg-[var(--ds-neutral-row)] dark:border-white/10 dark:bg-white/5">
                        <th className="px-4 py-3 font-medium text-ds-text-tertiary">Дата</th>
                        <th className="px-4 py-3 font-medium text-ds-text-tertiary">Операция</th>
                        <th className="px-4 py-3 text-right font-medium text-ds-text-tertiary">Уроки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLedger.map((entry) => (
                        <tr key={entry.id} className="border-b border-[#f0f0f0] last:border-b-0 dark:border-white/8">
                          <td className="whitespace-nowrap px-4 py-3 text-ds-text-tertiary tabular-nums">
                            {formatEntryDate(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-ds-ink">
                            <div>{entry.description}</div>
                            {entry.lessonDateKey && entry.lessonTime ? (
                              <div className="mt-1 text-[12px] text-ds-text-tertiary">
                                {entry.lessonDateKey} · {entry.lessonTime}
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-ds-ink">
                            {formatLedgerDelta(entry)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
