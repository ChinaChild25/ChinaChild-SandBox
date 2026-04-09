"use client"

import { BookOpen, Clock, User } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import type { Course } from "@/lib/types"

interface CourseCardProps {
  course: Course
  variant?: "default" | "compact"
}

export function CourseCard({ course, variant = "default" }: CourseCardProps) {
  const levelColors = {
    Beginner: "bg-green-100 text-green-700",
    Elementary: "bg-blue-100 text-blue-700",
    Intermediate: "bg-amber-100 text-amber-700",
    Advanced: "bg-red-100 text-red-700"
  }

  const categoryIcons = {
    Speaking: "speaking",
    Reading: "reading",
    Writing: "writing",
    Grammar: "grammar",
    Culture: "culture"
  }

  if (variant === "compact") {
    return (
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="secondary"
                  className={`text-xs ${levelColors[course.level]}`}
                >
                  {course.level}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {course.category}
                </Badge>
              </div>
              <h3 className="font-semibold truncate">{course.title}</h3>
              <p className="text-sm text-muted-foreground">{course.titleChinese}</p>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {course.completedLessons} / {course.totalLessons} lessons
                  </span>
                  <span>{course.progress}%</span>
                </div>
                <Progress value={course.progress} className="h-1.5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all">
      <CardHeader className="p-0">
        <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 relative flex items-center justify-center">
          <BookOpen className="h-16 w-16 text-primary/40" />
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge
              variant="secondary"
              className={`${levelColors[course.level]}`}
            >
              {course.level}
            </Badge>
          </div>
          {course.progress === 100 && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-green-500 text-white">Completed</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <Badge variant="outline" className="mb-2 text-xs">
          {course.category}
        </Badge>
        <h3 className="font-semibold text-lg leading-snug">{course.title}</h3>
        <p className="text-primary font-medium">{course.titleChinese}</p>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {course.instructor}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {course.totalLessons} lessons
          </div>
        </div>

        {course.enrolled && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-2" />
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full" variant={course.enrolled ? "default" : "outline"}>
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
