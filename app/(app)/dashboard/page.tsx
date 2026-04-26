"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AlertTriangle, ArrowRight, ChevronRight, ClipboardList, Star, TrendingUp } from "lucide-react"

import { useStudentBillingSummary } from "@/hooks/use-student-billing-summary"
import { useAuth } from "@/lib/auth-context"
import {
  readNotificationPreferences,
  subscribeNotificationPreferences,
  type NotificationPreferences
} from "@/lib/notification-preferences"
import { TelegramIcon, telegramProfileUrl } from "@/components/telegram-icon"
import { curatorAndTeacherForUser } from "@/lib/student-staff"
import { localeToBcp47, useUiLocale } from "@/lib/ui-locale"
import { getAppNow } from "@/lib/app-time"

type DashboardLesson = {
  id: string
  dateKey: string
  date: number
  time: string
  description: string
  href: string
}

/** Блок «ближайшие уроки» на главной — не перегружать карточку длинным списком. */
const DASHBOARD_UPCOMING_LESSONS_MAX = 4

function ruLessonWord(n: number) {
  const d10 = n % 10
  const d100 = n % 100
  if (d10 === 1 && d100 !== 11) return "урок"
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "урока"
  return "уроков"
}

export default function DashboardPage() {
  const { user, authReady } = useAuth()
  const { t, locale } = useUiLocale()
  const { summary: billingSummary } = useStudentBillingSummary({ enabled: authReady && user?.role === "student" })
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(readNotificationPreferences)
  const [upcomingLessons, setUpcomingLessons] = useState<DashboardLesson[]>([])
  const [calendarLessonDateKeys, setCalendarLessonDateKeys] = useState<string[]>([])
  const [upcomingLoading, setUpcomingLoading] = useState(true)

  useEffect(() => {
    setNotifPrefs(readNotificationPreferences())
    return subscribeNotificationPreferences(() => setNotifPrefs(readNotificationPreferences()))
  }, [])

  useEffect(() => {
    if (!authReady || user?.role !== "student") return
    let alive = true
    async function loadUpcomingLessons() {
      try {
        setUpcomingLoading(true)
        const res = await fetch("/api/schedule/student-lessons", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as {
          lessons?: Array<{ id: string; dateKey: string; time: string; title?: string; teacher?: string }>
        }
        const nowTs = getAppNow().getTime()
        const rawLessons = json.lessons ?? []
        if (alive) setCalendarLessonDateKeys(rawLessons.map((l) => l.dateKey))
        const lessons = rawLessons
          .map((lesson) => {
            const [y, m, d] = lesson.dateKey.split("-").map((chunk) => Number.parseInt(chunk, 10))
            const [h, mm] = lesson.time.split(":").map((chunk) => Number.parseInt(chunk, 10))
            const start = new Date(y, (m || 1) - 1, d || 1, h || 0, mm || 0, 0, 0)
            return {
              raw: lesson,
              start
            }
          })
          .filter(({ start }) => Number.isFinite(start.getTime()) && start.getTime() > nowTs)
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .slice(0, DASHBOARD_UPCOMING_LESSONS_MAX)
          .map(({ raw, start }) => ({
            id: raw.id,
            dateKey: raw.dateKey,
            date: start.getDate(),
            time: `${raw.time}–${String((start.getHours() + 1) % 24).padStart(2, "0")}:00`,
            description: raw.teacher ? `${raw.title || "Занятие"} · ${raw.teacher}` : raw.title || "Занятие",
            href: "/schedule"
          }))
        if (alive) setUpcomingLessons(lessons)
      } catch {
        if (alive) setUpcomingLessons([])
        if (alive) setCalendarLessonDateKeys([])
      } finally {
        if (alive) setUpcomingLoading(false)
      }
    }
    void loadUpcomingLessons()
    return () => {
      alive = false
    }
  }, [authReady, user?.role])

  const dashboardStats = user?.dashboardStats ?? {
    attendedLessons: 9,
    lessonGoal: 48,
    completedHomework: 8,
    homeworkGoal: 48,
    averageScore: 93
  }

  const { curator, teacher, curatorSlug, teacherSlug } = user
    ? curatorAndTeacherForUser(user)
    : curatorAndTeacherForUser(null)

  const appNow = getAppNow()
  const calendarYear = appNow.getFullYear()
  const calendarMonth = appNow.getMonth()
  const calendarToday = appNow.getDate()
  const calendarStartOffset = new Date(calendarYear, calendarMonth, 1).getDay()
  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const lessonDateSet = new Set(calendarLessonDateKeys)
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

  const upcomingLessonHeading = useCallback(
    (dateKey: string) =>
      new Date(`${dateKey}T00:00:00`).toLocaleDateString(localeToBcp47(locale), {
        day: "numeric",
        month: "long"
      }),
    [locale]
  )

  return (
    <div className="ds-figma-page">
      <div className="ds-dashboard-page flex flex-col">
        {billingSummary?.lowBalance ? (
          <aside className="mb-4 rounded-[var(--ds-radius-xl)] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[14px] text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <div className="font-semibold">
                  {billingSummary.blocked
                    ? "Баланс занятий закончился"
                    : `Осталось ${billingSummary.lessonsLeft} ${ruLessonWord(billingSummary.lessonsLeft)}`}
                </div>
                <div className="mt-1">
                  {billingSummary.blocked
                    ? "Пополните пакет, чтобы снова подключаться и записываться на занятия."
                    : "Проверьте раздел оплаты и пополните пакет заранее, чтобы не прерывать занятия."}
                  {" "}
                  <Link href="/payment" className="font-semibold underline underline-offset-2">
                    Перейти к оплате
                  </Link>
                  .
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        {notifPrefs.news ? (
          <aside className="mb-6 rounded-[var(--ds-radius-xl)] border border-black/[0.06] bg-ds-sage/35 px-4 py-3 text-[14px] text-ds-ink dark:border-white/10 dark:bg-ds-sage/20 dark:text-white">
            <span className="font-semibold">{t("dashboard.newsTitle")}</span>{" "}
            <span className="text-ds-text-secondary dark:text-white/80">{t("dashboard.newsBody")}</span>
          </aside>
        ) : null}

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
              <span className="text-[#888] dark:text-white/50">/{dashboardStats.lessonGoal}</span>
            </div>
            <div className="ds-stat-card__label text-[#555] dark:text-[var(--ds-text-secondary)]">
              {t("dashboard.statLessons")}
            </div>
            <span className="ds-dashboard-stat-link">
              {t("dashboard.seeAll")}
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
              <span className="text-white/55 dark:text-white/50">/{dashboardStats.homeworkGoal}</span>
            </div>
            <div className="ds-stat-card__label text-[#aaa] dark:text-zinc-400">{t("dashboard.statHomework")}</div>
            <span className="ds-dashboard-stat-link">
              {t("dashboard.gradeHistory")}
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
              <span className="text-[#666] dark:text-white/55">/100</span>
            </div>
            <div className="ds-stat-card__label text-[#555] dark:text-[var(--ds-text-secondary)]">
              {t("dashboard.statAvg")}
            </div>
            <span className="ds-dashboard-stat-link">
              {t("dashboard.more")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>

        <div className="ds-dashboard-grid">
          <div>
            <h2 className="mb-4 text-[20px] font-semibold leading-none text-ds-ink">{t("dashboard.upcoming")}</h2>
            {upcomingLoading ? (
              <div className="rounded-[var(--ds-radius-xl)] bg-[var(--ds-neutral-row)] px-4 py-6 text-[14px] text-[#666] dark:text-[var(--ds-text-secondary)]">
                Загружаем занятия...
              </div>
            ) : upcomingLessons.length > 0 ? (
              <ul className="flex list-none flex-col gap-6 p-0 sm:gap-7">
                {upcomingLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={lesson.href}
                      className="group flex items-center gap-4 rounded-[var(--ds-radius-xl)] px-3 py-2 -mx-3 no-underline transition-colors duration-150 hover:bg-black/[0.06] dark:hover:bg-white/[0.07]"
                    >
                      <div className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center rounded-full border-0 bg-[var(--ds-sage)] text-center text-ds-ink sm:h-[104px] sm:w-[104px] dark:text-white">
                        <span className="mb-1 text-[30px] font-normal leading-none tabular-nums sm:mb-1.5 sm:text-[36px]">
                          {lesson.date}
                        </span>
                        <span className="text-[12px] leading-tight opacity-90 sm:text-[13px]">{lesson.time}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[17px] font-normal leading-snug text-ds-ink sm:text-[20px] sm:leading-none">
                        {upcomingLessonHeading(lesson.dateKey)}
                        </p>
                        <p className="flex items-center gap-2 text-[13px] text-[#666] dark:text-[var(--ds-text-secondary)]">
                          <span className="truncate">{lesson.description}</span>
                        </p>
                      </div>
                      <ChevronRight
                        size={34}
                        strokeWidth={2.25}
                        className="shrink-0 text-[#ccc] opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-[var(--ds-radius-xl)] bg-[var(--ds-neutral-row)] px-4 py-6 text-[14px] text-[#666] dark:text-[var(--ds-text-secondary)]">
                {t("dashboard.noUpcoming")}
              </div>
            )}

            <div className="mt-6 text-center">
              <Link href="/classes" className="ds-dashboard-stat-link inline-flex justify-center">
                {t("dashboard.seeAll")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-6">
              <div className="mb-3">
                <span className="ds-calendar-title-bold capitalize text-ds-ink">
                  {calendarMonthTitle}{" "}
                </span>
                <span className="ds-calendar-title-reg text-ds-ink">{calendarYear}</span>
              </div>

              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {weekdays.map((d) => (
                  <div key={d} className="pb-1 text-center text-[11px] text-[#888] dark:text-ds-text-tertiary sm:text-[12px]">
                    {d}
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
                      href="/schedule"
                      className={`flex min-h-[44px] flex-col items-center justify-center rounded-[var(--ds-radius-md)] py-1 text-center no-underline outline-offset-1 focus-visible:ring-2 focus-visible:ring-ds-ink/20 sm:min-h-[2.75rem] sm:py-1.5 ${
                        item.isToday ? "bg-ds-sage" : "hover:bg-ds-surface-hover"
                      }`}
                    >
                      <div className="text-[13px] text-ds-ink sm:text-[14px]">{item.day}</div>
                      <div className="mt-0.5 flex h-2 items-center justify-center" aria-hidden>
                        {showDot ? <span className="h-1 w-1 rounded-full bg-ds-sage-strong" /> : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="min-w-0 w-full max-w-full">
              <h3 className="mb-3 text-[17px] font-semibold leading-none text-ds-ink">{t("dashboard.staffTitle")}</h3>
              <ul className="flex list-none flex-col gap-4 p-0">
                {(
                  [
                    { slug: curatorSlug, m: curator, kind: "curator" as const },
                    { slug: teacherSlug, m: teacher, kind: "teacher" as const }
                  ] as const
                ).map(({ slug, m, kind }) => (
                  <li
                    key={slug}
                    className="min-w-0 max-w-full rounded-[var(--ds-radius-xl)] bg-transparent px-3 py-3 transition-colors duration-200 hover:bg-[var(--ds-neutral-row)] sm:px-4 dark:hover:bg-[var(--ds-neutral-row-hover)]"
                  >
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                      <Link
                        href={`/mentors/${slug}`}
                        className="flex min-w-0 w-full flex-1 items-center gap-3 no-underline sm:min-w-0"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
                          <Image
                            src={m.photo}
                            alt={m.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="text-[11px] font-semibold text-[#888] dark:text-ds-text-tertiary">
                            {kind === "curator" ? t("dashboard.roleCurator") : t("dashboard.roleTeacher")}
                          </div>
                          <div className="mb-0.5 min-w-0 hyphens-auto text-[18px] font-semibold leading-snug text-ds-ink">
                            {m.name}
                          </div>
                          <div className="min-w-0 hyphens-auto text-[13px] leading-snug text-[#666] dark:text-[var(--ds-text-secondary)]">
                            {m.role}
                          </div>
                        </div>
                      </Link>
                      <div className="flex w-full min-w-0 shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-start">
                        <a
                          href={telegramProfileUrl(m.telegramUsername)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid h-10 w-10 shrink-0 place-content-center rounded-[var(--ds-radius-md)] bg-[#2AABEE]/12 text-[#229ED9] transition-colors hover:bg-[#2AABEE]/20 dark:bg-[#2AABEE]/20 dark:text-[#54bdeb]"
                          aria-label={t("dashboard.telegramWrite", { username: m.telegramUsername })}
                        >
                          <TelegramIcon className="h-[22px] w-[22px]" />
                        </a>
                        <Link
                          href={`/messages?mentor=${slug}`}
                          className="flex min-w-0 items-center gap-1 rounded-[var(--ds-radius-md)] bg-white px-3 py-2 text-[13px] font-medium text-ds-ink no-underline shadow-none transition-colors hover:bg-ds-surface-hover dark:bg-ds-surface dark:hover:bg-white/5"
                        >
                          <span className="truncate">{t("dashboard.write")}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                        </Link>
                      </div>
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
