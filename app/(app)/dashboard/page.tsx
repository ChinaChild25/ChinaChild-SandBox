"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  FIGMA_CALENDAR,
  FIGMA_CONTINUE_LESSON,
  FIGMA_TEACHERS,
  FIGMA_UPCOMING_LESSONS
} from "@/lib/figma-dashboard"

const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const

export default function DashboardPage() {
  const { user } = useAuth()
  const dashboardStats = user?.dashboardStats ?? {
    attendedLessons: 9,
    lessonGoal: 48,
    completedHomework: 8,
    homeworkGoal: 48,
    averageScore: 93
  }

  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    return {
      day,
      hasEvent: (FIGMA_CALENDAR.eventDays as readonly number[]).includes(day),
      isToday: day === FIGMA_CALENDAR.today
    }
  })

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-ds-gutter">
        {/* Статистика — как chinachild.figma.site: без иконок, со стрелками в подписи */}
        <div className="ds-stat-grid">
          <Link
            href="/classes"
            className="ds-stat-card ds-stat-card--muted ds-stat-card--interactive group block rounded-[var(--ds-radius-xl)]"
          >
            <p className="ds-stat-card__value text-ds-ink">
              {dashboardStats.attendedLessons}
              <span className="pl-1 text-ds-5xl text-ds-text-secondary">
                /{dashboardStats.lessonGoal}
              </span>
            </p>
            <p className="ds-stat-card__label text-ds-text-muted">Посещено занятий</p>
            <span className="ds-stat-card__cta text-ds-sage-strong">
              Смотреть все →
            </span>
          </Link>

          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--dark ds-stat-card--interactive group block rounded-[var(--ds-radius-xl)]"
          >
            <p className="ds-stat-card__value">
              {dashboardStats.completedHomework}
              <span className="pl-1 text-ds-5xl text-white/80">/{dashboardStats.homeworkGoal}</span>
            </p>
            <p className="ds-stat-card__label text-white/75">Выполнено домашних заданий</p>
            <span className="ds-stat-card__cta text-white/90">История оценок →</span>
          </Link>

          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--sage ds-stat-card--interactive group block rounded-[var(--ds-radius-xl)]"
          >
            <p className="ds-stat-card__value text-ds-ink">
              {dashboardStats.averageScore}
              <span className="pl-1 text-ds-5xl text-ds-text-secondary">/100</span>
            </p>
            <p className="ds-stat-card__label text-ds-text-muted">Средний балл теста</p>
            <span className="ds-stat-card__cta text-ds-sage-hover">Подробнее →</span>
          </Link>
        </div>

        <div className="ds-dashboard-grid">
          <div className="flex flex-col gap-ds-gutter">
            <section className="ek-surface bg-ds-panel-muted px-5 py-5 sm:px-6">
              <h2 className="mb-4 text-[20px] font-normal leading-none text-ds-ink">
                Предстоящие занятия
              </h2>
              <ul className="flex flex-col gap-0">
                {FIGMA_UPCOMING_LESSONS.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={lesson.href}
                      className="group mb-4 flex items-center gap-4 no-underline last:mb-0"
                    >
                      <div
                        className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-full text-center"
                        style={{ backgroundColor: lesson.bgColor, color: lesson.textColor }}
                      >
                        <span className="mb-1 text-[26px] font-normal leading-none">{lesson.date}</span>
                        <span className="text-[11px] leading-tight">{lesson.time}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[20px] font-normal leading-none text-ds-ink">{lesson.title}</p>
                        <p className="flex items-center gap-2 text-[13px] text-ds-text-secondary">
                          <span className="truncate">{lesson.description}</span>
                          {"hasIndicator" in lesson && lesson.hasIndicator ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-ink" aria-hidden />
                          ) : null}
                        </p>
                      </div>
                      <ChevronRight
                        size={26}
                        className="shrink-0 text-ds-chevron opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-center">
                <Link href="/schedule" className="ds-link-sage inline-block text-[15px]">
                  смотреть все в расписании →
                </Link>
              </div>
            </section>

            <section className="ek-surface rounded-[var(--ds-radius-lg)] bg-ds-surface-muted px-6 py-6">
              <p className="mb-3 text-[17px] font-semibold text-ds-ink">Продолжить обучение</p>
              <p className="text-[20px] font-normal leading-snug text-ds-ink">{FIGMA_CONTINUE_LESSON.title}</p>
              <p className="mt-2 text-[14px] text-ds-text-secondary">{FIGMA_CONTINUE_LESSON.subtitle}</p>
              <Link
                href={FIGMA_CONTINUE_LESSON.href}
                className="mt-5 inline-block text-[15px] font-medium text-ds-sage-strong transition-colors hover:text-ds-sage-hover"
              >
                Продолжить →
              </Link>
            </section>
          </div>

          <div className="grid gap-ds-gutter">
            <section className="ek-surface bg-ds-panel-muted px-6 py-5">
              <div className="mb-3">
                <Link
                  href="/schedule"
                  className="group mb-1 block text-left no-underline outline-offset-2 focus-visible:rounded-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25"
                >
                  <span className="ds-calendar-title-bold capitalize transition-opacity group-hover:opacity-90">
                    {FIGMA_CALENDAR.monthTitle}{" "}
                  </span>
                  <span className="ds-calendar-title-reg">{FIGMA_CALENDAR.year}</span>
                </Link>
              </div>

              <div className="ds-calendar-grid-figma">
                {weekdays.map((day) => (
                  <div key={day} className="pb-1 text-center text-[12px] text-ds-text-tertiary lowercase">
                    {day}
                  </div>
                ))}
                {Array.from({ length: FIGMA_CALENDAR.startOffset }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calendarDays.map((item) => (
                  <Link
                    key={item.day}
                    href="/schedule"
                    className={`ds-calendar-day-cell no-underline outline-offset-1 focus-visible:ring-2 focus-visible:ring-ds-ink/20 ${
                      item.isToday ? "ds-calendar-day-cell--today" : ""
                    }`}
                  >
                    <div className="text-[14px] text-ds-ink">{item.day}</div>
                    <div className="ds-calendar-event-dot">{item.hasEvent ? <span /> : null}</div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="ek-surface bg-ds-panel-muted px-5 py-4 sm:px-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                Мои преподаватели
              </p>
              <ul className="flex flex-col gap-2">
                {FIGMA_TEACHERS.map((t) => (
                  <li key={t.slug}>
                    <div className="ds-contact-card">
                      <Link href={`/mentors/${t.slug}`} className="ds-contact-row min-w-0 flex-1 py-1 no-underline">
                        <div className="ds-contact-avatar relative">
                          <Image
                            src={t.photo}
                            alt={t.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="ds-contact-name">{t.name}</p>
                          <p className="ds-contact-role">{t.role}</p>
                        </div>
                        <ChevronRight className="h-6 w-6 shrink-0 text-ds-ink" aria-hidden />
                      </Link>
                      <Link
                        href={`/messages?mentor=${t.slug}`}
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
