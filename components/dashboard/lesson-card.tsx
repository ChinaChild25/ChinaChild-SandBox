"use client"

import { Calendar, Clock, Video, Radio, FileText, HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Lesson } from "@/lib/types"

interface LessonCardProps {
  lesson: Lesson
}

export function LessonCard({ lesson }: LessonCardProps) {
  const typeConfig = {
    Video: { icon: Video, color: "bg-blue-100 text-blue-700" },
    Live: { icon: Radio, color: "bg-red-100 text-red-700" },
    Practice: { icon: FileText, color: "bg-green-100 text-green-700" },
    Quiz: { icon: HelpCircle, color: "bg-amber-100 text-amber-700" }
  }

  const config = typeConfig[lesson.type]
  const Icon = config.icon

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow"
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={`h-12 w-12 rounded-lg ${config.color} flex items-center justify-center shrink-0`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className={`text-xs ${config.color}`}>
                {lesson.type}
              </Badge>
            </div>
            <h4 className="font-semibold truncate">{lesson.title}</h4>
            <p className="text-sm text-primary">{lesson.titleChinese}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(lesson.scheduledDate)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {lesson.scheduledTime}
              </div>
              <span>{lesson.duration}</span>
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0">
            {lesson.type === "Live" ? "Join" : "Start"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
