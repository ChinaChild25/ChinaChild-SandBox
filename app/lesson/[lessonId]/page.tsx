"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { SchoolLessonShell } from "@/layouts/school-lesson-shell"
import { CustomInteractiveLesson } from "@/components/school/custom-interactive-lesson"
import { FigmaAppShell } from "@/components/figma-app-shell"
import { AppSidebar } from "@/components/app-sidebar"
import { TeacherSidebar } from "@/components/teacher-sidebar"
import { JoinLessonButton } from "@/components/lessons/join-lesson-button"
import { LessonLiveSession } from "@/components/lessons/lesson-live-session"
import { useAuth } from "@/lib/auth-context"
import { useUiLocale } from "@/lib/ui-locale"
import type { TeacherLessonBlock } from "@/lib/types"

type LessonResponse = {
  lesson?: {
    id: string
    title: string
    course_id: string
    room_url?: string | null
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
  const searchParams = useSearchParams()
  const lessonId = params.lessonId
  const { user, isAuthenticated, authReady } = useAuth()
  const { locale, t } = useUiLocale()
  const isLiveMode = searchParams.get("join") === "1"

  const [lessonTitle, setLessonTitle] = useState("Урок")
  const [courseId, setCourseId] = useState("")
  const [roomUrl, setRoomUrl] = useState("")
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
    setRoomUrl(json.lesson.room_url?.trim() || "")
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
  const callButtonLabel =
    isLiveMode
      ? locale === "en"
        ? "Return to call"
        : locale === "zh"
          ? "返回通话"
          : "Вернуться в звонок"
      : roomUrl
      ? locale === "en"
        ? "Rejoin call"
        : locale === "zh"
          ? "返回通话"
          : "Вернуться в звонок"
      : locale === "en"
        ? "Open call"
        : locale === "zh"
          ? "进入通话"
          : "Открыть звонок"

  const handleDismissLiveMode = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("join")
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `/lesson/${lessonId}?${nextQuery}` : `/lesson/${lessonId}`)
  }, [lessonId, router, searchParams])

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
            heroActions={
              <JoinLessonButton
                lessonId={lessonId}
                label={callButtonLabel}
                className="mt-0 h-12 min-h-12 items-center whitespace-normal rounded-[999px] bg-black px-[22px] py-0 text-[15px] font-semibold leading-none text-white hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90"
              />
            }
          />
        )}
      </SchoolLessonShell>

      {!isLoading && !error && isLiveMode ? (
        <LessonLiveSession
          lessonId={lessonId}
          lessonTitle={lessonTitle}
          courseTitle={courseTitle}
          onDismiss={handleDismissLiveMode}
        />
      ) : null}
    </FigmaAppShell>
  )
}
