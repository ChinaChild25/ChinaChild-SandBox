"use client"

import Link from "next/link"
import { ArrowRight, ChevronRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { mockLessons } from "@/lib/mock-data"

const lessonDots: Record<number, string[]> = {
  1: ["bg-black/40", "bg-black/20"],
  4: ["bg-black/20"],
  5: ["bg-[#d8e998]"],
  11: ["bg-black/70"],
  12: ["bg-[#f2aba3]"],
  13: ["bg-[#d9eb97]"],
  15: ["bg-[#d9eb97]", "bg-black/80"],
  17: ["bg-[#d9eb97]", "bg-black/80"],
  19: ["bg-[#f2aba3]"],
  20: ["bg-[#d9eb97]"],
  22: ["bg-[#d9eb97]", "bg-black/80"],
  24: ["bg-[#d9eb97]", "bg-black/80"],
  25: ["bg-black/80"],
  26: ["bg-[#f2aba3]"],
  27: ["bg-[#d9eb97]"],
  29: ["bg-[#d9eb97]", "bg-black/80"],
  30: ["bg-black/80"]
}

const monthRows: Array<Array<number | null>> = [
  [null, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, null, null, null, null]
]

const mentors = [
  {
    name: "Ео Ми-ран",
    role: "куратор группы",
    initials: "ЕМ",
    slug: "eo-mi-ran" as const
  },
  {
    name: "Ким Джи-хун",
    role: "преподаватель",
    initials: "КД",
    slug: "kim-ji-hun" as const
  }
]

const lessonColors = ["#10131d", "#d8d8d8", "#f1a9a2", "#d8d8d8", "#d8e998"]

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

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-ds-gutter">
        <div className="ds-stat-grid">
          <Link
            href="/schedule"
            className="ds-stat-card ds-stat-card--muted block cursor-pointer rounded-[var(--ds-radius-xl)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/25 focus-visible:ring-offset-2"
          >
            <p className="ds-stat-card__value text-ds-ink">
              {dashboardStats.attendedLessons}
              <span className="pl-1 text-ds-5xl text-ds-text-secondary">
                /{dashboardStats.lessonGoal}
              </span>
            </p>
            <p className="ds-stat-card__label text-ds-text-muted">Посещено занятий</p>
          </Link>
          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--dark block cursor-pointer rounded-[var(--ds-radius-xl)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2"
          >
            <p className="ds-stat-card__value">
              {dashboardStats.completedHomework}
              <span className="pl-1 text-ds-5xl text-white/80">/{dashboardStats.homeworkGoal}</span>
            </p>
            <p className="ds-stat-card__label text-white/75">Выполнено домашних заданий</p>
          </Link>
          <Link
            href="/progress"
            className="ds-stat-card ds-stat-card--sage block cursor-pointer rounded-[var(--ds-radius-xl)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/20 focus-visible:ring-offset-2"
          >
            <p className="ds-stat-card__value text-ds-ink">
              {dashboardStats.averageScore}
              <span className="pl-1 text-ds-5xl text-ds-text-secondary">/100</span>
            </p>
            <p className="ds-stat-card__label text-ds-text-muted">
              Средний балл
              <br />
              по тестам
            </p>
          </Link>
        </div>

        <div className="ds-dashboard-grid">
          <section className="ek-surface bg-ds-panel-muted px-5 py-4 sm:px-6">
            <ul className="flex flex-col gap-4 pt-1">
              {upcomingLessons.map((lesson, index) => {
                const dayNumber = Number(new Date(lesson.scheduledDate).getDate())
                const color = lessonColors[index] ?? "#d8d8d8"
                const circleText = color === "#10131d" ? "text-white" : "text-ds-text-secondary"
                const href = lesson.slug ? `/${lesson.slug}` : "/schedule"

                return (
                  <li key={lesson.id}>
                    <Link
                      href={href}
                      className="ds-lesson-row !mb-0 rounded-[var(--ds-radius-md)] py-0 no-underline outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25"
                    >
                      <div
                        className={`ds-lesson-dot text-center ${circleText}`}
                        style={{ backgroundColor: color }}
                      >
                        <span className="ds-lesson-dot__day">{dayNumber}</span>
                        <span className="ds-lesson-dot__time">
                          {lesson.scheduledTime.replace(" AM", "").replace(" PM", "")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="ds-lesson-row__title">{lesson.title}</p>
                        <p className="ds-lesson-row__meta">
                          {lesson.titleChinese}. {lesson.duration}
                        </p>
                      </div>
                      <ChevronRight className="ds-lesson-row__chevron h-7 w-7" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link href="/schedule" className="ds-link-sage mt-2 ml-[5.5rem] inline-block">
              смотреть дальше
            </Link>
          </section>

          <div className="grid gap-ds-gutter">
            <section className="ek-surface bg-ds-panel-muted px-6 py-5">
              <div className="flex items-end justify-between">
                <Link
                  href="/schedule"
                  className="group text-left no-underline outline-offset-2 focus-visible:rounded-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25"
                >
                  <h2 className="text-ds-5xl leading-none font-bold tracking-tight text-ds-text-primary transition-colors group-hover:text-ds-ink">
                    апрель <span className="text-ds-2xl font-normal text-ds-text-secondary">2025</span>
                  </h2>
                  <p className="mt-1 text-ds-body-sm text-ds-text-secondary">Открыть расписание</p>
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">
                {["вс", "пн", "вт", "ср", "чт", "пт", "сб"].map((day) => (
                  <div key={day} className="ds-calendar-weekday font-medium lowercase">
                    {day}
                  </div>
                ))}
                {monthRows.flat().map((day, index) => (
                  <div key={`${day ?? "x"}-${index}`} className="relative h-[3.3rem]">
                    {day ? (
                      <div className="flex h-full flex-col items-center justify-center">
                        {lessonDots[day]?.length ? (
                          <Link
                            href="/schedule"
                            className="flex flex-col items-center justify-center rounded-lg no-underline outline-offset-1 hover:bg-black/[0.04] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/20"
                          >
                            <span
                              className={`ds-calendar-cell grid h-7 w-7 place-content-center ${
                                day === 11 ? "ds-calendar-cell--today font-medium text-ds-ink" : ""
                              }`}
                            >
                              {day}
                            </span>
                            <div className="mt-[3px] flex h-[6px] items-center gap-[3px]">
                              {(lessonDots[day] ?? []).map((dotClass, dotIndex) => (
                                <span
                                  key={`${day}-${dotIndex}`}
                                  className={`h-[6px] w-[6px] rounded-full ${dotClass}`}
                                />
                              ))}
                            </div>
                          </Link>
                        ) : (
                          <>
                            <span
                              className={`ds-calendar-cell grid h-7 w-7 place-content-center ${
                                day === 11 ? "ds-calendar-cell--today font-medium text-ds-ink" : ""
                              }`}
                            >
                              {day}
                            </span>
                            <div className="mt-[3px] flex h-[6px] items-center gap-[3px]" />
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="ek-surface bg-ds-panel-muted px-6 py-4">
              <ul className="divide-y divide-black/10">
                {mentors.map((mentor) => (
                  <li key={mentor.name}>
                    <Link
                      href={`/mentors/${mentor.slug}`}
                      className="ds-contact-row py-3 no-underline outline-offset-2 focus-visible:rounded-xl focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25"
                    >
                      <div className="ds-contact-avatar flex items-center justify-center bg-white text-sm font-semibold text-ds-text-secondary">
                        {mentor.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="ds-contact-name">{mentor.name}</p>
                        <p className="ds-contact-role">{mentor.role}</p>
                      </div>
                      <ArrowRight className="h-6 w-6 shrink-0 text-ds-ink" aria-hidden />
                    </Link>
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
