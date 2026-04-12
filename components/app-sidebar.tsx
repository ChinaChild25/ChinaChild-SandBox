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
  CreditCard,
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
  { href: "/payment", labelKey: "nav.payment", icon: CreditCard },
  { href: "/settings", labelKey: "nav.settings", icon: Settings }
]

type AppSidebarProps = {
  /** Узкая колонка в Sheet на телефоне: сетка пунктов, компактный профиль */
  variant?: "sidebar" | "drawer"
}

export function AppSidebar({ variant = "sidebar" }: AppSidebarProps) {
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
  const subtitle =
    user?.role === "teacher"
      ? (user?.profileSubtitle ?? "Преподаватель")
      : (user?.profileSubtitle ?? t("profile.subtitle", { level: levelLabel }))

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (href === "/courses") return pathname.startsWith("/courses")
    if (href === "/classes") return pathname === "/classes" || pathname.startsWith("/classes/")
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const drawer = variant === "drawer"

  const navLinkNodes = navItems.map((item) => {
    const active = isActive(item.href)
    const label = t(item.labelKey)
    return (
      <Link
        key={`${item.labelKey}-${item.href}`}
        href={item.href}
        className={cn(
          "figma-nav-link",
          drawer && "figma-nav-link--drawer-list relative",
          active && "figma-nav-link--active"
        )}
      >
        <item.icon size={20} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 leading-snug">{label}</span>
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
  })

  const hskCard =
    notifPrefs.lessons ? (
      <Link
        href="/courses"
        className={cn(
          "flex no-underline text-ds-ink transition-opacity hover:opacity-95",
          drawer
            ? "w-full flex-row items-center gap-3 rounded-xl bg-ds-sage px-3 py-2.5"
            : "mt-4 flex-col gap-2 rounded-[20px] bg-ds-sage p-4"
        )}
      >
        <div className={cn("font-semibold", drawer ? "min-w-0 flex-1 text-[13px] leading-snug" : "text-[14px]")}>
          {t("sidebar.hskTitle")}
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-full bg-white/50",
            drawer ? "h-1.5 min-w-0 flex-1" : "h-2 w-full"
          )}
        >
          <div className="h-full w-[37%] rounded-full bg-ds-sage-strong" />
        </div>
        {!drawer ? (
          <div className="flex items-center gap-1 text-[13px] font-medium text-ds-ink/80">
            <span>37%</span>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </div>
        ) : (
          <span className="shrink-0 text-[12px] font-semibold text-ds-ink/85">37%</span>
        )}
      </Link>
    ) : null

  return (
    <div className={cn("flex h-full min-h-0 flex-col text-ds-ink", drawer && "gap-0")}>
      {!drawer ? (
        <div className="mb-8 shrink-0 cursor-pointer select-none pb-1">
          <Link
            href="/dashboard"
            className="block w-[52px] rounded-lg outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
            aria-label={t("sidebar.logoAria")}
          >
            <ChinaChildSidebarLogo size={52} />
          </Link>
        </div>
      ) : null}

      <Link
        href="/profile"
        className={cn(
          "no-underline outline-offset-2 transition-colors hover:bg-black/[0.04] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20 dark:hover:bg-white/[0.06]",
          drawer
            ? "mb-4 flex flex-row items-center gap-3 rounded-xl py-2 pr-2"
            : "mb-8 flex flex-col items-center rounded-2xl py-1"
        )}
      >
        <div
          className={cn(
            "shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/8",
            drawer ? "h-14 w-14" : "mb-3 h-[110px] w-[110px]"
          )}
        >
          <Image
            src={avatarSrc}
            alt={t("sidebar.avatarAlt")}
            width={drawer ? 56 : 110}
            height={drawer ? 56 : 110}
            unoptimized={avatarSrc.startsWith("data:") || avatarSrc.startsWith("http")}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("font-semibold leading-tight text-ds-ink", drawer ? "text-[17px]" : "mb-1 text-[36px] leading-none")}>
            {firstName}
          </div>
          <div className={cn("text-ds-text-muted", drawer ? "line-clamp-2 text-[11px] leading-snug" : "text-center text-[14px]")}>
            {subtitle}
          </div>
        </div>
      </Link>

      {drawer ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <nav className="flex flex-col gap-1.5" aria-label={t("sidebar.navAria")}>
            {navLinkNodes}
          </nav>
          {hskCard}
        </div>
      ) : (
        <>
          <nav
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
            aria-label={t("sidebar.navAria")}
          >
            {navLinkNodes}
          </nav>
          {hskCard}
        </>
      )}

      <div className={cn("border-t border-black/10 dark:border-white/12", drawer ? "mt-4 pt-3" : "mt-6 pt-4")}>
        <Button
          variant="outline"
          onClick={logout}
          className={cn(
            "w-full justify-start rounded-2xl border border-black/10 bg-white font-medium text-ds-ink !shadow-none shadow-none ring-0 transition-colors hover:bg-ds-surface-hover hover:!shadow-none dark:border-white/10 dark:bg-[#262626] dark:text-ds-ink dark:hover:bg-[#333333]",
            drawer ? "py-3 text-[14px]" : "py-6 text-[15px]"
          )}
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {t("sidebar.logout")}
        </Button>
      </div>
    </div>
  )
}
