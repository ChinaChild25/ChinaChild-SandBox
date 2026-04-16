"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Plus, Sparkles } from "lucide-react"
import type { TeacherCustomCourse, TeacherLesson } from "@/lib/types"
import { CourseDetailContent } from "@/components/courses/course-detail-content"
import { CourseLessonTabs } from "@/components/courses/course-lesson-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export function TeacherCourseBuilderContent({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<TeacherCustomCourse | null>(null)
  const [lessons, setLessons] = useState<TeacherLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const orderedLessons = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), [lessons])

  useEffect(() => {
    if (courseId === "hsk1" || courseId === "hsk2") return
    void loadCourse()
  }, [courseId])

  async function loadCourse() {
    setLoading(true)
    setError(null)
    const [courseRes, lessonsRes] = await Promise.all([
      fetch(`/api/teacher/courses/${courseId}`, { cache: "no-store" }),
      fetch(`/api/teacher/courses/${courseId}/lessons`, { cache: "no-store" })
    ])
    const courseJson = (await courseRes.json().catch(() => null)) as { course?: TeacherCustomCourse; error?: string } | null
    const lessonsJson = (await lessonsRes.json().catch(() => null)) as { lessons?: TeacherLesson[]; error?: string } | null

    if (!courseRes.ok || !courseJson?.course) {
      setError(courseJson?.error ?? "Курс не найден")
      setLoading(false)
      return
    }
    if (!lessonsRes.ok) {
      setError(lessonsJson?.error ?? "Не удалось загрузить уроки")
      setLoading(false)
      return
    }
    const nextLessons = lessonsJson?.lessons ?? []
    setCourse(courseJson.course)
    setLessons(nextLessons)
    setLoading(false)
  }

  async function createLesson() {
    const res = await fetch(`/api/teacher/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Урок ${lessons.length + 1}` })
    })
    const json = (await res.json().catch(() => null)) as { lesson?: TeacherLesson; error?: string } | null
    if (!res.ok || !json?.lesson) {
      setError(json?.error ?? "Не удалось создать урок")
      return
    }
    const nextLessons = [...lessons, json.lesson].sort((a, b) => a.order - b.order)
    setLessons(nextLessons)
    window.location.href = `/teacher/lessons/${json.lesson.id}`
  }

  async function deleteLesson(lessonId: string) {
    const confirmDelete = window.confirm("Удалить урок?")
    if (!confirmDelete) return
    const res = await fetch(`/api/teacher/lessons/${lessonId}`, { method: "DELETE" })
    if (!res.ok) return
    setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId))
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

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] space-y-6">
        <Link href="/teacher/courses" className="inline-flex items-center gap-1 text-sm text-ds-text-tertiary hover:text-ds-ink">
          <ChevronLeft className="h-4 w-4" />
          Назад к курсам
        </Link>

        <header className="rounded-[var(--ds-radius-xl)] bg-ds-surface-muted p-6">
          <h1 className="text-[32px] font-semibold text-ds-ink">{course.title}</h1>
          <p className="mt-1 text-base text-ds-text-secondary">{course.description || "Описание не добавлено"}</p>
        </header>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {lessons.length === 0 ? (
          <Empty className="border-border bg-ds-surface-muted">
            <EmptyHeader>
              <EmptyTitle>У вас пока нет уроков</EmptyTitle>
              <EmptyDescription>Начните с добавления первого урока</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              <Button onClick={createLesson}>
                <Plus className="mr-1 h-4 w-4" />
                Создать урок
              </Button>
              <Button variant="outline" disabled>
                <Sparkles className="mr-1 h-4 w-4" />
                Сгенерировать с AI
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Card className="border-0 bg-ds-surface-muted">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-[26px]">Уроки курса</CardTitle>
              <Button onClick={createLesson}>
                <Plus className="mr-1 h-4 w-4" />
                Создать урок
              </Button>
            </CardHeader>
            <CardContent>
              <CourseLessonTabs
                lessons={orderedLessons}
                activeLessonId={null}
                onRequestDelete={(id) => void deleteLesson(id)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
