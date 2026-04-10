"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Menu, Search, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { mockNotifications } from "@/lib/mock-data"
import { AppSidebar } from "./app-sidebar"

export function AppHeader() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const unreadCount = mockNotifications.filter((n) => !n.read).length

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <header className="cc-glass-header">
      <div className="cc-glass-header__inner">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="chinaGlass" size="icon" className="md:hidden" aria-label="Открыть меню">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-r border-white/20 p-0">
            <AppSidebar />
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="cc-glass-nav-badge shrink-0">L</div>
          <span className="hidden font-extrabold tracking-[-0.04em] text-foreground sm:inline-block truncate">
            Lingua
          </span>
        </Link>

        {/* Search + actions */}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-2.5 md:flex-initial md:pl-2">
          {searchOpen ? (
            <div className="cc-glass-bar flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-2 md:max-w-md">
              <Input
                type="search"
                placeholder="Курсы, уроки…"
                className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                autoFocus
              />
              <Button
                variant="chinaGlass"
                size="icon"
                className="!h-10 !w-10 shrink-0"
                onClick={() => setSearchOpen(false)}
                aria-label="Закрыть поиск"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="chinaGlass"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label="Поиск"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="chinaGlass" size="icon" className="relative" aria-label="Уведомления">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1d1d1f] px-1 text-[10px] font-bold text-white dark:bg-primary">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="px-3 py-2.5 font-extrabold text-sm tracking-tight">Уведомления</div>
              <DropdownMenuSeparator />
              {mockNotifications.slice(0, 4).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex cursor-pointer flex-col items-start gap-1 rounded-[var(--play-compact-radius)] p-3"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="text-sm font-bold">{notification.title}</span>
                    {!notification.read && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{notification.message}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-sm font-bold">Все уведомления</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="chinaGlass" className="!h-11 !w-11 !min-w-0 overflow-hidden rounded-full p-0">
                <Avatar className="h-11 w-11 rounded-[var(--play-button-radius)]">
                  <AvatarFallback className="rounded-[var(--play-button-radius)] bg-muted text-sm font-bold text-foreground">
                    {user ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2.5 p-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-muted text-sm font-bold text-foreground">
                    {user ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">{user?.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account" className={pathname === "/account" ? "bg-muted/80" : ""}>
                  Профиль
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Дашборд</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-muted-foreground focus:text-foreground"
              >
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
