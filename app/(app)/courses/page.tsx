"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, FileText, GraduationCap } from "lucide-react"
import { courseCatalog } from "@/lib/course-catalog"

export default function CoursesPage() {
  const [activeCourse, setActiveCourse] = useState<"hsk1" | "hsk2">("hsk1")
  const course = useMemo(
    () => courseCatalog.find((item) => item.id === activeCourse) ?? courseCatalog[0],
    [activeCourse]
  )

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4">
        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Учебный план</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-ds-ink">
            Мои курсы
          </h1>
          <p className="mt-2 max-w-3xl text-[1.06rem] leading-[1.35] text-black/58">
            Полная структура HSK1 и HSK2 с фиксированным порядком тем, вариантами и тестовыми блоками.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
          <section className="ek-surface bg-ds-panel-muted p-4">
            <div className="space-y-3">
              {courseCatalog.map((item) => {
                const isActive = item.id === activeCourse
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveCourse(item.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      isActive
                        ? "border-ds-ink bg-ds-ink text-white"
                        : "border-black/8 bg-white text-ds-ink hover:bg-black/[0.03]"
                    }`}
                  >
                    <p className="text-xl leading-none font-semibold tracking-[-0.03em]">{item.name}</p>
                    <p className={`mt-2 text-sm leading-[1.3] ${isActive ? "text-white/75" : "text-black/55"}`}>
                      {item.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="ek-surface bg-ds-panel-muted px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[2rem] leading-none font-semibold tracking-[-0.04em] text-ds-ink">
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
                    <div className="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-ds-sage text-ds-ink">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[1.02rem] font-medium text-ds-ink">{lesson.title}</p>
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
                className="flex items-center justify-center gap-2 rounded-2xl bg-ds-ink px-4 py-3 text-sm font-medium text-white hover:opacity-90"
              >
                <GraduationCap className="h-4 w-4" />
                Начать выбранный курс
              </button>
              <button
                type="button"
                className="rounded-2xl border border-black/12 bg-white px-4 py-3 text-sm font-medium text-ds-ink hover:bg-black/[0.03]"
              >
                Скачать программу в PDF
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
