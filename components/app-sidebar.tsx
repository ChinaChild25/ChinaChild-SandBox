"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  ChevronRight,
  Gauge,
  Calendar,
  MessagesSquare,
  MousePointerClick,
  Settings,
  ShieldCheck,
  LogOut,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { placeholderImages } from "@/lib/placeholders"
import { BrandLogo } from "@/components/brand-logo"

type SidebarItem = {
  name: string
  icon: LucideIcon
  href?: string
}

const navigation: SidebarItem[] = [
  { name: "Дашборд", href: "/dashboard", icon: Gauge },
  { name: "Прогресс", href: "/progress", icon: ShieldCheck },
  { name: "Расписание", href: "/schedule", icon: Calendar },
  { name: "Сообщения", href: "/messages", icon: MessagesSquare },
  { name: "Настройки", href: "/settings", icon: Settings }
]

const courseLinks = [
  { name: "HSK 1", href: "/courses/hsk1" },
  { name: "HSK 2", href: "/courses/hsk2" }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [openedSections, setOpenedSections] = useState({
    courses: true,
    workspace: true
  })

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
        <BrandLogo />
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

      <div className="mt-8 flex-1 overflow-y-auto pr-1">
        <Accordion
          type="multiple"
          value={Object.entries(openedSections).filter(([, open]) => open).map(([key]) => key)}
          onValueChange={(values) =>
            setOpenedSections({
              courses: values.includes("courses"),
              workspace: values.includes("workspace")
            })
          }
          className="space-y-1"
        >
          <AccordionItem value="courses" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-left text-[0.94rem] font-semibold tracking-[0.06em] text-black/55 uppercase hover:no-underline">
              <span>Курсы</span>
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              <div className="space-y-1 px-1">
                <Link
                  href="/courses"
                  className={cn(
                    "cc-glass-nav-item",
                    pathname === "/courses" && "cc-glass-nav-item--active"
                  )}
                >
                  <MousePointerClick className="h-[18px] w-[18px] shrink-0" />
                  Мои курсы
                </Link>
                {courseLinks.map((course) => {
                  const isActive = pathname === course.href
                  return (
                    <Link
                      key={course.name}
                      href={course.href}
                      className={cn(
                        "cc-glass-nav-item cc-glass-nav-item--compact ml-6 gap-2",
                        isActive && "cc-glass-nav-item--active"
                      )}
                    >
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      {course.name}
                    </Link>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="workspace" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-left text-[0.94rem] font-semibold tracking-[0.06em] text-black/55 uppercase hover:no-underline">
              <span>Разделы</span>
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              <nav className="space-y-1 px-1">
                {navigation.map((item) => {
                  const isActive = item.href ? pathname === item.href : false
                  const content = (
                    <>
                      <item.icon className="h-[18px] w-[18px]" />
                      {item.name}
                    </>
                  )

                  return (
                    <div key={item.name}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className={cn(
                            "cc-glass-nav-item",
                            isActive && "cc-glass-nav-item--active"
                          )}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="cc-glass-nav-item cursor-default opacity-95">{content}</div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="px-2">
        <Button
          variant="chinaSecondary"
          onClick={logout}
          className="!h-auto !min-h-12 w-full justify-start rounded-[var(--play-button-radius)] px-4 text-base font-semibold"
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" />
          Выйти
        </Button>
      </div>
    </div>
  )
}
