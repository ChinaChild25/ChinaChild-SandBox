"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type JoinRoomResponse = {
  error?: string
}

type Props = {
  lessonId: string
  label?: string
  className?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "chinaGlass"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
}

export function JoinLessonButton({
  lessonId,
  label = "Join Lesson",
  className,
  variant = "default",
  size = "default"
}: Props) {
  const router = useRouter()
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    if (isJoining) return

    setIsJoining(true)
    setError(null)

    try {
      const response = await fetch("/api/create-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ lessonId })
      })

      const payload = (await response.json().catch(() => null)) as JoinRoomResponse | null
      if (!response.ok) {
        setError(payload?.error ?? "Unable to open the lesson call right now.")
        setIsJoining(false)
        return
      }

      router.push(`/lesson/${lessonId}?join=1`)
    } catch {
      setError("Unable to open the lesson call right now.")
      setIsJoining(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button type="button" variant={variant} size={size} onClick={handleJoin} disabled={isJoining}>
        {isJoining ? <LoaderCircle className="animate-spin" aria-hidden /> : <Video aria-hidden />}
        {label}
      </Button>
      {error ? <p className="text-xs text-[#b9495f] dark:text-[#ff9bb0]">{error}</p> : null}
    </div>
  )
}
