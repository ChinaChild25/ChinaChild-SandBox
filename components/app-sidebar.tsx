"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  GraduationCap,
  Award,
  CalendarDays,
  Mail,
  BookOpen,
  Settings,
  LogOut,
  ChevronRight,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { ChinaChildCircleMark } from "@/components/brand-logo"
import { FIGMA_STUDENT_AVATAR } from "@/lib/figma-dashboard"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: string
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: LayoutGrid },
  { href: "/classes", label: "Занятия", icon: GraduationCap },
  { href: "/progress", label: "Мои оценки", icon: Award },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/messages", label: "Сообщения", icon: Mail, badge: "7" },
  { href: "/courses", label: "Мои курсы", icon: BookOpen },
  { href: "/settings", label: "Настройки", icon: Settings }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const levelLabel = {
    Beginner: "1 степени",
    Elementary: "2 степени",
    Intermediate: "3 степени",
    Advanced: "4 степени"
  }[user?.level ?? "Beginner"]

  const firstName = user?.name?.split(" ")[0] ?? "Яна"
  const avatarSrc = user?.avatar ?? FIGMA_STUDENT_AVATAR
  const subtitle = user?.profileSubtitle ?? `студентка ${levelLabel}`

  const isActive = (href: string, label: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (label === "Мои курсы") return pathname.startsWith("/courses")
    if (href === "/classes") return pathname === "/classes" || pathname.startsWith("/classes/")
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-ds-ink">
      <div className="mb-10">
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
          aria-label="ChinaChild — главная"
        >
          <ChinaChildCircleMark />
        </Link>
      </div>

      <Link
        href="/profile"
        className="mb-8 flex flex-col items-center rounded-2xl py-1 no-underline outline-offset-2 transition-colors hover:bg-black/[0.04] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
      >
        <div className="mb-3 h-[110px] w-[110px] overflow-hidden rounded-full bg-white ring-1 ring-black/8">
          <Image
            src={avatarSrc}
            alt="Аватар ученика"
            width={110}
            height={110}
            unoptimized={avatarSrc.startsWith("data:") || avatarSrc.startsWith("http")}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-1 text-[36px] font-semibold leading-none text-ds-ink">{firstName}</div>
        <div className="text-center text-[14px] text-ds-text-muted">{subtitle}</div>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Основное меню">
        {navItems.map((item) => {
          const active = isActive(item.href, item.label)
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={cn("figma-nav-link", active && "figma-nav-link--active")}
            >
              <item.icon size={20} strokeWidth={2} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className={cn(
                    "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    active ? "bg-white text-ds-ink dark:bg-[#141414] dark:text-white" : "bg-ds-ink text-white dark:bg-white dark:text-ds-ink"
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <Link
        href="/courses"
        className="mt-4 flex flex-col gap-2 rounded-[20px] bg-ds-sage p-4 no-underline text-ds-ink transition-opacity hover:opacity-95"
      >
        <div className="text-[14px] font-semibold">HSK 1 — Прогресс</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/50">
          <div className="h-full w-[37%] rounded-full bg-[#5a7c3a]" />
        </div>
        <div className="flex items-center gap-1 text-[13px] font-medium text-ds-ink/80">
          <span>37%</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </div>
      </Link>

      <div className="mt-6 border-t border-black/10 pt-4">
        <Button
          variant="outline"
          onClick={logout}
          className="w-full justify-start rounded-2xl border-black/15 bg-white/80 py-6 text-[15px] font-medium text-ds-ink hover:bg-white"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Выйти
        </Button>
      </div>
    </div>
  )
}
