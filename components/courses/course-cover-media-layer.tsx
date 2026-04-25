"use client"

import { COURSE_COVER_PHOTO_SCRIM, courseCoverImageFromCourse, isAllowedExternalCoverImageUrl } from "@/lib/teacher-custom-course-form"
import { cn } from "@/lib/utils"

type CourseCoverMediaProps = {
  cover: {
    cover_image_url?: string | null
    cover_image_position?: string | null
    cover_image_scale?: number | null
    cover_image_flip_x?: boolean | null
    cover_image_flip_y?: boolean | null
  }
  className?: string
  imageClassName?: string
  showScrim?: boolean
  scrimClassName?: string
}

export function CourseCoverMediaLayer({
  cover,
  className,
  imageClassName,
  showScrim = true,
  scrimClassName,
}: CourseCoverMediaProps) {
  const image = courseCoverImageFromCourse(cover)
  if (!image.url || !isAllowedExternalCoverImageUrl(image.url)) return null

  const scaleX = image.flipX ? -1 : 1
  const scaleY = image.flipY ? -1 : 1

  return (
    <>
      <img
        src={image.url}
        alt=""
        aria-hidden
        draggable={false}
        className={cn("pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover", className, imageClassName)}
        style={{
          objectPosition: image.position,
          transform: `scale(${image.scale}) scaleX(${scaleX}) scaleY(${scaleY})`,
          transformOrigin: "center",
        }}
      />
      {showScrim ? (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 z-0", scrimClassName)}
          style={{ background: COURSE_COVER_PHOTO_SCRIM }}
        />
      ) : null}
    </>
  )
}
