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
  const courseLevelLabel =
    catalog.courseId === "hsk1" ? "HSK 1" : catalog.courseId === "hsk2" ? "HSK 2" : catalog.courseName

  return (
    <SchoolLessonShell>
      <div className="mb-8 flex flex-col gap-4 border-b border-black/[0.06] pb-6 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center rounded-[var(--ds-radius-md)] px-3 py-1.5 text-[12px] font-semibold tracking-wide text-ds-ink"
            style={{ backgroundColor: coursePillBg }}
          >
            {courseLevelLabel}
          </span>
        </div>
        <Link
          href={`/courses/${catalog.courseId}`}
          className="inline-flex min-h-[44px] w-fit max-w-full items-center gap-1.5 text-[14px] text-ds-text-tertiary transition-colors hover:text-ds-ink"
        >
          <ChevronLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="leading-snug">
            Назад к курсу <span className="font-medium text-ds-ink">{courseLevelLabel}</span>
          </span>
        </Link>
      </div>

      {ready ? (
        <InteractiveLesson data={file.data} heroMedia={file.heroMedia} />
      ) : (
        <PendingLesson title={catalog.title} file={file} />
      )}
    </SchoolLessonShell>
  )
}
