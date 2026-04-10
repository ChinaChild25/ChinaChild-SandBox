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
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#f5f5f5]">
      <div className="flex min-h-[100dvh] flex-1 flex-row">
        <aside className="hidden w-[280px] shrink-0 flex-col bg-[#e8e8e8] p-6 lg:flex">
          <AppSidebar />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#e8e8e8] px-4 py-3 lg:hidden">
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
              <SheetContent side="left" className="w-[280px] border-r border-black/10 bg-[#e8e8e8] p-6">
                <AppSidebar />
              </SheetContent>
            </Sheet>
          </header>

          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  )
}
