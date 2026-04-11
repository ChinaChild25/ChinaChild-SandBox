"use client"

import Link from "next/link"
import { ChevronRight, GraduationCap } from "lucide-react"
import { courseCatalog } from "@/lib/course-catalog"

export default function CoursesPage() {
  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-6">
        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Учебный план</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-ds-ink">
            Мои курсы
          </h1>
          <p className="mt-2 max-w-3xl text-[1.06rem] leading-[1.35] text-black/58">
            Полная структура HSK1 и HSK2 с фиксированным порядком тем, вариантами и тестовыми блоками.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {courseCatalog.map((item) => (
            <Link
              key={item.id}
              href={`/courses/${item.id}`}
              className="ek-surface group flex flex-col bg-ds-panel-muted p-6 no-underline outline-offset-2 transition-transform hover:scale-[1.01] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ds-sage px-3 py-1 text-xs font-medium text-ds-ink">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                    {item.name}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ds-ink">{item.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-black/55">{item.description}</p>
                  <p className="mt-4 text-sm font-medium text-ds-sage-strong">
                    {item.lessons.length} уроков — открыть программу
                  </p>
                </div>
                <ChevronRight
                  className="mt-1 h-8 w-8 shrink-0 text-ds-chevron transition-transform group-hover:translate-x-0.5 group-hover:text-ds-ink"
                  aria-hidden
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
