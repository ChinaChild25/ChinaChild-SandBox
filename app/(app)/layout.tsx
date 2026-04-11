"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { BrandLogo } from "@/components/brand-logo"
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
    <div className="ds-figma-app-canvas">
      <div className="ds-figma-app-card">
        <div className="ds-figma-app-row">
          <aside className="ds-sidebar ds-sidebar--figma-shell hidden w-[280px] shrink-0 lg:flex">
            <AppSidebar />
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#121212]">
            <header className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#e8e8e8] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 dark:border-white/10 dark:bg-[#1a1a1a] lg:hidden">
              <BrandLogo className="text-[22px] font-bold leading-none text-ds-ink" />
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

            <main className="min-h-0 flex-1 overflow-auto bg-white dark:bg-[#121212]">{children}</main>
          </div>
        </div>
      </div>
    </div>
  )
}
