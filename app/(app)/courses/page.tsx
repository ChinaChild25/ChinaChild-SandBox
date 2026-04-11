"use client"

import Link from "next/link"
import { BookOpen, CheckCircle, ChevronRight } from "lucide-react"
import { courseCatalog } from "@/lib/course-catalog"

const courseVisual: Record<
  "hsk1" | "hsk2",
  { levelLine: string; titleLine: string; words: string; completed: number; progress: number; accentVar: string }
> = {
  hsk1: {
    levelLine: "HSK 1",
    titleLine: "Базовый курс",
    words: "150 слов",
    completed: 7,
    progress: 37,
    accentVar: "--ds-sage-strong"
  },
  hsk2: {
    levelLine: "HSK 2",
    titleLine: "Элементарный курс",
    words: "300 слов",
    completed: 0,
    progress: 0,
    accentVar: "--ds-pink-strong"
  }
}

const recentActivity = [
  {
    topic: "Тема №7 — Члены семьи",
    course: "HSK1",
    score: 92,
    date: "9 апр",
    slug: "hsk1-tema7"
  },
  {
    topic: "Тема №6 — Телефонные номера",
    course: "HSK1",
    score: 88,
    date: "7 апр",
    slug: "hsk1-tema6"
  },
  {
    topic: "Тема №5 — Возраст",
    course: "HSK1",
    score: 95,
    date: "5 апр",
    slug: "hsk1-tema5"
  }
] as const

export default function CoursesPage() {
  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-8">
          <h1 className="text-[length:var(--ds-text-8xl)] font-bold leading-none text-ds-text-primary">
            Мои курсы
          </h1>
          <p className="mt-1 text-ds-body text-ds-text-secondary">Выберите курс для продолжения обучения</p>
        </header>

        <div className="ds-course-grid">
          {courseCatalog.map((item) => {
            const ui = courseVisual[item.id]
            const bg = item.id === "hsk1" ? "var(--ds-sage)" : "var(--ds-pink)"
            const totalTopics = item.lessons.length

            return (
              <Link
                key={item.id}
                href={`/courses/${item.id}`}
                className="ds-course-card block text-inherit no-underline outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgb(26_26_26/0.2)]"
                style={{ backgroundColor: bg }}
              >
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-[length:var(--ds-text-6xl)] font-bold leading-none text-ds-ink">
                      {ui.levelLine}
                    </p>
                    <p className="text-[length:var(--ds-text-body-lg)] text-ds-text-quaternary">{ui.titleLine}</p>
                  </div>
                  <div className="ds-course-card__icon-wrap">
                    <BookOpen className="h-[22px] w-[22px] text-ds-ink" aria-hidden />
                  </div>
                </div>

                <p className="mb-5 text-ds-body-sm leading-snug text-ds-text-quaternary">{item.description}</p>

                <div className="mb-5 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">
                      {ui.completed}
                    </p>
                    <p className="text-ds-sm text-ds-text-secondary">пройдено</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">
                      {totalTopics}
                    </p>
                    <p className="text-ds-sm text-ds-text-secondary">тем всего</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[length:var(--ds-text-2xl)] font-bold leading-none text-ds-ink">{ui.words}</p>
                    <p className="text-ds-sm text-ds-text-secondary">словарный запас</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between">
                    <span className="text-[13px] text-[#555555] dark:text-ds-text-tertiary">Прогресс</span>
                    <span className="text-[13px] font-semibold text-ds-ink">{ui.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ui.progress}%`,
                        backgroundColor: `var(${ui.accentVar})`
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 text-ds-body text-ds-ink">
                  <span>Перейти к курсу</span>
                  <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
                </div>
              </Link>
            )
          })}
        </div>

        <section className="mt-2">
          <h2 className="mb-4 text-[20px] font-semibold text-ds-ink">Последняя активность</h2>
          <div className="flex flex-col gap-3">
            {recentActivity.map((row) => (
              <Link
                key={row.slug}
                href={`/${row.slug}`}
                className="flex items-center gap-4 rounded-2xl bg-[#f8f8f8] p-4 no-underline transition-colors hover:bg-[#f0f0f0] dark:bg-ds-surface-muted dark:hover:bg-ds-surface-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-sage">
                  <CheckCircle className="h-[18px] w-[18px] text-ds-sage-strong" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-ds-ink">{row.topic}</p>
                  <p className="text-[13px] text-ds-text-tertiary">
                    {row.course} · {row.date}
                  </p>
                </div>
                <p className="text-[18px] font-bold text-ds-sage-strong">{row.score}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
