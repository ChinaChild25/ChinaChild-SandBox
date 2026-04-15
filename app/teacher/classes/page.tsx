"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { PlayCircle, UserRound } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getAppNow } from "@/lib/app-time"
import { lessonWallClockEpochMs } from "@/lib/schedule-lessons"
import { canJoinOnlineClassFromScheduleSlot, ONLINE_JOIN_UNAVAILABLE_TITLE } from "@/lib/classes-mock"
import { resolveOnlineClassJoinUrl } from "@/lib/online-class-link"
import { getLessonsForTeacherView } from "@/lib/teacher-student-lessons"
import { TEACHER_STUDENTS_ACTIVE } from "@/lib/teacher-students-mock"
import { type ApiScheduleLessonRow } from "@/lib/teacher-schedule-display"

type FeedRow = {
  studentId: string
  studentName: string
  lesson: ApiScheduleLessonRow
}

const UPCOMING_GRACE_MS = 60 * 60 * 1000

/** Максимум карточек в блоке «Предстоящие» (общий лимит по всем ученикам). */
const TEACHER_CLASSES_UPCOMING_MAX = 8

export default function TeacherClassesPage() {
  const { usesSupabase } = useAuth()
  const [feedRows, setFeedRows] = useState<FeedRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!usesSupabase) {
      setFeedRows(null)
      setLoadError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void fetch("/api/schedule/teacher-classes-feed", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { entries?: FeedRow[]; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setFeedRows([])
          setLoadError(typeof data.error === "string" ? data.error : "Не удалось загрузить занятия")
          return
        }
        const raw = Array.isArray(data.entries) ? data.entries : []
        const normalized = raw.map((e) => ({
          studentId: e.studentId,
          studentName: e.studentName,
          lesson: e.lesson as ApiScheduleLessonRow
        }))
        setFeedRows(normalized)
      })
      .catch(() => {
        if (!cancelled) {
          setFeedRows([])
          setLoadError("Не удалось загрузить занятия")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [usesSupabase])

  const mockRows = useMemo((): FeedRow[] => {
    return TEACHER_STUDENTS_ACTIVE.flatMap((s) => {
      const hrefId = s.chatProfileId?.trim() || s.id
      return getLessonsForTeacherView(s.id).map((l) => ({
        studentId: hrefId,
        studentName: s.name,
        lesson: {
          id: l.id,
          dateKey: l.dateKey,
          time: l.time,
          title: l.title,
          type: "lesson" as const,
          teacherId: l.teacherId,
          teacher: l.teacher,
          teacherAvatarUrl: l.teacherAvatarUrl,
          onlineMeetingUrl: l.onlineMeetingUrl
        }
      }))
    })
  }, [])

  const rowsSource = usesSupabase ? feedRows : mockRows

  const { upcoming, completed, upcomingRestCount } = useMemo(() => {
    const now = getAppNow().getTime() - UPCOMING_GRACE_MS
    const list = rowsSource ?? []
    const enriched = list
      .map((r) => {
        const t = lessonWallClockEpochMs(r.lesson.dateKey, r.lesson.time)
        return { ...r, start: new Date(t), t }
      })
      .filter((r) => Number.isFinite(r.t))
    const upcomingAll = enriched.filter((r) => r.t >= now).sort((a, b) => a.t - b.t)
    const upcoming = upcomingAll.slice(0, TEACHER_CLASSES_UPCOMING_MAX)
    const upcomingRestCount = Math.max(0, upcomingAll.length - TEACHER_CLASSES_UPCOMING_MAX)
    const completed = enriched.filter((r) => r.t < now).sort((a, b) => b.t - a.t)
    return { upcoming, completed, upcomingRestCount }
  }, [rowsSource])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-6">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">Занятия</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Рабочая лента преподавателя: те же слоты, что в календаре и у учеников в расписании
            {usesSupabase ? " (данные из базы)." : " (демо без Supabase)."}
          </p>
        </header>

        {usesSupabase && loading ? (
          <p className="mb-6 text-[15px] text-ds-text-secondary">Загружаем занятия…</p>
        ) : null}
        {usesSupabase && loadError ? (
          <div className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[14px] text-red-900 dark:bg-red-950/40 dark:text-red-100">
            {loadError}
          </div>
        ) : null}

        {usesSupabase && !loading && !loadError && feedRows && feedRows.length === 0 ? (
          <section className="mb-8 rounded-2xl border border-black/10 bg-[var(--ds-neutral-row)] px-5 py-6 text-[15px] text-ds-text-secondary dark:border-white/10">
            Пока нет занятий с вашими учениками в календаре. Добавьте слоты или запись в{" "}
            <Link href="/teacher/schedule" className="font-medium text-ds-ink underline underline-offset-2">
              расписании
            </Link>
            .
          </section>
        ) : null}

        <section className="mb-8">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">Предстоящие</p>
          {upcoming.length === 0 ? (
            <p className="text-[15px] text-ds-text-secondary">
              {usesSupabase && loading ? null : "Нет предстоящих занятий."}
            </p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map(({ studentId, studentName, lesson, start }) => (
                <li key={`${lesson.id}-${studentId}`}>
                  <article className="rounded-2xl bg-[var(--ds-neutral-row)] p-4">
                    <div className="mb-1 text-[13px] text-ds-text-secondary">
                      {start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} ·{" "}
                      {start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-[18px] font-semibold text-ds-ink">{lesson.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/teacher/students/${studentId}`}
                        className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-md)] border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ds-ink no-underline transition-colors hover:bg-ds-surface-hover dark:border-white/15 dark:bg-ds-surface dark:hover:bg-white/5"
                      >
                        <UserRound className="h-4 w-4 shrink-0" aria-hidden /> {studentName}
                      </Link>
                      {canJoinOnlineClassFromScheduleSlot(lesson.dateKey, lesson.time) ? (
                        <a
                          href={resolveOnlineClassJoinUrl(lesson.onlineMeetingUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-md)] bg-ds-ink px-3 py-2 text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a] dark:hover:opacity-95"
                        >
                          <PlayCircle className="h-4 w-4 shrink-0" aria-hidden /> Начать занятие
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={ONLINE_JOIN_UNAVAILABLE_TITLE}
                          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-[var(--ds-radius-md)] bg-[#b8c5d6] px-3 py-2 text-[13px] font-semibold text-white/95 dark:bg-zinc-600 dark:text-zinc-200"
                          aria-label={`Начать занятие — недоступно. ${ONLINE_JOIN_UNAVAILABLE_TITLE}`}
                        >
                          <PlayCircle className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> Начать занятие
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {upcomingRestCount > 0 ? (
            <p className="mt-4 text-[14px] text-[var(--ds-text-secondary)]">
              Ещё {upcomingRestCount} {ruZanyatieWord(upcomingRestCount)} — в{" "}
              <Link href="/teacher/schedule" className="font-medium text-ds-ink underline underline-offset-2">
                расписании
              </Link>
              .
            </p>
          ) : null}
        </section>

        <section>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">Прошедшие</p>
          {completed.length === 0 ? (
            <p className="text-[15px] text-ds-text-secondary">Нет прошедших занятий в выгрузке.</p>
          ) : (
            <ul className="space-y-2">
              {completed.slice(0, 24).map(({ studentId, studentName, lesson, start }) => (
                <li
                  key={`done-${lesson.id}-${studentId}`}
                  className="rounded-[var(--ds-radius-md)] bg-[var(--ds-neutral-row)] px-4 py-3 text-[14px] text-ds-text-secondary"
                >
                  <span className="font-medium text-ds-ink">{studentName}</span> · {lesson.title} ·{" "}
                  {start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}{" "}
                  {start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function ruZanyatieWord(n: number): string {
  const d10 = n % 10
  const d100 = n % 100
  if (d10 === 1 && d100 !== 11) return "занятие"
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "занятия"
  return "занятий"
}
