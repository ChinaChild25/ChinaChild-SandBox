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
  Users,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { ChinaChildSidebarLogo } from "@/components/brand-logo"
import { useUiLocale } from "@/lib/ui-locale"

type NavItem = { href: string; labelKey: string; icon: LucideIcon }

const navItems: NavItem[] = [
  { href: "/teacher/dashboard", labelKey: "nav.home", icon: LayoutGrid },
  { href: "/teacher/classes", labelKey: "nav.classes", icon: GraduationCap },
  { href: "/teacher/students", labelKey: "nav.students", icon: Users },
  { href: "/teacher/progress", labelKey: "nav.grades", icon: Award },
  { href: "/teacher/schedule", labelKey: "nav.schedule", icon: CalendarDays },
  { href: "/teacher/messages", labelKey: "nav.messages", icon: Mail },
  { href: "/teacher/courses", labelKey: "nav.courses", icon: BookOpen },
  { href: "/teacher/settings", labelKey: "nav.settings", icon: Settings }
]

type TeacherSidebarProps = { variant?: "sidebar" | "drawer" }

export function TeacherSidebar({ variant = "sidebar" }: TeacherSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { t } = useUiLocale()
  const drawer = variant === "drawer"

  const firstName = user?.name?.split(" ")[0] ?? "Преподаватель"
  const avatarSrc = user?.avatar ?? "/staff/zhao-li.png"
  const subtitle = user?.profileSubtitle ?? "преподаватель"
  const isTeacherStudentProgressRoute = /^\/teacher\/students\/[^/]+\/progress(?:\/|$)/.test(pathname)

  const isActive = (href: string) => {
    if (href === "/teacher/dashboard") return pathname === "/teacher/dashboard"
    if (href === "/teacher/courses") return pathname.startsWith("/teacher/courses")
    if (href === "/teacher/progress") {
      return pathname === "/teacher/progress" || pathname.startsWith("/teacher/progress/") || isTeacherStudentProgressRoute
    }
    if (href === "/teacher/students") {
      return pathname === "/teacher/students" || (pathname.startsWith("/teacher/students/") && !isTeacherStudentProgressRoute)
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const navLinkNodes = navItems.map((item) => {
    const active = isActive(item.href)
    const label = t(item.labelKey)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn("figma-nav-link", drawer && "figma-nav-link--drawer-list", active && "figma-nav-link--active")}
      >
        <item.icon size={20} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 leading-snug">{label}</span>
      </Link>
    )
  })

  return (
    <div className={cn("flex h-full min-h-0 flex-col text-ds-ink", drawer && "gap-0")}>
      {!drawer ? (
        <div className="mb-8 shrink-0 cursor-pointer select-none pb-1">
          <Link
            href="/teacher/dashboard"
            className="block w-[52px] rounded-lg outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
            aria-label={t("sidebar.logoAria")}
          >
            <ChinaChildSidebarLogo size={52} />
          </Link>
        </div>
      ) : null}

      <Link
        href="/teacher/settings"
        className={cn(
          "no-underline outline-offset-2 transition-colors hover:bg-black/[0.04] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20 dark:hover:bg-white/[0.06]",
          drawer ? "mb-4 flex flex-row items-center gap-3 rounded-xl py-2 pr-2" : "mb-8 flex flex-col items-center rounded-2xl py-1"
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
            alt=""
            width={drawer ? 56 : 110}
            height={drawer ? 56 : 110}
            unoptimized={avatarSrc.startsWith("data:") || avatarSrc.startsWith("http")}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-semibold leading-tight text-ds-ink",
              drawer ? "text-[17px]" : "mb-1 text-[36px] leading-none"
            )}
          >
            {firstName}
          </div>
          <div
            className={cn(
              "text-ds-text-muted",
              drawer ? "line-clamp-2 text-[11px] leading-snug" : "text-center text-[14px]"
            )}
          >
            {subtitle}
          </div>
        </div>
      </Link>

      {drawer ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <nav className="flex flex-col gap-1.5" aria-label={t("sidebar.navAria")}>
            {navLinkNodes}
          </nav>
        </div>
      ) : (
        <>
          <nav
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
            aria-label={t("sidebar.navAria")}
          >
            {navLinkNodes}
          </nav>
        </>
      )}

      <div className={cn("border-t border-black/10 dark:border-white/12", drawer ? "mt-4 pt-3" : "mt-6 pt-4")}>
        <Button
          variant="outline"
          onClick={logout}
          className={cn(
            "w-full justify-start rounded-2xl border-0 bg-white font-medium text-ds-ink !shadow-none shadow-none ring-0 transition-colors hover:bg-ds-surface-hover hover:!shadow-none dark:bg-[#262626] dark:text-ds-ink dark:hover:bg-[#333333]",
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
