"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { FigmaAppShell } from "@/components/figma-app-shell"
import { TeacherSidebar } from "@/components/teacher-sidebar"
import { useUiLocale } from "@/lib/ui-locale"

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, user, authReady } = useAuth()
  const { t } = useUiLocale()

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.replace("/")
      return
    }
    if (user?.role !== "teacher" && user?.role !== "curator") {
      router.replace("/dashboard")
    }
  }, [authReady, isAuthenticated, user, router])

  if (!authReady || !isAuthenticated || (user?.role !== "teacher" && user?.role !== "curator")) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  return (
    <FigmaAppShell
      logoHref="/teacher/dashboard"
      renderSidebar={(p) => <TeacherSidebar variant={p.variant} />}
    >
      {children}
    </FigmaAppShell>
  )
}
