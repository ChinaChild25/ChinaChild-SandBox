"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, CalendarDays } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { hydrateTeacherStudentsFromProfiles } from "@/lib/supabase/teacher-student-cards"
import {
  getUpcomingLessonsDisplay,
  getUpcomingLessonsDisplayFromLessons,
  scheduledLessonsFromApiRows,
  type ApiScheduleLessonRow,
  type UpcomingLessonDisplay
} from "@/lib/teacher-schedule-display"
import { getTeacherStudentById, type TeacherStudentMock } from "@/lib/teacher-students-mock"
import { StartChatWithStudentButton } from "@/components/teacher/start-chat-with-student-button"

export default function TeacherStudentDetailPage() {
  const params = useParams()
  const studentId = typeof params.studentId === "string" ? params.studentId : ""
  const { usesSupabase } = useAuth()
  const [s, setS] = useState<TeacherStudentMock | undefined>(() => getTeacherStudentById(studentId))

  useEffect(() => {
    setS(getTeacherStudentById(studentId))
  }, [studentId])

  useEffect(() => {
    if (!usesSupabase) return
    const base = getTeacherStudentById(studentId)
    if (!base?.chatProfileId) return
    const supabase = createBrowserSupabaseClient()
    void hydrateTeacherStudentsFromProfiles(supabase, [base]).then(([next]) => setS(next))
  }, [usesSupabase, studentId])

  const [scheduleItems, setScheduleItems] = useState<UpcomingLessonDisplay[]>(() =>
    studentId ? getUpcomingLessonsDisplay(studentId, 14) : []
  )
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  useEffect(() => {
    if (!s) return
    if (!usesSupabase || !s.chatProfileId?.trim()) {
      setScheduleItems(getUpcomingLessonsDisplay(s.id, 14))
      setScheduleLoading(false)
      setScheduleError(null)
      return
    }
    const pid = s.chatProfileId.trim()
    let cancelled = false
    setScheduleLoading(true)
    setScheduleError(null)
    void fetch(`/api/schedule/teacher-student-lessons?student_id=${encodeURIComponent(pid)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { lessons?: unknown; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setScheduleError(typeof data.error === "string" ? data.error : "Не удалось загрузить расписание")
          setScheduleItems([])
          return
        }
        const raw = Array.isArray(data.lessons) ? data.lessons : []
        const lessons = scheduledLessonsFromApiRows(raw as ApiScheduleLessonRow[])
        setScheduleItems(getUpcomingLessonsDisplayFromLessons(lessons, 14))
      })
      .catch(() => {
        if (!cancelled) {
          setScheduleError("Не удалось загрузить расписание")
          setScheduleItems([])
        }
      })
      .finally(() => {
        if (!cancelled) setScheduleLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [usesSupabase, s?.id, s?.chatProfileId])

  if (!s) {
    return (
      <div className="ds-figma-page">
        <p className="text-ds-text-secondary">Ученик не найден.</p>
        <Link href="/teacher/students" className="mt-4 inline-block text-ds-ink underline">
          К журналу
        </Link>
      </div>
    )
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,1320px)]">
        <Link
          href="/teacher/students"
          className="mb-6 inline-flex items-center gap-2 text-[14px] font-medium text-ds-text-secondary no-underline hover:text-ds-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          К журналу
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,380px)] lg:items-start">
          <div className="min-w-0">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-2xl bg-ds-sidebar ring-1 ring-black/8">
                <Image
                  src={s.avatar}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="100px"
                  unoptimized={s.avatar.endsWith(".svg")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[32px] font-bold leading-tight text-ds-ink sm:text-[38px]">{s.name}</h1>
                <p className="mt-1 text-[16px] text-ds-text-secondary">{s.group}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[15px]">
                  <span className="rounded-full bg-ds-sage/35 px-4 py-1.5 font-semibold text-ds-ink dark:bg-ds-sage/20">
                    Цель: {s.hskTarget}
                  </span>
                  <span className="rounded-full bg-[var(--ds-neutral-row)] px-4 py-1.5 text-ds-text-secondary dark:bg-white/10">
                    Уровень: {s.levelLabel}
                  </span>
                  {s.chatProfileId ? (
                    <StartChatWithStudentButton
                      studentProfileId={s.chatProfileId}
                      studentDisplayName={s.name}
                      className="rounded-full"
                    />
                  ) : null}
                </div>
                <div className="mt-5 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-2xl bg-[var(--ds-neutral-row)] p-4 dark:bg-white/[0.06]">
                    <div className="text-[11px] font-semibold uppercase text-ds-text-tertiary">Домашние</div>
                    <div className="mt-1 text-[22px] font-bold tabular-nums text-ds-ink">
                      {s.homeworks.done}/{s.homeworks.total}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--ds-neutral-row)] p-4 dark:bg-white/[0.06]">
                    <div className="text-[11px] font-semibold uppercase text-ds-text-tertiary">Посещаемость</div>
                    <div className="mt-1 text-[22px] font-bold tabular-nums text-ds-ink">
                      {s.attendance.done}/{s.attendance.total}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--ds-neutral-row)] p-4 dark:bg-white/[0.06]">
                    <div className="text-[11px] font-semibold uppercase text-ds-text-tertiary">Итоговая</div>
                    <div className="mt-1 text-[22px] font-bold tabular-nums text-ds-ink">
                      {s.grade.value}/{s.grade.max}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="mb-10">
              <h2 className="mb-4 text-[20px] font-semibold text-ds-ink">Треки и прогресс</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {s.tracks.map((tr) => (
                  <li key={tr.title} className="rounded-[var(--ds-radius-xl)] border border-black/8 bg-ds-surface p-4 dark:border-white/10">
                    <div className="mb-2 flex justify-between text-[14px]">
                      <span className="font-medium text-ds-ink">{tr.title}</span>
                      <span className="tabular-nums text-ds-text-tertiary">{tr.percent}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-ds-sage-strong"
                        style={{ width: `${Math.min(100, tr.percent)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mb-10 grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-3 text-[18px] font-semibold text-ds-ink">Сильные стороны</h2>
                <ul className="list-none space-y-2 p-0">
                  {s.strengths.map((x) => (
                    <li
                      key={x}
                      className="rounded-xl bg-ds-sage/25 px-4 py-2.5 text-[15px] text-ds-ink dark:bg-ds-sage/15"
                    >
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="mb-3 text-[18px] font-semibold text-ds-ink">Зоны внимания</h2>
                <ul className="list-none space-y-2 p-0">
                  {s.weaknesses.map((x) => (
                    <li
                      key={x}
                      className="rounded-xl bg-[var(--ds-neutral-row)] px-4 py-2.5 text-[15px] text-ds-text-secondary dark:bg-white/[0.06]"
                    >
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section>
              <h2 className="mb-4 text-[18px] font-semibold text-ds-ink">Последние тесты и работы</h2>
              <div className="overflow-hidden rounded-[var(--ds-radius-xl)] border border-black/10 dark:border-white/10">
                <table className="w-full border-collapse text-left text-[15px]">
                  <thead>
                    <tr className="bg-[var(--ds-neutral-row)] text-[12px] font-semibold uppercase tracking-wide text-ds-text-tertiary">
                      <th className="px-5 py-3">Тема</th>
                      <th className="px-5 py-3">Балл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.lastTests.map((t) => (
                      <tr key={t.title} className="border-t border-black/8 dark:border-white/10">
                        <td className="px-5 py-3.5 text-ds-text-secondary">{t.title}</td>
                        <td className="px-5 py-3.5 font-semibold tabular-nums text-ds-ink">{t.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <div className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-[var(--ds-neutral-row)] p-5 dark:border-white/10 dark:bg-[#141414]">
              <div className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-ds-ink">
                <CalendarDays className="h-5 w-5 text-ds-sage-strong" aria-hidden />
                Расписание
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-ds-text-secondary">
                {usesSupabase && s.chatProfileId
                  ? "Занятия из базы: расписание ученика и подтверждённые слоты в вашем календаре."
                  : "Демо-расписание (без Supabase или без привязки профиля ученика)."}
              </p>
              <Link
                href={`/teacher/schedule/reschedule/${s.id}`}
                className="mb-4 inline-block text-[13px] font-medium text-ds-sage-strong no-underline hover:underline"
              >
                Перенести занятие
              </Link>
              {scheduleLoading ? (
                <p className="text-[14px] text-ds-text-tertiary">Загрузка…</p>
              ) : scheduleError ? (
                <p className="text-[14px] text-red-600 dark:text-red-300">{scheduleError}</p>
              ) : scheduleItems.length === 0 ? (
                <p className="text-[14px] text-ds-text-tertiary">Нет предстоящих занятий.</p>
              ) : (
                <ul className="max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-1">
                  {scheduleItems.map((u) => (
                    <li
                      key={`${u.lesson.id}-${u.start.getTime()}`}
                      className="rounded-xl border border-black/8 bg-ds-surface px-4 py-3 dark:border-white/10 dark:bg-[#0a0a0a]"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-semibold text-ds-ink">
                          {u.weekdayShort} {u.dateLabel}
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ds-sage-strong">
                          {u.timeLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-ds-text-secondary">{u.lesson.title}</p>
                      <p className="mt-0.5 text-[12px] text-ds-text-tertiary">{u.lesson.teacher}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
