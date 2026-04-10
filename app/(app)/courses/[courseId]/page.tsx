"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, FileText, GraduationCap } from "lucide-react"
import { courseCatalog } from "@/lib/course-catalog"

export default function CourseDetailsPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId
  const course = courseCatalog.find((item) => item.id === courseId)

  if (!course) {
    return (
      <div className="px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-[76.5rem]">
          <section className="ek-surface bg-[#ebebeb] px-7 py-6">
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#171a23]">
              Курс не найден
            </h1>
            <Link
              href="/courses"
              className="mt-4 inline-flex rounded-full bg-[#12151d] px-4 py-2 text-sm text-white"
            >
              Вернуться к курсам
            </Link>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[76.5rem] flex-col gap-4">
        <section className="ek-surface bg-[#ebebeb] px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Учебный план</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-[#171a23]">
            {course.name}
          </h1>
          <p className="mt-2 max-w-3xl text-[1.06rem] leading-[1.35] text-black/58">
            {course.description}
          </p>
        </section>

        <section className="ek-surface bg-[#ebebeb] px-6 py-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[2rem] leading-none font-semibold tracking-[-0.04em] text-[#171a23]">
              {course.name}: список уроков
            </h2>
            <span className="rounded-full bg-white px-3 py-1.5 text-sm text-black/55">
              {course.lessons.length} уроков
            </span>
          </div>

          <ul className="space-y-2">
            {course.lessons.map((lesson) => (
              <li key={lesson.slug}>
                <Link
                  href={`/${lesson.slug}`}
                  className="group flex items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 transition-colors hover:bg-black/[0.03]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-[#d8ea95] text-[#171a23]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.02rem] font-medium text-[#171a23]">{lesson.title}</p>
                    <p className="mt-0.5 text-xs text-black/50">Маршрут: /{lesson.slug}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-black/45 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#12151d] px-4 py-3 text-sm font-medium text-white hover:bg-[#20242f]"
            >
              <GraduationCap className="h-4 w-4" />
              Начать курс {course.name}
            </button>
            <Link
              href="/courses"
              className="rounded-2xl border border-black/12 bg-white px-4 py-3 text-center text-sm font-medium text-[#171a23] hover:bg-black/[0.03]"
            >
              Вернуться ко всем курсам
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
