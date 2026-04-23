"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type LessonBlockProps = {
  id?: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  children: ReactNode
  className?: string
}

export function LessonBlock({ id, eyebrow, title, intro, children, className }: LessonBlockProps) {
  return (
    <section className={cn("cc-lesson-card", className)} id={id}>
      <div className="cc-lesson-head">
        {eyebrow ? <span className="cc-lesson-eyebrow">{eyebrow}</span> : null}
        <h2 className="cc-lesson-section-title">{title}</h2>
        {intro ? <div className="mt-3">{intro}</div> : null}
      </div>
      <div className="mt-6 min-w-0">{children}</div>
    </section>
  )
}
