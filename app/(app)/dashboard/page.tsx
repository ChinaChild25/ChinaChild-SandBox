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
    <div className="box-border w-full px-5 py-6 sm:px-6 md:p-8">
      <div className="mx-auto flex w-full max-w-[min(100%,1060px)] flex-col gap-8">
        {/* Статистика — как chinachild.figma.site (без иконок, со стрелками) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/classes"
            className="block rounded-[28px] bg-[#e8e8e8] p-6 no-underline outline-offset-2 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/25 dark:bg-[#1e1e1e]"
          >
            <p className="mb-2 text-[50px] font-normal leading-none text-[#1a1a1a] dark:text-[#f4f4f4]">
              {dashboardStats.attendedLessons}
              <span className="text-[#888888] dark:text-[#737373]">/{dashboardStats.lessonGoal}</span>
            </p>
            <p className="text-[15px] text-[#555555] dark:text-[#a3a3a3]">Посещено занятий</p>
            <p className="mt-5 text-[15px] font-medium text-[#8ab84a] transition-colors hover:text-[#6d9838]">
              Смотреть все →
            </p>
          </Link>

          <Link
            href="/progress"
            className="block rounded-[28px] bg-[#1a1a1a] p-6 no-underline outline-offset-2 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <p className="mb-2 text-[50px] font-normal leading-none text-white">
              {dashboardStats.completedHomework}
              <span className="text-[#777777]">/{dashboardStats.homeworkGoal}</span>
            </p>
            <p className="text-[15px] text-[#aaaaaa]">Выполнено домашних заданий</p>
            <p className="mt-5 text-[15px] font-medium text-white/90 transition-colors hover:text-white">
              История оценок →
            </p>
          </Link>

          <Link
            href="/progress"
            className="block rounded-[28px] bg-[#d4e7b0] p-6 no-underline outline-offset-2 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/25 sm:col-span-2 lg:col-span-1"
          >
            <p className="mb-2 text-[50px] font-normal leading-none text-[#1a1a1a]">
              {dashboardStats.averageScore}
              <span className="text-[#666666]">/100</span>
            </p>
            <p className="text-[15px] text-[#555555]">Средний балл теста</p>
            <p className="mt-5 text-[15px] font-medium text-[#5a7a2e] transition-colors hover:text-[#4a6825]">
              Подробнее →
            </p>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <h2 className="mb-4 text-[20px] font-normal leading-none text-[#1a1a1a] dark:text-[#f4f4f4]">
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
                      <p className="mb-1 text-[20px] font-normal leading-none text-[#1a1a1a] dark:text-[#f4f4f4]">
                        {lesson.title}
                      </p>
                      <p className="flex items-center gap-2 text-[13px] text-[#666666] dark:text-[#a3a3a3]">
                        <span className="truncate">{lesson.description}</span>
                        {"hasIndicator" in lesson && lesson.hasIndicator ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a1a1a] dark:bg-white" />
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight
                      size={26}
                      className="shrink-0 text-[#cccccc] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#525252]"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-center">
              <Link
                href="/schedule"
                className="inline-block text-[15px] text-[#8ab84a] transition-colors hover:text-[#6d9838]"
              >
                смотреть все в расписании →
              </Link>
            </div>

            {/* Продолжить обучение — chinachild.figma.site */}
            <section className="mt-10 rounded-[24px] bg-[#f8f8f8] p-6 dark:bg-[#1a1a1a]">
              <p className="mb-3 text-[17px] font-semibold text-[#1a1a1a] dark:text-[#f4f4f4]">
                Продолжить обучение
              </p>
              <p className="text-[20px] font-normal leading-snug text-[#1a1a1a] dark:text-[#f4f4f4]">
                {FIGMA_CONTINUE_LESSON.title}
              </p>
              <p className="mt-2 text-[14px] text-[#666666] dark:text-[#a3a3a3]">
                {FIGMA_CONTINUE_LESSON.subtitle}
              </p>
              <Link
                href={FIGMA_CONTINUE_LESSON.href}
                className="mt-5 inline-block text-[15px] font-medium text-[#8ab84a] transition-colors hover:text-[#6d9838]"
              >
                Продолжить →
              </Link>
            </section>
          </div>

          <div>
            <div className="mb-6">
              <div className="mb-3">
                <span className="text-[30px] font-bold leading-none text-[#1a1a1a] dark:text-[#f4f4f4]">
                  {FIGMA_CALENDAR.monthTitle}{" "}
                </span>
                <span className="text-[30px] font-normal leading-none text-[#1a1a1a] dark:text-[#f4f4f4]">
                  {FIGMA_CALENDAR.year}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weekdays.map((d) => (
                  <div key={d} className="pb-1 text-center text-[12px] text-[#888888]">
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
                    className={`rounded-lg py-1.5 text-center transition-colors ${
                      item.isToday ? "bg-[#d4e7b0] dark:bg-[#3d4d2e]" : "hover:bg-[#f0f0f0] dark:hover:bg-[#262626]"
                    }`}
                  >
                    <div className="text-[14px] text-[#1a1a1a] dark:text-[#f4f4f4]">{item.day}</div>
                    {item.hasEvent ? (
                      <div className="mt-0.5 flex justify-center">
                        <span className="h-1 w-1 rounded-full bg-[#1a1a1a] dark:bg-white" />
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#888888]">
                Мои преподаватели
              </p>
              <ul className="flex flex-col gap-3">
                {FIGMA_TEACHERS.map((t) => (
                  <li
                    key={t.slug}
                    className="flex items-center gap-3 rounded-2xl border border-transparent p-1 transition-colors hover:border-black/6 hover:bg-black/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.04]"
                  >
                    <Link
                      href={`/mentors/${t.slug}`}
                      className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-200">
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
                        <p className="mb-0.5 text-[18px] font-normal leading-none text-[#1a1a1a] dark:text-[#f4f4f4]">
                          {t.name}
                        </p>
                        <p className="text-[13px] text-[#666666] dark:text-[#a3a3a3]">{t.role}</p>
                      </div>
                      <ChevronRight size={24} className="shrink-0 text-[#1a1a1a] dark:text-[#f4f4f4]" />
                    </Link>
                    <Link
                      href={`/messages?mentor=${t.slug}`}
                      className="shrink-0 rounded-full bg-[#1a1a1a] px-3 py-1.5 text-[13px] font-medium text-white no-underline transition-colors hover:bg-[#333333] dark:bg-white dark:text-[#141414] dark:hover:bg-[#e5e5e5]"
                    >
                      Написать
                    </Link>
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
