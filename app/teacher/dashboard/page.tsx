"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Bell, Users } from "lucide-react"
import { readTeacherFeed, subscribeTeacherFeed, type TeacherFeedItem } from "@/lib/teacher-schedule-sync"
import { TEACHER_STUDENTS_MOCK } from "@/lib/teacher-students-mock"

export default function TeacherDashboardPage() {
  const [feed, setFeed] = useState<TeacherFeedItem[]>([])

  useEffect(() => {
    setFeed(readTeacherFeed())
    return subscribeTeacherFeed(() => setFeed(readTeacherFeed()))
  }, [])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,760px)]">
        <header className="mb-6">
          <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px]">Главная</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Кабинет преподавателя: ученики и изменения расписания (демо, без сервера).
          </p>
        </header>

        {feed.length > 0 ? (
          <div
            className="mb-6 rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-sage/35 p-4 dark:border-white/10 dark:bg-ds-sage/20"
            role="status"
          >
            <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-ds-ink">
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              Последние изменения
            </div>
            <ul className="space-y-2 text-[13px] text-ds-text-secondary">
              {feed.slice(0, 5).map((item) => (
                <li key={item.id} className="border-b border-black/[0.06] pb-2 last:border-0 last:pb-0 dark:border-white/10">
                  <span className="font-medium text-ds-ink">{item.title}</span>
                  <span className="mx-1 text-ds-text-tertiary">·</span>
                  {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/teacher/students"
            className="group flex flex-col rounded-[var(--ds-radius-xl)] border border-black/8 bg-[var(--ds-neutral-row)] p-5 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:border-white/10"
          >
            <Users className="mb-3 h-8 w-8 text-ds-ink opacity-80" aria-hidden />
            <div className="text-[18px] font-semibold text-ds-ink">Ученики</div>
            <div className="mt-1 text-[14px] text-ds-text-secondary">
              Журнал: {TEACHER_STUDENTS_MOCK.length} человек
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-ds-ink">
              Открыть
              <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/teacher/schedule"
            className="group flex flex-col rounded-[var(--ds-radius-xl)] border border-black/8 bg-[var(--ds-neutral-row)] p-5 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:border-white/10"
          >
            <div className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ds-text-tertiary">
              Расписание
            </div>
            <div className="text-[18px] font-semibold text-ds-ink">Все слоты</div>
            <div className="mt-1 text-[14px] text-ds-text-secondary">
              Сводка по ученикам; переносы ученика подтягиваются с устройства (демо).
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-ds-ink">
              Открыть
              <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
