"use client"

import { ImageIcon } from "lucide-react"
import { CourseCoverMediaLayer } from "@/components/courses/course-cover-media-layer"
import { courseCoverHasImage } from "@/lib/teacher-custom-course-form"
import { cn } from "@/lib/utils"

type CourseArtworkSlotProps = {
  cover: {
    cover_image_url?: string | null
    cover_image_position?: string | null
    cover_image_scale?: number | null
    cover_image_flip_x?: boolean | null
    cover_image_flip_y?: boolean | null
    cover_style?: string | null
  }
  accentColor: string
  className?: string
  iconClassName?: string
}

export function CourseArtworkSlot({
  cover,
  accentColor,
  className,
  iconClassName,
}: CourseArtworkSlotProps) {
  const hasImage = courseCoverHasImage(cover)

  return (
    <div className={cn("relative flex h-full w-full items-center justify-center overflow-hidden", className)}>
      {hasImage ? (
        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
          <CourseCoverMediaLayer
            cover={cover}
            showScrim={false}
            className="rounded-[inherit]"
            imageClassName="rounded-[inherit]"
          />
        </div>
      ) : (
        <ImageIcon
          className={cn("h-[56%] w-[56%] opacity-70", iconClassName)}
          style={{ color: accentColor }}
          strokeWidth={1.65}
          aria-hidden
        />
      )}
    </div>
  )
}
