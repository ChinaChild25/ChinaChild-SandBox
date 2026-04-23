"use client"

import { useCallback, useEffect, useState } from "react"
import type { StudentBillingSummary } from "@/lib/billing"

export function useStudentBillingSummary(options?: { enabled?: boolean; refreshIntervalMs?: number }) {
  const enabled = options?.enabled ?? true
  const refreshIntervalMs = options?.refreshIntervalMs ?? 0
  const [summary, setSummary] = useState<StudentBillingSummary | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return null
    setLoading(true)
    try {
      const res = await fetch("/api/billing/summary", { cache: "no-store" })
      const payload = (await res.json().catch(() => null)) as
        | (StudentBillingSummary & { error?: string })
        | { error?: string }
        | null

      if (!res.ok || !payload || !("lessonsLeft" in payload)) {
        const message = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined
        setError(message ?? "Не удалось загрузить баланс занятий")
        setSummary(null)
        return null
      }

      setSummary(payload)
      setError(null)
      return payload
    } catch {
      setError("Не удалось загрузить баланс занятий")
      setSummary(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || !refreshIntervalMs) return

    const id = window.setInterval(() => {
      void refresh()
    }, refreshIntervalMs)

    return () => window.clearInterval(id)
  }, [enabled, refresh, refreshIntervalMs])

  return { summary, loading, error, refresh }
}

