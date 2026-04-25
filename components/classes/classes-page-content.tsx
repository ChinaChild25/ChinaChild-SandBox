"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ChevronRight, FileCheck, Video } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useStudentBillingSummary } from "@/hooks/use-student-billing-summary"
import {
  canJoinOnlineClass,
  classListItemsFromScheduledLessons,
  ONLINE_JOIN_UNAVAILABLE_TITLE,
  type ClassDisplayType,
  type ClassListItem
} from "@/lib/classes-mock"
import { buildScheduleCallHref } from "@/lib/daily/links"
import { resolveOnlineClassJoinUrl } from "@/lib/online-class-link"
import type { ScheduledLesson } from "@/lib/schedule-lessons"

const classTypes: Array<ClassDisplayType | "Все"> = ["Все", "Урок", "Тест"]

function ruLessonWord(n: number) {
  const d10 = n % 10
  const d100 = n % 100
  if (d10 === 1 && d100 !== 11) return "урок"
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "урока"
  return "уроков"
}

/** Сколько ближайших занятий показывать в блоке «Предстоящие» (полный список — в расписании). */
const CLASSES_UPCOMING_PREVIEW_MAX = 2

function typeIcon(displayType: ClassDisplayType) {
  if (displayType === "Тест") return <FileCheck size={20} className="text-ds-text-tertiary" aria-hidden />
  return <Video size={20} className="text-ds-text-tertiary" aria-hidden />
}

