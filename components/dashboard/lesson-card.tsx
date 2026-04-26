"use client"

import { Calendar, Clock, Video, Radio, FileText, HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Lesson } from "@/lib/types"

interface LessonCardProps {
  lesson: Lesson
}

export function LessonCard({ lesson }: LessonCardProps) {
  const typeConfig = {
    Video: { icon: Video, label: "Video" },
    Live: { icon: Radio, label: "Live" },
    Practice: { icon: FileText, label: "Practice" },
    Quiz: { icon: HelpCircle, label: "Quiz" }
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
    <Card className="border-0 bg-muted/30 shadow-none hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-background border border-border">
                {lesson.type}
              </span>
            </div>
            <h4 className="font-medium truncate">{lesson.title}</h4>
            <p className="text-sm text-muted-foreground">{lesson.titleChinese}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(lesson.scheduledDate)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lesson.scheduledTime}
              </div>
              <span>{lesson.duration}</span>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="shrink-0 rounded-lg h-9 px-4"
          >
            {lesson.type === "Live" ? "Join" : "Start"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
