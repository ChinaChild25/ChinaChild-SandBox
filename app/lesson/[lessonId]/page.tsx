"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { SchoolLessonShell } from "@/layouts/school-lesson-shell"
import { CustomInteractiveLesson } from "@/components/school/custom-interactive-lesson"
import { FigmaAppShell } from "@/components/figma-app-shell"
import { AppSidebar } from "@/components/app-sidebar"
import { TeacherSidebar } from "@/components/teacher-sidebar"
import { useAuth } from "@/lib/auth-context"
import { useUiLocale } from "@/lib/ui-locale"
import type { TeacherLessonBlock } from "@/lib/types"

type LessonResponse = {
  lesson?: {
    id: string
    title: string
    course_id: string
    course_title?: string | null
    course_cover_color?: string | null
    course_cover_style?: string | null
    course_cover_image_url?: string | null
  }
  blocks?: TeacherLessonBlock[]
  error?: string
}

export default function StudentLessonPage() {
  const params = useParams<{ lessonId: string }>()
  const router = useRouter()
  const lessonId = params.lessonId
  const { user, isAuthenticated, authReady } = useAuth()
  const { t } = useUiLocale()

  const [lessonTitle, setLessonTitle] = useState("Урок")
  const [courseId, setCourseId] = useState("")
  const [courseTitle, setCourseTitle] = useState<string | undefined>(undefined)
  const [courseCoverColor, setCourseCoverColor] = useState<string | undefined>(undefined)
  const [courseCoverStyle, setCourseCoverStyle] = useState<string | undefined>(undefined)
  const [courseCoverImageUrl, setCourseCoverImageUrl] = useState<string | undefined>(undefined)
  const [blocks, setBlocks] = useState<TeacherLessonBlock[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadLesson()
  }, [lessonId])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.replace("/")
    }
  }, [authReady, isAuthenticated, router])

  async function loadLesson() {
    setIsLoading(true)
    const res = await fetch(`/api/lessons/${lessonId}`, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as LessonResponse | null
    if (!res.ok || !json?.lesson) {
      setError(json?.error ?? "Не удалось загрузить урок")
      setIsLoading(false)
      return
    }
    setError(null)
    setLessonTitle(json.lesson.title)
    setCourseId(json.lesson.course_id ?? "")
    setCourseTitle(json.lesson.course_title ?? undefined)
    setCourseCoverColor(json.lesson.course_cover_color?.trim() || undefined)
    setCourseCoverStyle(json.lesson.course_cover_style?.trim() || undefined)
    setCourseCoverImageUrl(json.lesson.course_cover_image_url?.trim() || undefined)
    setBlocks((json.blocks ?? []).sort((a, b) => a.order - b.order))
    setIsLoading(false)
  }

  const isTeacher = user?.role === "teacher" || user?.role === "curator"
  const backHref = isTeacher ? `/teacher/lessons/${lessonId}` : courseId ? `/courses/${courseId}` : "/courses"
  const backLabel = isTeacher ? "Редактор" : (courseTitle?.trim() || "Курс")

  if (!authReady || !isAuthenticated) {
    return (
      <div className="ds-app-canvas">
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("app.loading")}</div>
        </div>
      </div>
    )
  }

  return (
    <FigmaAppShell
      logoHref={isTeacher ? "/teacher/dashboard" : "/dashboard"}
      renderSidebar={(props) => (isTeacher ? <TeacherSidebar variant={props.variant} /> : <AppSidebar variant={props.variant} />)}
    >
      <SchoolLessonShell>
        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-[18px] text-ds-text-secondary">Загрузка урока...</div>
        ) : error ? (
          <div className="rounded-[28px] border border-[#d98b95]/35 bg-[#fff4f5] px-5 py-5 text-[15px] leading-7 text-[#9b3948] dark:border-[#7d3d49] dark:bg-[#2e1d21] dark:text-[#ffb8c4]">
            {error}
          </div>
        ) : (
          <CustomInteractiveLesson
            lessonId={lessonId}
            lessonTitle={lessonTitle}
            courseTitle={courseTitle}
            courseCoverColor={courseCoverColor}
            courseCoverStyle={courseCoverStyle}
            courseCoverImageUrl={courseCoverImageUrl}
            backHref={backHref}
            backLabel={backLabel}
            blocks={blocks}
          />
        )}
      </SchoolLessonShell>
    </FigmaAppShell>
  )
}
