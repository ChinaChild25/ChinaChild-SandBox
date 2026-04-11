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
    <div className="ds-app-canvas">
      <div className="ds-app-shell">
        <div className="ds-app-row">
          <aside className="ds-sidebar hidden lg:flex">
            <AppSidebar />
          </aside>

          <div className="ds-main flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-black/10 bg-ds-sidebar px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
              <BrandLogo className="text-[22px]" />
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl border-black/15 bg-white"
                    aria-label="Открыть меню"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="h-full w-[280px] max-w-[280px] overflow-hidden rounded-r-[var(--ds-sidebar-radius-right)] border-r border-black/10 bg-ds-sidebar p-6 sm:max-w-[280px]"
                >
                  <AppSidebar />
                </SheetContent>
              </Sheet>
            </header>

            <main className="min-h-0 flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </div>
    </div>
  )
}
