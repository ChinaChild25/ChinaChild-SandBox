"use client"

import { useEffect, type CSSProperties } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { ChinaChildSidebarLogo } from "@/components/brand-logo"
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
          <main
            className="ds-figma-shell-main-scroll"
            style={
              {
                "--ds-mobile-messages-offset":
                  "calc(max(0.5rem, env(safe-area-inset-top)) + 3.75rem + 0.5rem + 1.25rem + env(safe-area-inset-bottom))"
              } as CSSProperties
            }
          >
            <div className="ds-mobile-top-chrome lg:hidden">
              <div className="ds-mobile-top-chrome__bar">
                <Link href="/dashboard" className="shrink-0 pl-0.5" aria-label={t("sidebar.logoAria")}>
                  <ChinaChildSidebarLogo size={36} />
                </Link>
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="ds-mobile-top-chrome__menu-btn"
                      aria-label={t("app.openMenu")}
                    >
                      <Menu className="h-5 w-5" strokeWidth={2} />
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="flex h-full w-[min(100vw-1.5rem,320px)] max-w-[320px] flex-col overflow-hidden border-r border-black/10 bg-[var(--ds-neutral-chrome)] p-0 dark:border-white/10"
                  >
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
                      <AppSidebar variant="drawer" />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            <div className="ds-mobile-top-chrome-spacer lg:hidden" aria-hidden />
            <div className="ds-figma-shell-page-pad">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
