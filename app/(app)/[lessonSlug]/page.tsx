import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

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

  const coursePillBg = catalog.courseId === "hsk1" ? "var(--ds-sage)" : "var(--ds-pink)"

  return (
    <SchoolLessonShell>
      <div className="mb-6">
        <Link
          href={`/courses/${catalog.courseId}`}
          className="mb-5 inline-flex min-h-[44px] items-center gap-1 text-[14px] text-ds-text-tertiary transition-colors hover:text-ds-ink"
        >
          <ChevronLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Назад к курсу {catalog.courseName}
        </Link>

        <div
          className="mb-6 inline-block rounded-[var(--ds-radius-md)] px-3 py-1 text-[12px] text-ds-ink"
          style={{ backgroundColor: coursePillBg }}
        >
          {catalog.courseName}
        </div>
      </div>

      {ready ? (
        <InteractiveLesson data={file.data} heroMedia={file.heroMedia} />
      ) : (
        <PendingLesson title={catalog.title} file={file} />
      )}
    </SchoolLessonShell>
  )
}
