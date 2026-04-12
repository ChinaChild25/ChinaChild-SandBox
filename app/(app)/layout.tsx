"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { ChinaChildSidebarLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useUiLocale } from "@/lib/ui-locale"

export default function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { t } = useUiLocale()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="ds-figma-shell-outer">
      <div className="ds-figma-shell-row">
        <aside className="ds-figma-shell-sidebar">
          <AppSidebar />
        </aside>

        <div className="ds-figma-shell-main">
          <main className="ds-figma-shell-main-scroll">
            <header
              className="sticky top-0 z-40 mx-3 mb-1 flex shrink-0 items-center justify-between gap-3 rounded-b-[var(--ds-radius-xl)] border-b border-black/10 bg-[rgb(232_232_232/0.65)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_8px_24px_rgb(0_0_0/0.06)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-[rgb(26_26_26/0.62)] dark:shadow-[0_8px_28px_rgb(0_0_0/0.35)] lg:hidden"
              style={{ WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
            >
              <Link href="/dashboard" className="shrink-0" aria-label={t("sidebar.logoAria")}>
                <ChinaChildSidebarLogo size={40} />
              </Link>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl bg-white/85 shadow-none backdrop-blur-sm transition-colors hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
                    aria-label={t("app.openMenu")}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="h-full w-[280px] max-w-[280px] overflow-hidden border-r border-black/10 bg-[var(--ds-neutral-chrome)] p-6 dark:border-white/10 sm:max-w-[280px]"
                >
                  <AppSidebar />
                </SheetContent>
              </Sheet>
            </header>
            <div className="ds-figma-shell-page-pad">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
