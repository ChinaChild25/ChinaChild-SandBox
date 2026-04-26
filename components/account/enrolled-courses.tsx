"use client"

import Link from "next/link"
import { BookOpen, Clock, User, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { mockCourses } from "@/lib/mock-data"

export function EnrolledCourses() {
  const enrolledCourses = mockCourses.filter((c) => c.enrolled)

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Enrolled Courses</CardTitle>
            <CardDescription>
              Your active courses and learning progress
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            asChild 
            className="rounded-lg"
          >
            <Link href="/dashboard/courses">
              Browse More
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {enrolledCourses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-background border border-border hover:border-muted-foreground/20 transition-colors"
            >
              <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl bg-muted border border-border flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                    {course.level}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {course.category}
                  </span>
                  {course.progress === 100 && (
                    <span className="text-[10px] font-medium text-background px-2 py-0.5 rounded-md bg-foreground">
                      Completed
                    </span>
                  )}
                </div>
                
                <h3 className="font-medium">{course.title}</h3>
                <p className="text-sm text-muted-foreground">{course.titleChinese}</p>
                
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {course.instructor}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {course.completedLessons}/{course.totalLessons} lessons
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-1" />
                </div>
              </div>
              
              <Button
                className={`shrink-0 w-full sm:w-auto rounded-xl h-10 ${
                  course.progress === 100 
                    ? "bg-transparent border border-border text-foreground hover:bg-foreground hover:text-background hover:border-foreground" 
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
                variant={course.progress === 100 ? "outline" : "default"}
              >
                {course.progress === 100 ? "Review" : "Continue"}
              </Button>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-2xl font-semibold">
              {enrolledCourses.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Active Courses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">
              {enrolledCourses.filter((c) => c.progress === 100).length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">
              {Math.round(
                enrolledCourses.reduce((acc, c) => acc + c.progress, 0) /
                  enrolledCourses.length
              )}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Avg. Progress</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
