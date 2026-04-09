"use client"

import Link from "next/link"
import {
  BookOpen,
  Calendar,
  Clock,
  Flame,
  TrendingUp,
  ArrowRight,
  Bell
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/lib/auth-context"
import { mockCourses, mockLessons, mockNotifications } from "@/lib/mock-data"
import { StatsCard } from "@/components/dashboard/stats-card"
import { CourseCard } from "@/components/dashboard/course-card"
import { LessonCard } from "@/components/dashboard/lesson-card"

export default function DashboardPage() {
  const { user } = useAuth()
  
  const enrolledCourses = mockCourses.filter((c) => c.enrolled)
  const upcomingLessons = mockLessons.slice(0, 4)
  const unreadNotifications = mockNotifications.filter((n) => !n.read)

  const totalProgress = Math.round(
    enrolledCourses.reduce((acc, c) => acc + c.progress, 0) / enrolledCourses.length
  )

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {getGreeting()}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {user?.name?.split(" ")[0] || "Learner"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {"Ready to continue your learning journey?"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild className="rounded-xl h-10 border-border hover:bg-muted">
            <Link href="/dashboard/schedule">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Link>
          </Button>
          <Button asChild className="rounded-xl h-10 bg-foreground text-background hover:bg-foreground/90">
            <Link href="/dashboard/courses">
              Browse Courses
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Learning Streak"
          value={`${user?.learningStreak || 0} days`}
          subtitle="Keep it up"
          icon={Flame}
          trend={{ value: 20, label: "vs last week" }}
        />
        <StatsCard
          title="Completed"
          value={user?.totalLessonsCompleted || 0}
          subtitle="Lessons finished"
          icon={BookOpen}
          trend={{ value: 12, label: "this month" }}
        />
        <StatsCard
          title="Study Time"
          value={`${user?.totalStudyHours || 0}h`}
          subtitle="Total hours"
          icon={Clock}
        />
        <StatsCard
          title="Progress"
          value={`${totalProgress}%`}
          subtitle="Overall completion"
          icon={TrendingUp}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Lessons */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming Lessons</h2>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link href="/dashboard/schedule">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {upcomingLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Notifications</h2>
            {unreadNotifications.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-lg bg-muted">
                {unreadNotifications.length} new
              </span>
            )}
          </div>
          <Card className="border-0 bg-muted/30 shadow-none">
            <CardContent className="p-0">
              {mockNotifications.slice(0, 4).map((notification, index) => (
                <div
                  key={notification.id}
                  className={`p-4 ${
                    index !== 0 ? "border-t border-border" : ""
                  } ${!notification.read ? "bg-background/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Continue Learning */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Continue Learning</h2>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/courses">
              All courses
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {enrolledCourses
            .filter((c) => c.progress < 100)
            .slice(0, 4)
            .map((course) => (
              <CourseCard key={course.id} course={course} variant="compact" />
            ))}
        </div>
      </div>

      {/* Weekly Goal */}
      <Card className="border border-border bg-muted/20 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Weekly Learning Goal
          </CardTitle>
          <CardDescription>
            Complete 5 lessons this week to maintain your streak
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">3 of 5 lessons completed</span>
                <span className="font-medium">60%</span>
              </div>
              <Progress value={60} className="h-2" />
            </div>
            <Button className="rounded-xl h-10 bg-foreground text-background hover:bg-foreground/90">
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
