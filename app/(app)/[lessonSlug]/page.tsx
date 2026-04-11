import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PendingLesson } from "@/components/school/pending-lesson"
import { InteractiveLesson } from "@/components/school/interactive-lesson"
import { courseIdFromLessonSlug } from "@/lib/courses/course-id-from-slug"
import { loadCourseLessonJson } from "@/lib/courses/load-lesson"
import { lessonBySlug, lessonSlugs } from "@/lib/course-catalog"
import { SchoolLessonShell } from "@/layouts/school-lesson-shell"

type LessonPageProps = {
  params: Promise<{ lessonSlug: string }>
}

export function generateStaticParams() {
  return lessonSlugs.map((lessonSlug) => ({ lessonSlug }))
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonSlug } = await params
  const catalog = lessonBySlug[lessonSlug]
  if (!catalog) notFound()

  const courseId = courseIdFromLessonSlug(lessonSlug)
  if (!courseId) notFound()

  const file = await loadCourseLessonJson(courseId, lessonSlug)
  if (!file) notFound()

  const ready = file.contentStatus === "ready" && file.data !== null

  return (
    <SchoolLessonShell>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/courses/${catalog.courseId}`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--cc-hsk-text)] shadow-sm ring-1 ring-[var(--cc-hsk-line)] transition-colors hover:bg-[#f3f4f6]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Назад к курсу {catalog.courseName}
        </Link>
        <span className="text-sm text-[var(--cc-hsk-muted)]">
          {catalog.courseName} · {ready ? "интерактивный урок" : "каркас маршрута"}
        </span>
      </div>

      {ready ? (
        <InteractiveLesson data={file.data} heroMedia={file.heroMedia} />
      ) : (
        <PendingLesson title={catalog.title} file={file} />
      )}
    </SchoolLessonShell>
  )
}
