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
  User
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "My Courses", href: "/dashboard/courses", icon: BookOpen },
  { name: "Schedule", href: "/dashboard/schedule", icon: Calendar },
  { name: "Resources", href: "/dashboard/resources", icon: Library },
  { name: "Achievements", href: "/dashboard/achievements", icon: Trophy }
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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo for mobile */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg">
          中
        </div>
        <span className="font-semibold">HanYu Academy</span>
      </div>

      {/* User Level Card */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-sidebar-primary" />
            <span className="text-sm font-medium">Current Level</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold">{user?.level || "Beginner"}</span>
            <Badge variant="secondary" className="text-xs">
              {user?.learningStreak || 0} day streak
            </Badge>
          </div>
          <Progress
            value={levelProgress[user?.level || "Beginner"]}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {user?.level === "Advanced"
              ? "Maximum level reached!"
              : `Progress to ${user?.level === "Beginner" ? "Elementary" : user?.level === "Elementary" ? "Intermediate" : "Advanced"}`}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Learning
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}

        <div className="my-4 border-t border-sidebar-border" />

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Account
        </p>
        {accountNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer stats */}
      <div className="border-t border-sidebar-border p-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-sidebar-accent p-2">
            <p className="text-lg font-bold text-sidebar-primary">
              {user?.totalLessonsCompleted || 0}
            </p>
            <p className="text-xs text-muted-foreground">Lessons</p>
          </div>
          <div className="rounded-lg bg-sidebar-accent p-2">
            <p className="text-lg font-bold text-sidebar-primary">
              {user?.totalStudyHours || 0}h
            </p>
            <p className="text-xs text-muted-foreground">Study Time</p>
          </div>
        </div>
      </div>
    </div>
  )
}
