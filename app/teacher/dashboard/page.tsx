"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Users,
  XCircle
} from "lucide-react"
import { getAppNow } from "@/lib/app-time"
import { lessonWallClockEpochMs } from "@/lib/schedule-lessons"
import { readTeacherFeed, subscribeTeacherFeed, type TeacherFeedItem } from "@/lib/teacher-schedule-sync"
import { TEACHER_STUDENTS_MOCK } from "@/lib/teacher-students-mock"
import { localeToBcp47, useUiLocale } from "@/lib/ui-locale"

type ClassesFeedEntry = {
  studentId: string
  studentName: string
  lesson: { id: string; dateKey: string; time: string; title: string }
}

type DashboardLesson = {
  id: string
  dateKey: string
  date: number
  time: string
  description: string
  href: string
}

const UPCOMING_MAX = 3
const HOMEWORK_ROWS = 6

/** Время начала для бейджа (без выдуманного «+1 ч» и без обрезки длинного диапазона). */
function lessonStartLabel(raw: string): string {
  const t = raw.trim()
  const head = t.split(/[–—-]/u)[0]?.trim()
  return head || t
}

export default function TeacherDashboardPage() {
  const { t, locale } = useUiLocale()
  const [feed, setFeed] = useState<TeacherFeedItem[]>([])
  const [classEntries, setClassEntries] = useState<ClassesFeedEntry[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)

  useEffect(() => {
    setFeed(readTeacherFeed())
    return subscribeTeacherFeed(() => setFeed(readTeacherFeed()))
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setScheduleLoading(true)
        const res = await fetch("/api/schedule/teacher-classes-feed", { cache: "no-store" })
        if (!res.ok) {
          if (alive) setClassEntries([])
          return
        }
        const json = (await res.json()) as { entries?: ClassesFeedEntry[] }
        if (alive) setClassEntries(Array.isArray(json.entries) ? json.entries : [])
      } catch {
        if (alive) setClassEntries([])
      } finally {
        if (alive) setScheduleLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const mockTotals = useMemo(() => {
    let hwDone = 0
    let hwTotal = 0
    let gradeSum = 0
    let gradeN = 0
    for (const s of TEACHER_STUDENTS_MOCK) {
      hwDone += s.homeworks.done
      hwTotal += s.homeworks.total
      gradeSum += s.grade.value
      gradeN += 1
    }
    return {
      students: TEACHER_STUDENTS_MOCK.length,
      hwDone,
      hwTotal,
      avgGrade: gradeN ? Math.round(gradeSum / gradeN) : 0
    }
  }, [])

  const appNow = getAppNow()
  const calendarYear = appNow.getFullYear()
  const calendarMonth = appNow.getMonth()
  const calendarToday = appNow.getDate()
  const calendarStartOffset = new Date(calendarYear, calendarMonth, 1).getDay()
  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()

  const lessonDateSet = useMemo(() => {
    const set = new Set<string>()
    for (const e of classEntries) {
      const dk = e.lesson?.dateKey
      if (dk) set.add(dk)
    }
    return set
  }, [classEntries])

  const calendarDays = Array.from({ length: calendarDaysInMonth }, (_, i) => {
    const day = i + 1
    const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return {
      day,
      hasEvent: lessonDateSet.has(dateKey),
      isToday: day === calendarToday
    }
  })

  const weekdays = useMemo(() => t("dashboard.weekdays").split(","), [t])
  const calendarMonthTitle = useMemo(
    () =>
      new Date(calendarYear, calendarMonth, 1).toLocaleDateString(localeToBcp47(locale), {
        month: "long"
      }),
    [calendarMonth, calendarYear, locale]
  )

  const nowTs = appNow.getTime()

  const upcomingLessons = useMemo(() => {
    const future = classEntries
      .filter((e) => lessonWallClockEpochMs(e.lesson.dateKey, e.lesson.time) > nowTs)
      .sort(
        (a, b) =>
          lessonWallClockEpochMs(a.lesson.dateKey, a.lesson.time) -
          lessonWallClockEpochMs(b.lesson.dateKey, b.lesson.time)
      )
      .slice(0, UPCOMING_MAX)

    return future.map((e) => {
      const { lesson, studentName } = e
      const ts = lessonWallClockEpochMs(lesson.dateKey, lesson.time)
      const start = new Date(ts)
      return {
        id: `${lesson.id}-${e.studentId}`,
        dateKey: lesson.dateKey,
        date: start.getDate(),
        time: lessonStartLabel(lesson.time),
        description: `${lesson.title || "Занятие"} · ${studentName}`,
        href: "/teacher/schedule"
      }
    })
  }, [classEntries, nowTs])

  const upcomingLessonHeading = useCallback(
    (dateKey: string) =>
      new Date(`${dateKey}T00:00:00`).toLocaleDateString(localeToBcp47(locale), {
        day: "numeric",
        month: "long"
      }),
    [locale]
  )

  const homeworkPreview = useMemo(
    () =>
      TEACHER_STUDENTS_MOCK.slice(0, HOMEWORK_ROWS).map((s) => ({
        id: s.id,
        name: s.name,
        href: `/teacher/students/${s.chatProfileId ?? s.id}`,
        done: s.homeworks.done,
        total: s.homeworks.total
      })),
    []
  )

  return (
    <div className="ds-figma-page">
      <div className="ds-dashboard-page flex flex-col">
        <header className="mb-6 sm:mb-8">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#888] dark:text-ds-text-tertiary">
            Кабинет преподавателя
          </p>
          <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px]">Главная</h1>
          <p className="mt-2 max-w-[44rem] text-[15px] leading-relaxed text-[var(--ds-text-secondary)]">
            Сводка по группе, календарь занятий и заметки по ученикам — в том же визуальном ритме, что и главная ученика.
          </p>
        </header>

        <div className="ds-stat-grid mb-6 sm:mb-8">
          <Link
            href="/teacher/students"
            className="ds-stat-card ds-stat-card--muted ds-stat-card--interactive block rounded-[28px] no-underline"
          >
            <div className="ds-stat-card__top">
              <span className="ds-stat-card__icon-badge rounded-2xl">
                <Users size={22} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div className="ds-stat-card__value text-ds-ink">{mockTotals.students}</div>
            <div className="ds-stat-card__label text-[#555] dark:text-[var(--ds-text-secondary)]">Учеников в журнале</div>
            <span className="ds-dashboard-stat-link">
              Журнал и карточки
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          <Link
            href="/teacher/students"
            className="ds-stat-card ds-stat-card--dark ds-stat-card--interactive block rounded-[28px] no-underline text-white"
          >
            <div className="ds-stat-card__top">
              <span className="ds-stat-card__icon-badge rounded-2xl">
                <ClipboardList size={22} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div className="ds-stat-card__value">
              {mockTotals.hwDone}
              <span className="text-white/55 dark:text-white/50">/{mockTotals.hwTotal}</span>
            </div>
            <div className="ds-stat-card__label text-[#aaa] dark:text-zinc-400">Домашние задания (демо)</div>
            <span className="ds-dashboard-stat-link">
              Кто сдал / кто отстаёт
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          <Link
            href="/teacher/progress"
            className="ds-stat-card ds-stat-card--sage ds-stat-card--interactive block rounded-[28px] no-underline"
          >
            <div className="ds-stat-card__top">
              <span className="ds-stat-card__icon-badge rounded-2xl">
                <GraduationCap size={22} strokeWidth={2} aria-hidden />
              </span>
            </div>
            <div className="ds-stat-card__value text-ds-ink">
              {mockTotals.avgGrade}
              <span className="text-[#666] dark:text-white/55">/100</span>
            </div>
            <div className="ds-stat-card__label text-[#555] dark:text-[var(--ds-text-secondary)]">Средняя оценка (демо)</div>
            <span className="ds-dashboard-stat-link">
              Прогресс и тесты
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>

        {/*
          Сетка: на lg первая строка — два заголовка (ровно по верху), вторая — список и календарь
          (верх первой карточки = верх сетки дат). На мобиле порядок: ближайшие → список → календарь → виджет.
        */}
        <div className="grid grid-cols-1 gap-y-5 lg:grid-cols-[minmax(0,24rem)_300px] lg:items-stretch lg:gap-x-8 lg:gap-y-3">
          <h2 className="order-1 m-0 shrink-0 text-[17px] font-semibold leading-none text-ds-ink lg:order-none lg:col-start-1 lg:row-start-1">
            Ближайшие занятия
          </h2>
          <h2 className="order-3 m-0 shrink-0 text-[17px] font-semibold leading-none text-ds-ink lg:order-none lg:col-start-2 lg:row-start-1">
            Календарь
          </h2>

          <div className="order-2 flex min-h-0 w-full min-w-0 max-w-md flex-col self-stretch lg:order-none lg:col-start-1 lg:row-start-2 lg:max-w-sm">
            <div className="flex min-h-0 flex-1 flex-col">
              {scheduleLoading ? (
                <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] px-3 py-4 text-[13px] text-[#666] dark:text-[var(--ds-text-secondary)]">
                  Загружаем расписание…
                </div>
              ) : upcomingLessons.length > 0 ? (
                <ul className="flex list-none flex-col gap-2.5 p-0">
                  {upcomingLessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={lesson.href}
                        className="group flex min-h-[6.25rem] items-stretch gap-3 overflow-hidden rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] px-3 py-3 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:hover:bg-[var(--ds-neutral-row-hover)]"
                      >
                        <div className="flex size-[6.5rem] shrink-0 flex-col items-center justify-center gap-1 self-center rounded-full bg-[var(--ds-sage)] px-2 py-2 text-center text-ds-ink dark:text-white">
                          <span className="text-[28px] font-semibold leading-none tabular-nums">{lesson.date}</span>
                          <span className="max-w-full whitespace-nowrap text-[18px] font-semibold tabular-nums leading-none tracking-tight text-ds-ink/95 dark:text-white/95">
                            {lesson.time}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                          <p className="text-[16px] font-medium leading-snug text-ds-ink">
                            {upcomingLessonHeading(lesson.dateKey)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-[#666] dark:text-[var(--ds-text-secondary)]">
                            {lesson.description}
                          </p>
                        </div>
                        <ChevronRight
                          size={22}
                          strokeWidth={2}
                          className="shrink-0 self-center text-[#bbb] opacity-70 transition-opacity group-hover:opacity-100 dark:text-zinc-500"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-1 flex-col rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] px-3 py-4 text-[13px] leading-relaxed text-[#666] dark:text-[var(--ds-text-secondary)]">
                  Нет предстоящих слотов. Добавьте занятия в{" "}
                  <Link href="/teacher/schedule" className="font-medium text-ds-ink underline-offset-2 hover:underline">
                    расписании
                  </Link>
                  .
                </div>
              )}
            </div>

            <div className="mt-auto shrink-0 pt-4">
              <Link href="/teacher/schedule" className="ds-dashboard-stat-link inline-flex text-[13px]">
                Полное расписание
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="order-4 flex w-full max-w-[300px] flex-col self-start rounded-[var(--ds-radius-xl)] border border-black/[0.08] bg-ds-surface p-3 dark:border-white/10 lg:order-none lg:col-start-2 lg:row-start-2 lg:w-full lg:max-w-[300px] lg:justify-self-stretch">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 text-[15px] font-semibold capitalize leading-tight text-ds-ink">
                  {calendarMonthTitle}{" "}
                  <span className="font-normal text-ds-text-secondary">{calendarYear}</span>
                </p>
              </div>
              <Link
                href="/teacher/schedule"
                className="shrink-0 rounded-md border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-ds-ink no-underline transition-colors hover:bg-ds-surface-hover dark:border-white/10 dark:bg-ds-surface dark:hover:bg-white/5"
              >
                Расписание
              </Link>
            </div>

            <div className="grid grid-cols-7 content-start gap-px">
              {weekdays.map((d) => (
                <div
                  key={d}
                  className="pb-1 text-center text-[10px] font-medium leading-none text-[#888] dark:text-ds-text-tertiary"
                >
                  {d.trim().slice(0, 2)}
                </div>
              ))}
              {Array.from({ length: calendarStartOffset }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {calendarDays.map((item) => {
                const showDot = item.hasEvent || item.isToday
                return (
                  <Link
                    key={item.day}
                    href="/teacher/schedule"
                    className={`flex min-h-[32px] flex-col items-center justify-center rounded-md py-0.5 text-center no-underline focus-visible:ring-2 focus-visible:ring-ds-ink/20 ${
                      item.isToday ? "bg-ds-sage" : "hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="text-[12px] font-medium leading-none text-ds-ink">{item.day}</div>
                    <div className="mt-0.5 flex h-1.5 items-center justify-center" aria-hidden>
                      {showDot ? <span className="h-1 w-1 rounded-full bg-ds-sage-strong" /> : null}
                    </div>
                  </Link>
                )
              })}
            </div>
            <p className="mt-2 shrink-0 text-center text-[10px] leading-tight text-ds-text-tertiary">
              Точка — есть занятия · сегодня подсвечен
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
          {feed.length > 0 ? (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[17px] font-semibold text-ds-ink">
                <Bell className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                Лента изменений
              </h2>
              <div
                className="rounded-[var(--ds-radius-xl)] border border-black/[0.06] bg-ds-sage/35 p-3.5 dark:border-white/10 dark:bg-ds-sage/20"
                role="status"
              >
                <ul className="space-y-2.5 text-[13px] text-ds-text-secondary">
                  {feed.slice(0, 6).map((item) => (
                    <li
                      key={item.id}
                      className="border-b border-black/[0.06] pb-2.5 last:border-0 last:pb-0 dark:border-white/10"
                    >
                      <span className="font-medium text-ds-ink">{item.title}</span>
                      <span className="mx-1 text-ds-text-tertiary">·</span>
                      {item.message}
                      <div className="mt-0.5 text-[11px] text-ds-text-tertiary">{item.studentName}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <div aria-hidden className="hidden lg:block" />
          )}

          <section className={feed.length === 0 ? "lg:col-span-2" : ""}>
            <h3 className="mb-2 text-[18px] font-semibold leading-none text-ds-ink">Домашние задания</h3>
            <p className="mb-3 text-[13px] leading-snug text-ds-text-secondary">
              Демо по журналу: кто вовремя закрыл блоки и у кого остались хвосты.
            </p>
            <ul className="grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 sm:gap-3">
              {homeworkPreview.map((row) => {
                const ok = row.done >= row.total
                const partial = !ok && row.done > 0
                return (
                  <li key={row.id} className="min-w-0">
                    <Link
                      href={row.href}
                      className="flex h-full min-h-[5.5rem] flex-col gap-2 rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] px-3 py-3 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:hover:bg-[var(--ds-neutral-row-hover)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {ok ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-ds-sage-strong" strokeWidth={2.25} aria-hidden />
                          ) : partial ? (
                            <Bell className="h-5 w-5 shrink-0 text-amber-600/90 dark:text-amber-400/90" strokeWidth={2.25} aria-hidden />
                          ) : (
                            <XCircle className="h-5 w-5 shrink-0 text-neutral-400 dark:text-neutral-500" strokeWidth={2.25} aria-hidden />
                          )}
                          <span className="truncate text-[15px] font-semibold leading-snug text-ds-ink">{row.name}</span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold leading-none tracking-tight ${
                            ok
                              ? "bg-ds-sage/50 text-ds-ink dark:bg-ds-sage/25 dark:text-white"
                              : partial
                                ? "bg-amber-500/15 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100"
                                : "bg-black/[0.06] text-ds-text-secondary dark:bg-white/10"
                          }`}
                        >
                          {ok ? "В срок" : partial ? "Частично" : "Долг"}
                        </span>
                      </div>
                      <p className="mt-auto text-[13px] font-medium leading-snug text-ds-text-secondary">
                        {row.done}/{row.total} заданий
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
