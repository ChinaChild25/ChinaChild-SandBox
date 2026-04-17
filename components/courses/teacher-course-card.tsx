"use client"

import Link from "next/link"
import { useState } from "react"
import type { TeacherCustomCourse } from "@/lib/types"

export function TeacherCourseCard({ course }: { course: TeacherCustomCourse }) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const initials = (course.teacher_name ?? "T")
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const avatarUrl = (course.teacher_avatar_url ?? "").trim()
  const showAvatar = avatarUrl.length > 0 && !avatarFailed

  return (
    <Link
      href={`/teacher/courses/${course.id}`}
      className="group relative block min-h-[220px] overflow-hidden rounded-[var(--ds-radius-xl)] p-6 text-inherit no-underline transition-transform hover:scale-[1.03]"
      style={{ background: course.cover_color || "linear-gradient(120deg, #5964ff, #9f5cff)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <p className="line-clamp-3 text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-white">
          {(course.title || "Новый курс").slice(0, 20)}
        </p>

        <div className="ml-auto flex translate-x-[-4px] items-center gap-2">
          {showAvatar ? (
            <img
              src={avatarUrl}
              alt={course.teacher_name ?? "Teacher"}
              className="h-10 w-10 rounded-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-sm font-bold text-white">
              {initials}
            </div>
          )}
          <p className="text-base leading-none text-white/90">{course.teacher_name ?? "Teacher"}</p>
        </div>
      </div>
    </Link>
  )
}
