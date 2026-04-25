"use client"

import { useEffect, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DailyCallSession } from "@/components/lessons/lesson-live-session"
import { useAuth } from "@/lib/auth-context"
import { useUiLocale } from "@/lib/ui-locale"

function normalizeBackHref(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  const value = raw.trim()
  if (!value.startsWith("/")) return fallback
  return value
}

export default function ScheduleCallPage() {
  const params = useParams<{ slotId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authReady, isAuthenticated, user } = useAuth()
  const { locale, t } = useUiLocale()

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.replace("/")
    }
  }, [authReady, isAuthenticated, router])

  const fallbackBackHref = user?.role === "teacher" || user?.role === "curator" ? "/teacher/classes" : "/schedule"
  const backHref = normalizeBackHref(searchParams.get("backTo"), fallbackBackHref)
  const title = useMemo(() => {
    if (locale === "en") return "Live lesson"
    if (locale === "zh") return "在线课堂"
    return "Онлайн-занятие"
  }, [locale])

  if (!authReady || !isAuthenticated) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  return (
    <DailyCallSession
      roomRequest={{ scheduleSlotId: params.slotId }}
      initialTitle={title}
      initialSubtitle={null}
      backHref={backHref}
    />
  )
}
