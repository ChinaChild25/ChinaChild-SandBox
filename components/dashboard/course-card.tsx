"use client"

import { BookOpen, Clock, User } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import type { Course } from "@/lib/types"

interface CourseCardProps {
  course: Course
  variant?: "default" | "compact"
}

export function CourseCard({ course, variant = "default" }: CourseCardProps) {
  if (variant === "compact") {
    return (
      <Card className="group border-0 bg-muted/30 shadow-none hover:bg-muted/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-background border border-border flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded-md bg-background border border-border">
                  {course.level}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {course.category}
                </span>
              </div>
              <h3 className="font-medium truncate">{course.title}</h3>
              <p className="text-sm text-muted-foreground">{course.titleChinese}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>
                    {course.completedLessons} / {course.totalLessons} lessons
                  </span>
                  <span className="font-medium text-foreground">{course.progress}%</span>
                </div>
                <Progress value={course.progress} className="h-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group overflow-hidden border-0 bg-muted/30 shadow-none hover:bg-muted/50 transition-colors">
      <CardHeader className="p-0">
        <div className="h-32 bg-gradient-to-br from-muted to-background relative flex items-center justify-center border-b border-border">
          <BookOpen className="h-12 w-12 text-muted-foreground/30" />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="text-[10px] font-medium text-foreground uppercase tracking-wider px-2.5 py-1 rounded-lg bg-background border border-border">
              {course.level}
            </span>
          </div>
          {course.progress === 100 && (
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-medium text-background uppercase tracking-wider px-2.5 py-1 rounded-lg bg-foreground">
                Completed
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {course.category}
        </span>
        <h3 className="font-medium text-base mt-1 leading-snug">{course.title}</h3>
        <p className="text-sm text-muted-foreground">{course.titleChinese}</p>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {course.instructor}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {course.totalLessons} lessons
          </div>
        </div>

        {course.enrolled && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-1" />
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button 
          className={`w-full rounded-xl h-10 font-medium ${
            course.enrolled 
              ? "bg-foreground text-background hover:bg-foreground/90" 
              : "bg-transparent border border-border text-foreground hover:bg-foreground hover:text-background hover:border-foreground"
          }`}
          variant={course.enrolled ? "default" : "outline"}
        >
          {course.enrolled
            ? course.progress === 100
              ? "Review Course"
              : "Continue Learning"
            : "Enroll Now"}
        </Button>
      </CardFooter>
    </Card>
  )
}
