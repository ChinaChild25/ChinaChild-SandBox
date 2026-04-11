"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, Star } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { mockLessons } from "@/lib/mock-data"
import { mentorSlugs, mentorsBySlug } from "@/lib/mentors"

const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const

/** Визуальный ряд как в Figmadasboard Dashboard.tsx (круг, контраст текста, точка активности). */
const lessonVisual: Array<{ bg: string; text: string; activityDot: boolean }> = [
  { bg: "#1a1a1a", text: "#ffffff", activityDot: false },
  { bg: "#e5e5e5", text: "#1a1a1a", activityDot: true },
  { bg: "#f4c4c4", text: "#1a1a1a", activityDot: false },
  { bg: "#e5e5e5", text: "#1a1a1a", activityDot: false },
  { bg: "#d4e7b0", text: "#1a1a1a", activityDot: false }
]

export default function DashboardPage() {
  const { user } = useAuth()
  const dashboardStats = user?.dashboardStats ?? {
    attendedLessons: 9,
    lessonGoal: 48,
    completedHomework: 8,
    homeworkGoal: 48,
    averageScore: 93
  }
  const upcomingLessons = mockLessons.slice(0, 5)

  const calendarModel = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const first = new Date(y, m, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const eventDays = new Set<number>()
    for (const l of mockLessons) {
      const d = new Date(l.scheduledDate)
      if (d.getFullYear() === y && d.getMonth() === m) {
        eventDays.add(d.getDate())
      }
    }
    const monthTitle = now.toLocaleString("ru-RU", { month: "long" })
    const isToday = (day: number) =>
      day === now.getDate() && m === now.getMonth() && y === now.getFullYear()

    const cells: Array<number | "pad"> = []
    for (let i = 0; i < startPad; i++) cells.push("pad")
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return { monthTitle, year: y, eventDays, isToday, cells }
  }, [])

  const mentors = mentorSlugs.map((slug) => mentorsBySlug[slug])

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-ds-gutter">
        <div className="ds-stat-grid">
          <Link
            href="/schedule"
            className="ds-stat-card ds-stat-card--muted ds-stat-card--interactive group block rounded-[var(--ds-radius-xl)]"
          >
            <div className="ds-stat-card__top">
              <div className="ds-stat-card__icon-badge" aria-hidden>
                <BookOpen className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            <p className="ds-stat-card__value text-ds-ink">
              {dashboardStats.attendedLessons}
              <span className="pl-1 text-ds-5xl text-ds-text-secondary">
                /{dashboardStats.lessonGoal}
              </span>
            </p>
            <p className="ds-stat-card__label text-ds-text-muted">Посещено занятий</p>
            <span className="ds-stat-card__cta">
              Подробнее
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--dark ds-stat-card--interactive group block rounded-[var(--ds-radius-xl)]"
          >
            <div className="ds-stat-card__top">
              <div className="ds-stat-card__icon-badge" aria-hidden>
                <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            <p className="ds-stat-card__value">
              {dashboardStats.completedHomework}
              <span className="pl-1 text-ds-5xl text-white/80">/{dashboardStats.homeworkGoal}</span>
            </p>
            <p className="ds-stat-card__label text-white/75">Выполнено домашних заданий</p>
            <span className="ds-stat-card__cta">
              Подробнее
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--sage ds-stat-card--interactive group block rounded-[var(--ds-radius-xl)]"
          >
            <div className="ds-stat-card__top">
              <div className="ds-stat-card__icon-badge" aria-hidden>
                <Star className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            <p className="ds-stat-card__value text-ds-ink">
              {dashboardStats.averageScore}
              <span className="pl-1 text-ds-5xl text-ds-text-secondary">/100</span>
            </p>
            <p className="ds-stat-card__label text-ds-text-muted">
              Средний балл
              <br />
              по тестам
            </p>
            <span className="ds-stat-card__cta">
              Подробнее
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </div>

        <div className="ds-dashboard-grid">
          <section className="ek-surface bg-ds-panel-muted px-5 py-5 sm:px-6">
            <ul className="flex flex-col gap-4 pt-0">
              {upcomingLessons.map((lesson, index) => {
                const dayNumber = new Date(lesson.scheduledDate).getDate()
                const vis = lessonVisual[index] ?? lessonVisual[1]
                const href = lesson.slug ? `/${lesson.slug}` : "/schedule"

                return (
                  <li key={lesson.id}>
                    <Link
                      href={href}
                      className="ds-lesson-row !mb-0 py-0 no-underline outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25"
                    >
                      <div
                        className="ds-lesson-dot text-center"
                        style={{ backgroundColor: vis.bg, color: vis.text }}
                      >
                        <span className="ds-lesson-dot__day">{dayNumber}</span>
                        <span className="ds-lesson-dot__time">{lesson.duration}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="ds-lesson-row__title">{lesson.title}</p>
                        <p className="ds-lesson-row__meta">
                          <span className="truncate">{lesson.titleChinese}</span>
                          {vis.activityDot ? (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-ink"
                              aria-hidden
                            />
                          ) : null}
                        </p>
                      </div>
                      <ChevronRight className="ds-lesson-row__chevron h-[26px] w-[26px]" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-6 text-center">
              <Link href="/schedule" className="ds-link-sage inline-block">
                смотреть далее
              </Link>
            </div>
          </section>

          <div className="grid gap-ds-gutter">
            <section className="ek-surface bg-ds-panel-muted px-6 py-5">
              <div className="mb-3">
                <Link
                  href="/schedule"
                  className="group mb-1 block text-left no-underline outline-offset-2 focus-visible:rounded-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25"
                >
                  <span className="ds-calendar-title-bold capitalize transition-opacity group-hover:opacity-90">
                    {calendarModel.monthTitle}{" "}
                  </span>
                  <span className="ds-calendar-title-reg">{calendarModel.year}</span>
                </Link>
                <p className="text-[12px] text-ds-text-tertiary">Занятия с отметками в календаре</p>
              </div>

              <div className="ds-calendar-grid-figma">
                {weekdays.map((day) => (
                  <div key={day} className="pb-1 text-center text-[12px] text-ds-text-tertiary lowercase">
                    {day}
                  </div>
                ))}
                {calendarModel.cells.map((cell, index) => {
                  if (cell === "pad") {
                    return <div key={`pad-${index}`} />
                  }
                  const hasEvent = calendarModel.eventDays.has(cell)
                  const today = calendarModel.isToday(cell)
                  return (
                    <Link
                      key={cell}
                      href="/schedule"
                      className={`ds-calendar-day-cell no-underline outline-offset-1 focus-visible:ring-2 focus-visible:ring-ds-ink/20 ${
                        today ? "ds-calendar-day-cell--today" : ""
                      }`}
                    >
                      <div className="text-[14px] text-ds-ink">{cell}</div>
                      <div className="ds-calendar-event-dot">
                        {hasEvent ? <span /> : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <section className="ek-surface bg-ds-panel-muted px-5 py-4 sm:px-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                Контакты
              </p>
              <ul className="flex flex-col gap-2">
                {mentors.map((mentor) => (
                  <li key={mentor.slug}>
                    <div className="ds-contact-card">
                      <Link
                        href={`/mentors/${mentor.slug}`}
                        className="ds-contact-row min-w-0 flex-1 py-1 no-underline"
                      >
                        <div className="ds-contact-avatar relative">
                          <Image
                            src={mentor.photo}
                            alt={mentor.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="ds-contact-name">{mentor.name}</p>
                          <p className="ds-contact-role">{mentor.role}</p>
                        </div>
                        <ChevronRight className="h-6 w-6 shrink-0 text-ds-ink" aria-hidden />
                      </Link>
                      <Link
                        href={`/messages?mentor=${mentor.slug}`}
                        className="shrink-0 rounded-full bg-ds-ink px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#333333]"
                      >
                        Написать
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
