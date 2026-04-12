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

export default function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Загрузка...</div>
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
          <header className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#e8e8e8] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 dark:border-white/10 dark:bg-[#1a1a1a] lg:hidden">
            <Link href="/dashboard" className="shrink-0" aria-label="ChinaChild">
              <ChinaChildSidebarLogo size={40} />
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-2xl border-black/15 bg-white dark:border-white/20 dark:bg-[#262626]"
                  aria-label="Открыть меню"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="h-full w-[280px] max-w-[280px] overflow-hidden border-r border-black/10 bg-[#e8e8e8] p-6 dark:border-white/10 dark:bg-[#1a1a1a] sm:max-w-[280px]"
              >
                <AppSidebar />
              </SheetContent>
            </Sheet>
          </header>

          <main className="ds-figma-shell-main-scroll">
            <div className="ds-figma-shell-page-pad">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
