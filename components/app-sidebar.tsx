"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Calendar,
  GraduationCap,
  Home,
  Library,
  Settings,
  Trophy,
  User,
  Headphones,
  PenTool
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Progress } from "@/components/ui/progress"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "My Courses", href: "/dashboard/courses", icon: BookOpen },
  { name: "Vocabulary", href: "/dashboard/vocabulary", icon: PenTool },
  { name: "Listening", href: "/dashboard/listening", icon: Headphones },
  { name: "Schedule", href: "/dashboard/schedule", icon: Calendar },
  { name: "Resources", href: "/dashboard/resources", icon: Library }
]

const accountNav = [
  { name: "My Account", href: "/account", icon: User },
  { name: "Settings", href: "/account/settings", icon: Settings }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  const levelProgress = {
    Beginner: 25,
    Elementary: 50,
    Intermediate: 75,
    Advanced: 100
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Logo for mobile */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background font-semibold text-sm">
          L
        </div>
        <span className="font-semibold tracking-tight">Lingua</span>
      </div>

      {/* User Level Card */}
      <div className="p-4 border-b border-border">
        <div className="rounded-2xl bg-muted/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Level</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold">{user?.level || "Beginner"}</span>
            <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-lg bg-background">
              {user?.learningStreak || 0} day streak
            </span>
          </div>
          <Progress
            value={levelProgress[user?.level || "Beginner"]}
            className="h-1.5"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {user?.level === "Advanced"
              ? "Maximum level reached"
              : `Progress to ${user?.level === "Beginner" ? "Elementary" : user?.level === "Elementary" ? "Intermediate" : "Advanced"}`}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
          Learning
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}

        <div className="my-4 border-t border-border" />

        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
          Account
        </p>
        {accountNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer stats */}
      <div className="border-t border-border p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-lg font-semibold">
              {user?.totalLessonsCompleted || 0}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lessons</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-lg font-semibold">
              {user?.totalStudyHours || 0}h
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Study Time</p>
          </div>
        </div>
      </div>
    </div>
  )
}
