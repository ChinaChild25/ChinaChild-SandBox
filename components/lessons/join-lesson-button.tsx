"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Video } from "lucide-react"
import { buildLessonCallHref } from "@/lib/daily/links"
import { useUiLocale } from "@/lib/ui-locale"
import { Button } from "@/components/ui/button"

type Props = {
  lessonId: string
  label?: string
  className?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "chinaGlass"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
}

export function JoinLessonButton({
  lessonId,
  label,
  className,
  variant = "default",
  size = "default"
}: Props) {
  const router = useRouter()
  const { locale } = useUiLocale()
  const [isOpening, setIsOpening] = useState(false)

  const resolvedLabel =
    label ??
    (locale === "en" ? "Join lesson" : locale === "zh" ? "进入课堂" : "Подключиться")

  function handleJoin() {
    if (isOpening) return
    setIsOpening(true)
    router.push(buildLessonCallHref(lessonId))
  }

  return (
    <Button type="button" className={className} variant={variant} size={size} onClick={handleJoin} disabled={isOpening}>
      {isOpening ? <LoaderCircle className="animate-spin" aria-hidden /> : <Video aria-hidden />}
      {resolvedLabel}
    </Button>
  )
}
