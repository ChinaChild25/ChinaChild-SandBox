"use client"

import { useMemo } from "react"
import { parseLessonVideoEmbed } from "@/lib/lesson-video-embed"
import { cn } from "@/lib/utils"

export function InlineLessonVideo({ url, className }: { url: string; className?: string }) {
  const embed = useMemo(() => parseLessonVideoEmbed(url), [url])
  if (!url.trim()) return null

  if (embed.mode === "iframe") {
    return (
      <div className={cn("aspect-video w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-black/5", className)}>
        <iframe
          src={embed.src}
          title={embed.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <video
      src={url.trim()}
      controls
      className={cn("w-full max-h-[28rem] rounded-lg border border-border bg-black/5", className)}
      preload="metadata"
    />
  )
}
