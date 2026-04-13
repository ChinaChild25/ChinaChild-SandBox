"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, CalendarClock } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { hydrateTeacherStudentsFromProfiles } from "@/lib/supabase/teacher-student-cards"
import { getUpcomingLessonsDisplay } from "@/lib/teacher-schedule-display"
import { TEACHER_STUDENTS_MOCK, type TeacherStudentMock } from "@/lib/teacher-students-mock"

export default function TeacherStudentsPage() {
  const { usesSupabase } = useAuth()
  const [students, setStudents] = useState<TeacherStudentMock[]>(TEACHER_STUDENTS_MOCK)

  useEffect(() => {
    if (!usesSupabase) {
      setStudents(TEACHER_STUDENTS_MOCK)
      return
    }
    const supabase = createBrowserSupabaseClient()
    void hydrateTeacherStudentsFromProfiles(supabase, TEACHER_STUDENTS_MOCK).then(setStudents)
  }, [usesSupabase])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,1440px)]">
        <nav className="mb-4 text-[14px] text-ds-text-tertiary">
          <Link href="/teacher/dashboard" className="text-ds-text-secondary no-underline hover:underline">
            Главная
          </Link>
          <span className="mx-1.5">→</span>
          <span className="font-medium text-ds-ink">Ученики</span>
        </nav>

        <header className="mb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px]">Журнал учеников</h1>
            <Link
              href="/teacher/messages"
              className="shrink-0 rounded-[var(--ds-radius-md)] border border-black/10 bg-white px-4 py-2.5 text-[14px] font-semibold text-ds-ink no-underline transition-colors hover:bg-ds-surface-hover dark:border-white/15 dark:bg-ds-surface dark:hover:bg-white/5"
            >
              Написать ученику
            </Link>
          </div>
          <p className="mt-2 max-w-[52rem] text-[15px] leading-relaxed text-[var(--ds-text-secondary)]">
            Карточки группы: цели HSK, посещаемость и ближайшие слоты. Переносы из кабинета ученика подтягиваются в
            расписание (демо через локальное хранилище). Кнопка «Написать» на карточке появится, если в данных ученика
            задан <code className="text-[13px]">chatProfileId</code> (UUID из Supabase).
          </p>
        </header>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-2 xl:gap-6 2xl:grid-cols-3">
          {students.map((s) => {
            const upcoming = getUpcomingLessonsDisplay(s.id, 4)
            return (
              <article
                key={s.id}
                className="flex flex-col rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface shadow-[0_1px_0_rgb(0_0_0/0.04)] dark:border-white/10 dark:bg-[#0f0f0f]"
              >
                <div className="flex gap-4 border-b border-black/[0.06] p-5 dark:border-white/10">
                  <Link
                    href={`/teacher/students/${s.id}`}
                    className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-ds-sidebar ring-1 ring-black/8"
                  >
                    <Image
                      src={s.avatar}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="72px"
                      unoptimized={s.avatar.endsWith(".svg")}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/teacher/students/${s.id}`}
                      className="text-[20px] font-bold leading-snug text-ds-ink no-underline hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="mt-1 text-[14px] text-ds-text-secondary">{s.group}</p>
                    <p className="mt-2 text-[13px] text-ds-ink">
                      Цель: <span className="font-semibold text-ds-sage-strong">{s.hskTarget}</span>
                      <span className="mx-1.5 text-ds-text-tertiary">·</span>
                      <span className="text-ds-text-secondary">{s.levelLabel}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-black/[0.06] dark:bg-white/10">
                  <div className="bg-ds-surface p-3 text-center dark:bg-[#0f0f0f]">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-ds-text-tertiary">ДЗ</div>
                    <div className="mt-1 text-[17px] font-semibold tabular-nums text-ds-ink">
                      {s.homeworks.done}/{s.homeworks.total}
                    </div>
                  </div>
                  <div className="bg-ds-surface p-3 text-center dark:bg-[#0f0f0f]">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-ds-text-tertiary">
                      Визиты
                    </div>
                    <div className="mt-1 text-[17px] font-semibold tabular-nums text-ds-ink">
                      {s.attendance.done}/{s.attendance.total}
                    </div>
                  </div>
                  <div className="bg-ds-surface p-3 text-center dark:bg-[#0f0f0f]">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-ds-text-tertiary">Оценка</div>
                    <div className="mt-1 text-[17px] font-semibold tabular-nums text-ds-ink">
                      {s.grade.value}/{s.grade.max}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ds-text-tertiary">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    Ближайшие занятия
                  </div>
                  {upcoming.length === 0 ? (
                    <p className="text-[13px] text-ds-text-secondary">Нет предстоящих слотов в демо.</p>
                  ) : (
                    <ul className="space-y-2 text-[14px]">
                      {upcoming.map((u) => (
                        <li
                          key={`${s.id}-${u.lesson.id}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl bg-[var(--ds-neutral-row)] px-3 py-2 dark:bg-white/[0.06]"
                        >
                          <span className="font-medium text-ds-ink">
                            {u.weekdayShort} {u.dateLabel}
                          </span>
                          <span className="tabular-nums text-ds-text-secondary">{u.timeLabel}</span>
                          <span className="w-full text-[13px] text-ds-text-tertiary">{u.lesson.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-auto border-t border-black/[0.06] p-4 dark:border-white/10">
                  <Link
                    href={`/teacher/students/${s.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-ds-ink py-3 text-[14px] font-semibold text-white no-underline transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a]"
                  >
                    Полная карточка
                    <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
