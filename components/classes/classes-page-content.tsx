"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, FileCheck, Video } from "lucide-react"

import {
  canJoinOnlineClass,
  getClassesForStudent,
  type ClassDisplayType
} from "@/lib/classes-mock"
import { getOnlineClassJoinUrl } from "@/lib/online-class-link"

const classTypes: Array<ClassDisplayType | "Все"> = ["Все", "Урок", "Тест"]

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
  const allClasses = getClassesForStudent()

  const filtered =
    activeFilter === "Все" ? allClasses : allClasses.filter((c) => c.type === activeFilter)

  const upcoming = filtered.filter((c) => c.status === "upcoming")
  const completed = filtered.filter((c) => c.status === "completed")

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-6 md:mb-7">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">{title}</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">{subtitle}</p>
        </header>

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

        {upcoming.length > 0 ? (
          <section className="mb-8">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">
              Предстоящие
            </p>
            <ul className="space-y-3">
              {upcoming.map((cls) => (
                <li key={cls.id}>
                  <ClassCard cls={cls} scheduleFallbackHref={scheduleFallbackHref} />
                </li>
              ))}
            </ul>
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
                  <ClassCard cls={cls} scheduleFallbackHref={scheduleFallbackHref} />
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
  scheduleFallbackHref
}: {
  cls: ReturnType<typeof getClassesForStudent>[0]
  scheduleFallbackHref: "/schedule" | "/teacher/schedule"
}) {
  const href = cls.slug ? `/${cls.slug}` : scheduleFallbackHref
  const joinUrl = getOnlineClassJoinUrl()
  const showJoin = cls.status === "upcoming" && cls.type === "Урок" && cls.slug != null
  const joinActive = showJoin && canJoinOnlineClass(cls.isoDate, cls.timeRange)
  const joinDisabledTitle =
    "Подключение доступно только в день занятия (по календарю школы) и до его окончания."

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
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-[#2d8cff] px-4 py-3.5 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#2171d8] sm:w-auto sm:min-w-[11.5rem] sm:py-3 dark:bg-[#0b5cff] dark:hover:bg-[#0a4ed6]"
            aria-label="Подключиться к онлайн-занятию (Zoom или VooV)"
          >
            <Video className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
            Подключиться
          </a>
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