export function ClassesPageContent({
  scheduleFallbackHref,
  title,
  subtitle
}: {
  scheduleFallbackHref: "/schedule" | "/teacher/schedule"
  title: string
  subtitle: string
}) {
  const [activeFilter, setActiveFilter] = useState<(typeof classTypes)[number]>("Все")
  const [allClasses, setAllClasses] = useState<ClassListItem[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading")
  const { user, authReady } = useAuth()
  const { summary: billingSummary } = useStudentBillingSummary({ enabled: authReady && user?.role === "student" })

  const loadClasses = useCallback(async () => {
    setLoadState("loading")
    try {
      const res = await fetch("/api/schedule/student-lessons", { cache: "no-store" })
      const payload = (await res.json()) as { lessons?: ScheduledLesson[]; error?: string }
      if (!res.ok) {
        setAllClasses([])
        setLoadState("error")
        return
      }
      setAllClasses(classListItemsFromScheduledLessons(payload.lessons ?? []))
      setLoadState("ok")
    } catch {
      setAllClasses([])
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    if (!authReady || user?.role !== "student") return
    void loadClasses()
  }, [authReady, user?.role, loadClasses])

  const filtered =
    activeFilter === "Все" ? allClasses : allClasses.filter((c) => c.type === activeFilter)

  const upcoming = filtered.filter((c) => c.status === "upcoming")
  const upcomingPreview = upcoming.slice(0, CLASSES_UPCOMING_PREVIEW_MAX)
  const completed = filtered.filter((c) => c.status === "completed")

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-6 md:mb-7">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">{title}</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">{subtitle}</p>
        </header>

        {loadState === "loading" ? (
          <p className="mb-6 text-[15px] text-[var(--ds-text-secondary)]">Загружаем занятия…</p>
        ) : null}
        {loadState === "error" ? (
          <div className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[14px] text-red-900 dark:bg-red-950/40 dark:text-red-100">
            Не удалось загрузить расписание.{" "}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void loadClasses()}>
              Повторить
            </button>
          </div>
        ) : null}

        {billingSummary?.lowBalance ? (
          <section className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-[14px] text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <div className="font-semibold">
                  {billingSummary.blocked
                    ? "Баланс занятий исчерпан"
                    : `Осталось ${billingSummary.lessonsLeft} ${ruLessonWord(billingSummary.lessonsLeft)}`}
                </div>
                <div className="mt-1">
                  {billingSummary.blocked
                    ? "Подключение к уроку будет недоступно, пока вы не пополните пакет."
                    : "Пополните пакет заранее, чтобы не потерять доступ к онлайн-подключению."}
                  {" "}
                  <Link href="/payment" className="font-semibold text-current underline underline-offset-2">
                    Открыть оплату
                  </Link>
                  .
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2 md:mb-7">
          {classTypes.map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setActiveFilter(ft)}
              className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                activeFilter === ft
                  ? "bg-ds-ink text-white dark:bg-[#e8e8e8] dark:text-[#141414]"
                  : "ds-neutral-pill text-ds-ink"
              }`}
            >
              {ft}
            </button>
          ))}
        </div>

        {loadState === "ok" && upcomingPreview.length === 0 && completed.length === 0 ? (
          <section className="mb-8 rounded-2xl border border-black/10 bg-[var(--ds-neutral-row)] px-5 py-6 text-[15px] text-ds-text-secondary dark:border-white/10">
            Пока нет занятий в календаре. Запланируйте урок в{" "}
            <Link href={scheduleFallbackHref} className="font-medium text-ds-ink underline underline-offset-2">
              расписании
            </Link>
            .
          </section>
        ) : null}

        {upcomingPreview.length > 0 ? (
          <section className="mb-8">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">
              Предстоящие
            </p>
            <ul className="space-y-3">
              {upcomingPreview.map((cls) => (
                <li key={cls.id}>
                  <ClassCard
                    cls={cls}
                    scheduleFallbackHref={scheduleFallbackHref}
                    joinBlockedByBalance={Boolean(billingSummary?.blocked)}
                  />
                </li>
              ))}
            </ul>
            {upcoming.length > CLASSES_UPCOMING_PREVIEW_MAX ? (
              <p className="mt-4 text-[14px] text-[var(--ds-text-secondary)]">
                Остальные предстоящие занятия — в{" "}
                <Link href={scheduleFallbackHref} className="font-medium text-ds-ink underline underline-offset-2">
                  расписании
                </Link>
                .
              </p>
            ) : null}
          </section>
        ) : null}

        {completed.length > 0 ? (
          <section>
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">
              Прошедшие
            </p>
            <ul className="space-y-3">
              {completed.map((cls) => (
                <li key={cls.id}>
                  <ClassCard cls={cls} scheduleFallbackHref={scheduleFallbackHref} joinBlockedByBalance={false} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ClassCard({
  cls,
  scheduleFallbackHref,
  joinBlockedByBalance
}: {
  cls: ClassListItem
  scheduleFallbackHref: "/schedule" | "/teacher/schedule"
  joinBlockedByBalance: boolean
}) {
  const href = cls.slug ? `/${cls.slug}` : scheduleFallbackHref
  const joinUrl = cls.joinUrl ? resolveOnlineClassJoinUrl(cls.joinUrl) : null
  const scheduleJoinHref = cls.scheduleSlotId ? buildScheduleCallHref(cls.scheduleSlotId, "/classes") : null
  const showJoin =
    cls.status === "upcoming" && cls.type === "Урок" && (cls.slug != null || cls.showOnlineConnect === true)
  const joinActive = showJoin && !joinBlockedByBalance && canJoinOnlineClass(cls.isoDate, cls.timeRange)
  const joinDisabledTitle = joinBlockedByBalance
    ? "Баланс занятий исчерпан. Пополните пакет, чтобы подключиться к уроку."
    : ONLINE_JOIN_UNAVAILABLE_TITLE

  return (
    <div className="ds-class-card group flex flex-col gap-3 rounded-2xl p-3 outline-offset-2 transition-colors focus-within:ring-2 focus-within:ring-ds-ink/25 sm:flex-row sm:items-center md:gap-4 md:p-4">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 no-underline md:gap-4">
        <div
          className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl md:h-[72px] md:w-[72px]"
          style={{ backgroundColor: cls.bgColor, color: cls.textColor }}
        >
          <span className="text-[20px] font-semibold leading-none">{cls.dateLabel}</span>
          <span className="mt-0.5 text-[10px] opacity-90">{cls.monthShort}</span>
          <span className="mt-0.5 text-[10px] opacity-70">{cls.timeRange.split("–")[0]}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[13px] font-medium text-ds-text-secondary">
            {cls.dateLineRu}
            <span className="text-ds-text-tertiary"> · {cls.timeRange}</span>
          </p>
          <div className="mb-0.5 flex items-center gap-2">
            {typeIcon(cls.type)}
            <span className="text-[16px] font-medium text-ds-ink">{cls.title}</span>
          </div>
          <p className="truncate text-[13px] text-[var(--ds-text-secondary)]">{cls.description}</p>
          <p className="text-[12px] text-ds-text-soft">{cls.teacher}</p>
        </div>

        {cls.grade != null ? (
          <span className="shrink-0 text-[22px] font-bold text-ds-sage-strong">{cls.grade}</span>
        ) : null}

        <ChevronRight
          size={20}
          className="shrink-0 text-ds-chevron opacity-60 transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-hidden
        />
      </Link>

      {showJoin ? (
        joinActive ? (
          scheduleJoinHref ? (
            <Link
              href={scheduleJoinHref}
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-[#2d8cff] px-4 py-3.5 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#2171d8] sm:w-auto sm:min-w-[11.5rem] sm:py-3 dark:bg-[#0b5cff] dark:hover:bg-[#0a4ed6]"
              aria-label="Открыть встроенный звонок занятия"
            >
              <Video className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
              Подключиться
            </Link>
          ) : joinUrl ? (
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-[#2d8cff] px-4 py-3.5 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#2171d8] sm:w-auto sm:min-w-[11.5rem] sm:py-3 dark:bg-[#0b5cff] dark:hover:bg-[#0a4ed6]"
              aria-label="Подключиться к онлайн-занятию"
            >
              <Video className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
              Подключиться
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Для этого занятия пока нет связанного звонка."
              className="flex w-full shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-[#b8c5d6] px-4 py-3.5 text-[15px] font-semibold text-white/95 sm:w-auto sm:min-w-[11.5rem] sm:py-3 dark:bg-zinc-600 dark:text-zinc-200"
            >
              <Video className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              Подключиться
            </button>
          )
        ) : (
          <button
            type="button"
            disabled
            title={joinDisabledTitle}
            className="flex w-full shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-[#b8c5d6] px-4 py-3.5 text-[15px] font-semibold text-white/95 sm:w-auto sm:min-w-[11.5rem] sm:py-3 dark:bg-zinc-600 dark:text-zinc-200"
            aria-label={`Подключиться к занятию — недоступно. ${joinDisabledTitle}`}
          >
            <Video className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
            Подключиться
          </button>
        )
      ) : null}
    </div>
  )
}
