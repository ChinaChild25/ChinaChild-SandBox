"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { FigmaAppShell } from "@/components/figma-app-shell"
import { useAuth } from "@/lib/auth-context"
import { useUiLocale } from "@/lib/ui-locale"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { authReady, isAuthenticated, user } = useAuth()
  const { t } = useUiLocale()

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.replace("/")
      return
    }

    if (user?.role !== "student") {
      router.replace(user?.role === "teacher" || user?.role === "curator" ? "/teacher/dashboard" : "/dashboard")
    }
  }, [authReady, isAuthenticated, router, user])

  if (!authReady || !isAuthenticated || user?.role !== "student") {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  return (
    <FigmaAppShell logoHref="/dashboard" renderSidebar={(props) => <AppSidebar variant={props.variant} />}>
      {children}
    </FigmaAppShell>
  )
}
