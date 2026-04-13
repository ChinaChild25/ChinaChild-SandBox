"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Bell, BookOpen, GraduationCap, Users } from "lucide-react"
import { readTeacherFeed, subscribeTeacherFeed, type TeacherFeedItem } from "@/lib/teacher-schedule-sync"
import { TEACHER_STUDENTS_ACTIVE } from "@/lib/teacher-students-mock"

export default function TeacherDashboardPage() {
  const [feed, setFeed] = useState<TeacherFeedItem[]>([])

  useEffect(() => {
    setFeed(readTeacherFeed())
    return subscribeTeacherFeed(() => setFeed(readTeacherFeed()))
  }, [])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-8">
          <h1 className="text-[32px] font-bold leading-tight text-ds-ink sm:text-[40px]">Главная</h1>
          <p className="mt-2 max-w-[42rem] text-[16px] leading-relaxed text-[var(--ds-text-secondary)]">
            Тот же набор разделов, что и у ученика — курсы HSK, занятия, оценки и сообщения. Ниже — сводка по группе и
            уведомления о переносах (демо).
          </p>
        </header>

        {feed.length > 0 ? (
          <div
            className="mb-8 rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-sage/35 p-5 dark:border-white/10 dark:bg-ds-sage/20"
            role="status"
          >
            <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ds-ink">
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              Последние изменения
            </div>
            <ul className="space-y-2.5 text-[14px] text-ds-text-secondary">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <Link
            href="/teacher/students"
            className="group flex flex-col rounded-[var(--ds-radius-xl)] border border-black/8 bg-[var(--ds-neutral-row)] p-6 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:border-white/10"
          >
            <Users className="mb-4 h-9 w-9 text-ds-ink opacity-85" aria-hidden />
            <div className="text-[19px] font-semibold text-ds-ink">Ученики</div>
            <div className="mt-2 text-[14px] leading-snug text-ds-text-secondary">
              Журнал: {TEACHER_STUDENTS_ACTIVE.length} ученик, карточка и расписание по связке с Supabase
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-ds-ink">
              Открыть
              <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/teacher/courses"
            className="group flex flex-col rounded-[var(--ds-radius-xl)] border border-black/8 bg-[var(--ds-neutral-row)] p-6 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:border-white/10"
          >
            <BookOpen className="mb-4 h-9 w-9 text-ds-ink opacity-85" aria-hidden />
            <div className="text-[19px] font-semibold text-ds-ink">Курсы HSK 1 и 2</div>
            <div className="mt-2 text-[14px] leading-snug text-ds-text-secondary">
              Темы, уроки и материалы — как в кабинете ученика, для проведения занятий
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-ds-ink">
              К курсам
              <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/teacher/classes"
            className="group flex flex-col rounded-[var(--ds-radius-xl)] border border-black/8 bg-[var(--ds-neutral-row)] p-6 no-underline transition-colors hover:bg-[var(--ds-neutral-row-hover)] dark:border-white/10 sm:col-span-2 lg:col-span-1"
          >
            <GraduationCap className="mb-4 h-9 w-9 text-ds-ink opacity-85" aria-hidden />
            <div className="text-[19px] font-semibold text-ds-ink">Занятия</div>
            <div className="mt-2 text-[14px] leading-snug text-ds-text-secondary">
              Предстоящие и прошедшие уроки в том же виде, что видит ученик
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-ds-ink">
              Открыть
              <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/teacher/schedule"
            className="rounded-[var(--ds-radius-xl)] border border-black/8 bg-ds-surface px-5 py-4 text-[15px] font-medium text-ds-ink no-underline transition-colors hover:bg-[var(--ds-neutral-row)] dark:border-white/10"
          >
            Расписание по всем ученикам →
          </Link>
          <Link
            href="/teacher/messages"
            className="rounded-[var(--ds-radius-xl)] border border-black/8 bg-ds-surface px-5 py-4 text-[15px] font-medium text-ds-ink no-underline transition-colors hover:bg-[var(--ds-neutral-row)] dark:border-white/10"
          >
            Сообщения →
          </Link>
        </div>
      </div>
    </div>
  )
}
