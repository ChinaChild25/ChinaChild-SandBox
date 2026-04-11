"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronRight, ClipboardList, Star, TrendingUp } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  FIGMA_CALENDAR,
  FIGMA_DASHBOARD_LESSONS,
  FIGMA_TEACHERS
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
    <div className="ds-figma-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col">
        {/* Три карточки статистики — иконки + ссылки как в макете */}
        <div className="ds-stat-grid">
          <Link
            href="/classes"
            className="ds-stat-card ds-stat-card--muted ds-stat-card--interactive block rounded-[28px] no-underline"
          >
            <div className="ds-stat-card__top">
              <span className="ds-stat-card__icon-badge rounded-2xl">
                <TrendingUp size={22} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div className="ds-stat-card__value text-ds-ink">
              {dashboardStats.attendedLessons}
              <span className="text-[#888] dark:text-neutral-500">/{dashboardStats.lessonGoal}</span>
            </div>
            <div className="ds-stat-card__label text-[#555] dark:text-[var(--ds-text-secondary)]">
              Посещено занятий
            </div>
            <span className="ds-dashboard-stat-link">
              Смотреть все
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--dark ds-stat-card--interactive block rounded-[28px] no-underline text-white"
          >
            <div className="ds-stat-card__top">
              <span className="ds-stat-card__icon-badge rounded-2xl">
                <ClipboardList size={22} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div className="ds-stat-card__value">
              {dashboardStats.completedHomework}
              <span className="text-[#777]">/{dashboardStats.homeworkGoal}</span>
            </div>
            <div className="ds-stat-card__label text-[#aaa]">Выполнено домашних</div>
            <span className="ds-dashboard-stat-link">
              История оценок
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--sage ds-stat-card--interactive block rounded-[28px] no-underline"
          >
            <div className="ds-stat-card__top">
              <span className="ds-stat-card__icon-badge rounded-2xl">
                <Star size={22} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div className="ds-stat-card__value text-ds-ink">
              {dashboardStats.averageScore}
              <span className="text-[#666] dark:text-neutral-600">/100</span>
            </div>
            <div className="ds-stat-card__label text-[#555] dark:text-[var(--ds-text-secondary)]">
              Средний балл теста
            </div>
            <span className="ds-dashboard-stat-link">
              Подробнее
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>

        <div className="ds-dashboard-grid">
          <div>
            <h2 className="mb-4 text-[20px] font-semibold leading-none text-ds-ink">Предстоящие занятия</h2>
            <ul className="list-none p-0">
              {FIGMA_DASHBOARD_LESSONS.map((lesson) => (
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
                      <p className="flex items-center gap-2 text-[13px] text-[#666] dark:text-[var(--ds-text-secondary)]">
                        <span className="truncate">{lesson.description}</span>
                        {"hasIndicator" in lesson && lesson.hasIndicator ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-ink" aria-hidden />
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight
                      size={26}
                      className="shrink-0 text-[#ccc] opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-center">
              <Link href="/classes" className="ds-dashboard-stat-link inline-flex justify-center">
                Смотреть все
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-6">
              <div className="mb-3">
                <span className="ds-calendar-title-bold capitalize text-ds-ink">
                  {FIGMA_CALENDAR.monthTitle}{" "}
                </span>
                <span className="ds-calendar-title-reg text-ds-ink">{FIGMA_CALENDAR.year}</span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weekdays.map((d) => (
                  <div key={d} className="pb-1 text-center text-[12px] text-[#888] dark:text-ds-text-tertiary">
                    {d}
                  </div>
                ))}
                {Array.from({ length: FIGMA_CALENDAR.startOffset }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calendarDays.map((item) => (
                  <Link
                    key={item.day}
                    href="/schedule"
                    className={`rounded-lg py-1.5 text-center no-underline outline-offset-1 focus-visible:ring-2 focus-visible:ring-ds-ink/20 ${
                      item.isToday ? "bg-ds-sage" : "hover:bg-ds-surface-hover"
                    }`}
                  >
                    <div className="text-[14px] text-ds-ink">{item.day}</div>
                    {item.hasEvent || item.isToday ? (
                      <div className="mt-0.5 flex justify-center">
                        <span className="h-1 w-1 rounded-full bg-[#8ab84a]" />
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-[17px] font-semibold leading-none text-ds-ink">Мои преподаватели</h3>
              <ul className="flex flex-col gap-3 p-0 list-none">
                {FIGMA_TEACHERS.map((t) => (
                  <li key={t.slug}>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/mentors/${t.slug}`}
                        className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
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
                          <div className="mb-0.5 text-[18px] font-semibold leading-none text-ds-ink">{t.name}</div>
                          <div className="text-[13px] text-[#666] dark:text-[var(--ds-text-secondary)]">{t.role}</div>
                        </div>
                      </Link>
                      <Link
                        href={`/messages?mentor=${t.slug}`}
                        className="flex shrink-0 items-center gap-1 rounded-full border border-[#e8e8e8] bg-white px-3 py-2 text-[13px] font-medium text-ds-ink no-underline transition-colors hover:bg-[#f5f5f5] dark:border-white/15 dark:bg-ds-surface dark:hover:bg-white/5"
                      >
                        Написать
                        <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
