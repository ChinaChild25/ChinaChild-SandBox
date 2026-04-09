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
import { Badge } from "@/components/ui/badge"
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
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-balance">
            {getGreeting()}, {user?.name?.split(" ")[0] || "Learner"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {"Ready to continue your Chinese learning journey?"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard/schedule">
              <Calendar className="h-4 w-4 mr-2" />
              View Schedule
            </Link>
          </Button>
          <Button asChild>
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
          subtitle="Keep it up!"
          icon={Flame}
          trend={{ value: 20, label: "vs last week" }}
        />
        <StatsCard
          title="Completed Lessons"
          value={user?.totalLessonsCompleted || 0}
          subtitle="Across all courses"
          icon={BookOpen}
          trend={{ value: 12, label: "this month" }}
        />
        <StatsCard
          title="Study Hours"
          value={`${user?.totalStudyHours || 0}h`}
          subtitle="Total time spent"
          icon={Clock}
        />
        <StatsCard
          title="Overall Progress"
          value={`${totalProgress}%`}
          subtitle="Enrolled courses"
          icon={TrendingUp}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Lessons */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Upcoming Lessons</h2>
            <Button variant="ghost" size="sm" asChild>
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
            <h2 className="text-xl font-semibold">Notifications</h2>
            {unreadNotifications.length > 0 && (
              <Badge variant="secondary">{unreadNotifications.length} new</Badge>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {mockNotifications.slice(0, 4).map((notification, index) => (
                <div
                  key={notification.id}
                  className={`p-4 ${
                    index !== 0 ? "border-t border-border" : ""
                  } ${!notification.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        notification.type === "lesson"
                          ? "bg-blue-100 text-blue-600"
                          : notification.type === "achievement"
                            ? "bg-amber-100 text-amber-600"
                            : notification.type === "reminder"
                              ? "bg-red-100 text-red-600"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
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
          <h2 className="text-xl font-semibold">Continue Learning</h2>
          <Button variant="ghost" size="sm" asChild>
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
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weekly Learning Goal
          </CardTitle>
          <CardDescription>
            Complete 5 lessons this week to earn bonus XP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>3 of 5 lessons completed</span>
                <span className="font-medium">60%</span>
              </div>
              <Progress value={60} className="h-3" />
            </div>
            <Button>Continue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
