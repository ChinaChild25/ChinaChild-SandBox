"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Gauge,
  BookOpenCheck,
  Calendar,
  MessagesSquare,
  LineChart,
  Settings,
  LogOut,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { placeholderImages } from "@/lib/placeholders"

type SidebarItem = {
  name: string
  icon: LucideIcon
  href?: string
}

const navigation: SidebarItem[] = [
  { name: "Дашборд", href: "/dashboard", icon: Gauge },
  { name: "Мои курсы", href: "/courses", icon: BookOpenCheck },
  { name: "Прогресс", href: "/progress", icon: LineChart },
  { name: "Расписание", href: "/schedule", icon: Calendar },
  { name: "Сообщения", href: "/messages", icon: MessagesSquare },
  { name: "Настройки", href: "/settings", icon: Settings }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const levelNumber = {
    Beginner: 1,
    Elementary: 2,
    Intermediate: 3,
    Advanced: 4
  }[user?.level ?? "Beginner"]

  const firstName = user?.name?.split(" ")[0] ?? "Яна"

  return (
    <div className="flex h-full flex-col bg-sidebar px-5 pb-6 pt-7 text-[#1c1f27]">
      <div className="px-2">
        <p className="text-[2rem] font-extrabold leading-7 tracking-[-0.055em]">
          <span className="block">China</span>
          <span className="block">Child</span>
        </p>
      </div>

      <div className="mt-12 flex flex-col items-start px-2">
        <div className="mb-4 h-16 w-16 overflow-hidden rounded-full bg-white shadow-sm">
          <Image
            src={placeholderImages.studentAvatar}
            alt="Аватар ученика"
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        </div>
        <h2 className="text-[3rem] leading-[0.96] font-semibold tracking-[-0.045em]">
          {firstName}
        </h2>
        <p className="mt-1 text-lg text-black/65">{`студент ${levelNumber} уровня`}</p>
      </div>

      <nav className="mt-8 flex-1 space-y-1.5">
        {navigation.map((item) => {
          const isActive = item.href ? pathname === item.href : false
          const content = (
            <>
              <item.icon className="h-[18px] w-[18px]" />
              {item.name}
            </>
          )

          return (
            <div key={item.name} className="px-1">
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn("ek-nav-item", isActive && "ek-nav-item-active")}
                >
                  {content}
                </Link>
              ) : (
                <div className="ek-nav-item cursor-default opacity-95">{content}</div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="px-2">
        <Button
          variant="ghost"
          onClick={logout}
          className="h-11 w-full justify-start rounded-full px-3 text-base text-black/60 hover:bg-black/5 hover:text-black"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </div>
    </div>
  )
}
