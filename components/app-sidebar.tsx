"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
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
import { ChinaChildSidebarLogo } from "@/components/brand-logo"
import { FIGMA_STUDENT_AVATAR } from "@/lib/figma-dashboard"
import { getMessagesUnreadTotal } from "@/lib/messages-conversations"
import {
  readNotificationPreferences,
  subscribeNotificationPreferences,
  type NotificationPreferences
} from "@/lib/notification-preferences"
import { useUiLocale } from "@/lib/ui-locale"

type NavItem = {
  href: string
  labelKey: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.home", icon: LayoutGrid },
  { href: "/classes", labelKey: "nav.classes", icon: GraduationCap },
  { href: "/progress", labelKey: "nav.grades", icon: Award },
  { href: "/schedule", labelKey: "nav.schedule", icon: CalendarDays },
  { href: "/messages", labelKey: "nav.messages", icon: Mail },
  { href: "/courses", labelKey: "nav.courses", icon: BookOpen },
  { href: "/settings", labelKey: "nav.settings", icon: Settings }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { t } = useUiLocale()
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(readNotificationPreferences)

  useEffect(() => {
    setNotifPrefs(readNotificationPreferences())
    return subscribeNotificationPreferences(() => setNotifPrefs(readNotificationPreferences()))
  }, [])

  const messagesUnread = getMessagesUnreadTotal()
  const messagesBadge =
    notifPrefs.messages && messagesUnread > 0 ? String(messagesUnread) : undefined

  const levelKey = {
    Beginner: "profile.levelBeginner",
    Elementary: "profile.levelElementary",
    Intermediate: "profile.levelIntermediate",
    Advanced: "profile.levelAdvanced"
  }[user?.level ?? "Beginner"] as string

  const levelLabel = t(levelKey)
  const firstName = user?.name?.split(" ")[0] ?? "Яна"
  const avatarSrc = user?.avatar ?? FIGMA_STUDENT_AVATAR
  const subtitle = user?.profileSubtitle ?? t("profile.subtitle", { level: levelLabel })

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (href === "/courses") return pathname.startsWith("/courses")
    if (href === "/classes") return pathname === "/classes" || pathname.startsWith("/classes/")
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-ds-ink">
      <div className="mb-8 shrink-0 cursor-pointer select-none pb-1">
        <Link
          href="/dashboard"
          className="block w-[52px] rounded-lg outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
          aria-label={t("sidebar.logoAria")}
        >
          <ChinaChildSidebarLogo size={52} />
        </Link>
      </div>

      <Link
        href="/profile"
        className="mb-8 flex flex-col items-center rounded-2xl py-1 no-underline outline-offset-2 transition-colors hover:bg-black/[0.04] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20 dark:hover:bg-white/[0.06]"
      >
        <div className="mb-3 h-[110px] w-[110px] overflow-hidden rounded-full bg-white ring-1 ring-black/8">
          <Image
            src={avatarSrc}
            alt={t("sidebar.avatarAlt")}
            width={110}
            height={110}
            unoptimized={avatarSrc.startsWith("data:") || avatarSrc.startsWith("http")}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-1 text-[36px] font-semibold leading-none text-ds-ink">{firstName}</div>
        <div className="text-center text-[14px] text-ds-text-muted">{subtitle}</div>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label={t("sidebar.navAria")}>
        {navItems.map((item) => {
          const active = isActive(item.href)
          const label = t(item.labelKey)
          return (
            <Link
              key={`${item.labelKey}-${item.href}`}
              href={item.href}
              className={cn("figma-nav-link", active && "figma-nav-link--active")}
            >
              <item.icon size={20} strokeWidth={2} aria-hidden />
              <span className="flex-1">{label}</span>
              {item.href === "/messages" && messagesBadge ? (
                <span
                  className={cn(
                    "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    active
                      ? "bg-white text-ds-ink dark:bg-[#141414] dark:text-white"
                      : "bg-ds-ink text-white dark:bg-[#e8e8e8] dark:text-[#141414]"
                  )}
                >
                  {messagesBadge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      {notifPrefs.lessons ? (
        <Link
          href="/courses"
          className="mt-4 flex flex-col gap-2 rounded-[20px] bg-ds-sage p-4 no-underline text-ds-ink transition-opacity hover:opacity-95"
        >
          <div className="text-[14px] font-semibold">{t("sidebar.hskTitle")}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/50">
            <div className="h-full w-[37%] rounded-full bg-ds-sage-strong" />
          </div>
          <div className="flex items-center gap-1 text-[13px] font-medium text-ds-ink/80">
            <span>37%</span>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </div>
        </Link>
      ) : null}

      <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/12">
        <Button
          variant="outline"
          onClick={logout}
          className="w-full justify-start rounded-2xl bg-white py-6 text-[15px] font-medium text-ds-ink shadow-none transition-colors hover:bg-ds-surface-hover dark:bg-[#262626] dark:text-ds-ink dark:hover:bg-[#333333]"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          {t("sidebar.logout")}
        </Button>
      </div>
    </div>
  )
}
