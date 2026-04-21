"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Plus, Settings, Sparkles } from "lucide-react"
import type { TeacherCourseModule, TeacherCustomCourse, TeacherLesson } from "@/lib/types"
import { CourseCurriculumEditor } from "@/components/courses/course-curriculum-editor"
import { CourseDetailContent } from "@/components/courses/course-detail-content"
import { EditCustomCourseModal } from "@/components/courses/edit-custom-course-modal"
import { courseCoverFromCourse } from "@/lib/teacher-custom-course-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function TeacherCourseBuilderContent({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<TeacherCustomCourse | null>(null)
  const [lessons, setLessons] = useState<TeacherLesson[]>([])
  const [modules, setModules] = useState<TeacherCourseModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [headerAvatarFailed, setHeaderAvatarFailed] = useState(false)

  useEffect(() => {
    if (courseId === "hsk1" || courseId === "hsk2") return
    void loadCourse()
  }, [courseId])

  useEffect(() => {
    setHeaderAvatarFailed(false)
  }, [courseId, course?.teacher_avatar_url])

  async function loadCourse(opts?: { silent?: boolean }) {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    const [courseRes, lessonsRes, modulesRes] = await Promise.all([
      fetch(`/api/teacher/courses/${courseId}`, { cache: "no-store" }),
      fetch(`/api/teacher/courses/${courseId}/lessons`, { cache: "no-store" }),
      fetch(`/api/teacher/courses/${courseId}/modules`, { cache: "no-store" })
    ])
    const courseJson = (await courseRes.json().catch(() => null)) as { course?: TeacherCustomCourse; error?: string } | null
    const lessonsJson = (await lessonsRes.json().catch(() => null)) as { lessons?: TeacherLesson[]; error?: string } | null
    const modulesJson = (await modulesRes.json().catch(() => null)) as { modules?: TeacherCourseModule[]; error?: string } | null

    if (!courseRes.ok || !courseJson?.course) {
      setError(courseJson?.error ?? "Курс не найден")
      if (!silent) setLoading(false)
      return
    }
    if (!lessonsRes.ok) {
      setError(lessonsJson?.error ?? "Не удалось загрузить уроки")
      if (!silent) setLoading(false)
      return
    }
    if (!modulesRes.ok) {
      setError(modulesJson?.error ?? "Не удалось загрузить разделы курса")
      if (!silent) setLoading(false)
      return
    }
    setCourse(courseJson.course)
    setLessons(lessonsJson?.lessons ?? [])
    setModules(modulesJson?.modules ?? [])
    if (!silent) setLoading(false)
  }

  async function createFirstLesson() {
    const res = await fetch(`/api/teacher/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Урок ${lessons.length + 1}`, moduleId: null })
    })
    const json = (await res.json().catch(() => null)) as { lesson?: TeacherLesson; error?: string } | null
    if (!res.ok || !json?.lesson) {
      setError(json?.error ?? "Не удалось создать урок")
      return
    }
    window.location.href = `/teacher/lessons/${json.lesson.id}`
  }

  async function createFirstModule() {
    setError(null)
    const res = await fetch(`/api/teacher/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Раздел 1" })
    })
    const json = (await res.json().catch(() => null)) as { module?: TeacherCourseModule; error?: string } | null
    if (!res.ok || !json?.module) {
      setError(json?.error ?? "Не удалось создать раздел")
      return
    }
    await loadCourse({ silent: true })
  }

  async function deleteLesson(lessonId: string) {
    const confirmDelete = window.confirm("Удалить урок?")
    if (!confirmDelete) return
    const snapshot = lessons.find((l) => l.id === lessonId)
    if (!snapshot) return
    setError(null)
    setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId))
    const res = await fetch(`/api/teacher/lessons/${lessonId}`, { method: "DELETE" })
    if (!res.ok) {
      setLessons((prev) => {
        const next = [...prev, snapshot]
        next.sort((a, b) => {
          const am = a.module_id ?? ""
          const bm = b.module_id ?? ""
          if (am !== bm) return am.localeCompare(bm)
          return a.order - b.order
        })
        return next
      })
      setError("Не удалось удалить урок")
    }
  }

  if (courseId === "hsk1" || courseId === "hsk2") {
    return (
      <CourseDetailContent
        courseId={courseId}
        coursesListHref="/teacher/courses"
        progressHref="/teacher/progress"
      />
    )
  }

  if (loading) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] text-sm text-ds-text-secondary">Загрузка курса...</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="ds-figma-page">
        <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">{error ?? "Курс не найден"}</div>
      </div>
    )
  }

  const showCurriculum = lessons.length > 0 || modules.length > 0

  const headerInitials = (course.teacher_name ?? "T")
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const headerAvatarUrl = (course.teacher_avatar_url ?? "").trim()
  const showHeaderAvatar = headerAvatarUrl.length > 0 && !headerAvatarFailed

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-6">
        <Link href="/teacher/courses" className="inline-flex items-center gap-1 text-sm text-ds-text-tertiary hover:text-ds-ink">
          <ChevronLeft className="h-4 w-4" />
          Назад к курсам
        </Link>

        <header
          className="relative min-h-[220px] overflow-hidden rounded-[var(--ds-radius-xl)] p-6 text-inherit"
          style={courseCoverFromCourse(course)}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-[var(--ds-radius-xl)] bg-transparent dark:bg-black/50"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 z-20 size-11 shrink-0 rounded-[10px] text-ds-ink transition-colors hover:bg-black/[0.06] dark:text-white dark:hover:bg-white/15"
                aria-label="Настройки курса"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-5 shrink-0" strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Название, уровень, описание, обложка</TooltipContent>
          </Tooltip>
          <div className="relative z-10 flex min-h-[188px] flex-col justify-between pr-12">
            <div>
              <h1 className="line-clamp-3 text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-ds-ink">
                {(course.title || "Курс").slice(0, 20)}
              </h1>
              {course.level ? (
                <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-ds-text-secondary">{course.level}</p>
              ) : null}
              <p className="mt-2 line-clamp-3 text-sm leading-snug text-ds-text-secondary">
                {course.description?.trim() ? course.description : "Описание не добавлено"}
              </p>
            </div>
            <div className="mt-6 flex translate-x-[-4px] items-center gap-2 sm:mt-0">
              {showHeaderAvatar ? (
                <img
                  src={headerAvatarUrl}
                  alt={course.teacher_name ?? "Преподаватель"}
                  className="h-10 w-10 rounded-full object-cover"
                  onError={() => setHeaderAvatarFailed(true)}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-sm font-bold text-ds-ink dark:border-white/20 dark:bg-zinc-950/55">
                  {headerInitials}
                </div>
              )}
              <p className="text-base leading-none text-ds-ink">{course.teacher_name ?? "Преподаватель"}</p>
            </div>
          </div>
        </header>

        <EditCustomCourseModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          courseId={courseId}
          course={course}
          onSaved={(next) => {
            setCourse(next)
            setHeaderAvatarFailed(false)
          }}
        />

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {!showCurriculum ? (
          <Empty className="border-border bg-ds-surface-muted">
            <EmptyHeader>
              <EmptyTitle>У вас пока нет уроков</EmptyTitle>
              <EmptyDescription>Добавьте разделы и уроки или начните с одного урока без раздела</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => void createFirstLesson()}>
                <Plus className="mr-1 h-4 w-4" />
                Создать урок
              </Button>
              <Button variant="outline" onClick={() => void createFirstModule()}>
                <Plus className="mr-1 h-4 w-4" />
                Добавить раздел
              </Button>
              <Button variant="outline" disabled>
                <Sparkles className="mr-1 h-4 w-4" />
                Сгенерировать с AI
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Card className="border-0 bg-[var(--input-background)] shadow-none">
            <CardHeader>
              <CardTitle className="leading-tight" style={{ fontSize: "30px" }}>
                Разделы и уроки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CourseCurriculumEditor
                courseId={courseId}
                modules={modules}
                lessons={lessons}
                onReload={() => loadCourse({ silent: true })}
                onDeleteLesson={(id) => void deleteLesson(id)}
                onAddLessonOptimistic={(lesson) => setLessons((prev) => [...prev, lesson])}
                onAddLessonSettled={(tempId, lesson) => {
                  setLessons((prev) => {
                    if (lesson === null) return prev.filter((l) => l.id !== tempId)
                    return prev.map((l) => (l.id === tempId ? lesson : l))
                  })
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
