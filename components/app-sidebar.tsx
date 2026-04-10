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
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { placeholderImages } from "@/lib/placeholders"
import { BrandLogo } from "@/components/brand-logo"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: LayoutGrid },
  { href: "/courses", label: "Занятия", icon: GraduationCap },
  { href: "/progress", label: "Мои оценки", icon: Award },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/messages", label: "Сообщения", icon: Mail },
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

  const isActive = (href: string, label: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (label === "Мои курсы" && href === "/courses") {
      return pathname.startsWith("/courses") && pathname !== "/dashboard"
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-[#1a1a1a]">
      <div className="mb-10">
        <BrandLogo className="text-[28px] font-bold leading-none" />
      </div>

      <div className="mb-8 flex flex-col items-center">
        <div className="mb-3 h-[110px] w-[110px] overflow-hidden rounded-full bg-white">
          <Image
            src={placeholderImages.studentAvatar}
            alt="Аватар ученика"
            width={110}
            height={110}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-1 text-[36px] font-normal leading-none">{firstName}</div>
        <div className="text-[14px] text-[#555]">студентка {levelLabel}</div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href, item.label)
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={cn("figma-nav-link", active && "figma-nav-link--active")}
            >
              <item.icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-6 border-t border-black/10 pt-4">
        <Button
          variant="outline"
          onClick={logout}
          className="w-full justify-start rounded-2xl border-black/15 bg-white/80 py-6 text-[15px] font-medium text-[#1a1a1a] hover:bg-white"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </div>
    </div>
  )
}
