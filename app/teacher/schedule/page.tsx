"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getAllTeacherCalendarEvents, type TeacherCalendarEvent } from "@/lib/teacher-student-lessons"
import { subscribeTeacherSchedule } from "@/lib/teacher-schedule-sync"

function fmt(d: Date) {
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  })
}

export default function TeacherSchedulePage() {
  const [events, setEvents] = useState<TeacherCalendarEvent[]>([])

  const refresh = () => setEvents(getAllTeacherCalendarEvents())

  useEffect(() => {
    refresh()
    return subscribeTeacherSchedule(refresh)
  }, [])

  const now = Date.now()
  const upcoming = events.filter((e) => e.start.getTime() >= now - 60 * 60 * 1000)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <nav className="mb-4 text-[14px] text-ds-text-tertiary">
          <Link href="/teacher/dashboard" className="text-ds-text-secondary no-underline hover:underline">
            Главная
          </Link>
          <span className="mx-1.5">→</span>
          <span className="font-medium text-ds-ink">Расписание</span>
        </nav>

        <h1 className="mb-1 text-[28px] font-bold text-ds-ink sm:text-[34px]">Расписание</h1>
        <p className="mb-6 text-[15px] text-[var(--ds-text-secondary)]">
          Все занятия по ученикам. Если ученик перенёс урок в своём кабинете, здесь обновится слот для него и появится
          уведомление на главной.
        </p>

        <ul className="space-y-2">
          {upcoming.length === 0 ? (
            <li className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface p-6 text-center text-ds-text-secondary dark:border-white/10">
              Нет предстоящих слотов в демо-данных.
            </li>
          ) : (
            upcoming.map((e) => (
              <li
                key={`${e.student.id}-${e.lesson.id}-${e.lesson.dateKey}-${e.lesson.time}`}
                className="flex flex-col gap-1 rounded-[var(--ds-radius-xl)] border border-black/10 bg-[var(--ds-neutral-row)] px-4 py-3 dark:border-white/10"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ds-ink">{e.student.name}</span>
                  <span className="text-[13px] tabular-nums text-ds-text-secondary">{fmt(e.start)}</span>
                </div>
                <div className="text-[14px] text-ds-text-secondary">
                  {e.lesson.title}
                  {e.lesson.teacher ? ` · ${e.lesson.teacher}` : ""}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
