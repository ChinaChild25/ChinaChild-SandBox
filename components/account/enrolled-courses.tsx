"use client"

import Link from "next/link"
import { BookOpen, Clock, User, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { mockCourses } from "@/lib/mock-data"

export function EnrolledCourses() {
  const enrolledCourses = mockCourses.filter((c) => c.enrolled)

  const levelColors = {
    Beginner: "bg-green-100 text-green-700",
    Elementary: "bg-blue-100 text-blue-700",
    Intermediate: "bg-amber-100 text-amber-700",
    Advanced: "bg-red-100 text-red-700"
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Enrolled Courses</CardTitle>
            <CardDescription>
              Your active courses and learning progress
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/courses">
              Browse More
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {enrolledCourses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${levelColors[course.level]}`}
                  >
                    {course.level}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {course.category}
                  </Badge>
                  {course.progress === 100 && (
                    <Badge className="bg-green-500 text-white text-xs">
                      Completed
                    </Badge>
                  )}
                </div>
                
                <h3 className="font-semibold">{course.title}</h3>
                <p className="text-sm text-primary">{course.titleChinese}</p>
                
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {course.instructor}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {course.completedLessons}/{course.totalLessons} lessons
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>
              </div>
              
              <Button
                variant={course.progress === 100 ? "outline" : "default"}
                className="shrink-0 w-full sm:w-auto"
              >
                {course.progress === 100 ? "Review" : "Continue"}
              </Button>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {enrolledCourses.length}
            </p>
            <p className="text-sm text-muted-foreground">Active Courses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {enrolledCourses.filter((c) => c.progress === 100).length}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {Math.round(
                enrolledCourses.reduce((acc, c) => acc + c.progress, 0) /
                  enrolledCourses.length
              )}
              %
            </p>
            <p className="text-sm text-muted-foreground">Avg. Progress</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
