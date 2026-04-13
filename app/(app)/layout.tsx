"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { FigmaAppShell } from "@/components/figma-app-shell"
import { TeacherSidebar } from "@/components/teacher-sidebar"
import { useUiLocale } from "@/lib/ui-locale"
import { isTeacherSharedContentPath } from "@/lib/app-shared-routes"

export default function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const { isAuthenticated, user } = useAuth()
  const { t } = useUiLocale()

  const isTeacher = user?.role === "teacher" || user?.role === "curator"
  const teacherOnSharedContent = isTeacher && isTeacherSharedContentPath(pathname)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/")
      return
    }
    if (isTeacher && !teacherOnSharedContent) {
      router.replace("/teacher/dashboard")
    }
  }, [isAuthenticated, isTeacher, teacherOnSharedContent, router])

  if (!isAuthenticated) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  if (isTeacher && !teacherOnSharedContent) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  if (isTeacher && teacherOnSharedContent) {
    return (
      <FigmaAppShell
        logoHref="/teacher/dashboard"
        renderSidebar={(p) => <TeacherSidebar variant={p.variant} />}
      >
        {children}
      </FigmaAppShell>
    )
  }

  return (
    <FigmaAppShell logoHref="/dashboard" renderSidebar={(p) => <AppSidebar variant={p.variant} />}>
      {children}
    </FigmaAppShell>
  )
}
