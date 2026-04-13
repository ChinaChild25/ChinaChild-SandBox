"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  dragHintsActive,
  SCHEDULE_DRAG_MIME,
  ScheduleDayColumn,
  ScheduleEmptySlot,
  ScheduleLessonCard,
  weekDays
} from "@/components/schedule/schedule-week-grid"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { getAppTodayStart } from "@/lib/app-time"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { loadStudentScheduleFromDb, saveStudentScheduleToDb } from "@/lib/supabase/schedule"
import { hydrateTeacherStudentsFromProfiles } from "@/lib/supabase/teacher-student-cards"
import {
  canTeacherRescheduleLesson,
  dateKeyFromDate,
  findLessonAt,
  isLessonPastOrStarted,
  isValidTeacherRescheduleTargetSlot,
  parseLessonStart,
  SCHEDULE_DEFAULT_TEACHER,
  SCHEDULE_MONTH_APRIL,
  TEACHER_SCHEDULE_SLOT_TIMES,
  SCHEDULE_YEAR,
  type ScheduledLesson
} from "@/lib/schedule-lessons"
import { mirrorStudentLessonsForTeacher, pushTeacherFeedItem } from "@/lib/teacher-schedule-sync"
import { getLessonsForTeacherView } from "@/lib/teacher-student-lessons"
import { getTeacherStudentById, type TeacherStudentMock } from "@/lib/teacher-students-mock"

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfWeekMonday(ref: Date) {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

const APRIL_FIRST = new Date(SCHEDULE_YEAR, SCHEDULE_MONTH_APRIL, 1)
const FIRST_WEEK_MONDAY = startOfWeekMonday(APRIL_FIRST)
const MS_7D = 7 * 24 * 60 * 60 * 1000

function initialWeekOffset(): number {
  const mon = startOfWeekMonday(getAppTodayStart())
  return Math.round((mon.getTime() - FIRST_WEEK_MONDAY.getTime()) / MS_7D)
}

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря"
] as const

function formatWeekLabel(monday: Date) {
  const sunday = addDays(monday, 6)
  const y = sunday.getFullYear()
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} — ${sunday.getDate()} ${MONTHS_GEN[sunday.getMonth()]} ${y}`
  }
  return `${monday.getDate()} ${MONTHS_GEN[monday.getMonth()].slice(0, 3)} — ${sunday.getDate()} ${MONTHS_GEN[sunday.getMonth()]} ${y}`
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatSlotLabel(dateKey: string, time: string) {
  const d = parseLessonStart(dateKey, time)
  return `${d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })}, ${time}`
}

type PendingReschedule = {
  lessonId: string
  fromDateKey: string
  fromTime: string
  toDateKey: string
  toTime: string
}

export default function TeacherRescheduleStudentPage() {
  const params = useParams()
  const studentId = typeof params.studentId === "string" ? params.studentId : ""
  const { user, usesSupabase } = useAuth()

  const [student, setStudent] = useState<TeacherStudentMock | undefined>(() =>
    studentId ? getTeacherStudentById(studentId) : undefined
  )

  useEffect(() => {
    setStudent(studentId ? getTeacherStudentById(studentId) : undefined)
  }, [studentId])

  useEffect(() => {
    if (!usesSupabase) return
    const base = studentId ? getTeacherStudentById(studentId) : undefined
    if (!base?.chatProfileId) return
    const supabase = createBrowserSupabaseClient()
    void hydrateTeacherStudentsFromProfiles(supabase, [base]).then(([next]) => setStudent(next))
  }, [usesSupabase, studentId])

  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const [lessons, setLessons] = useState<ScheduledLesson[]>([])
  const [ready, setReady] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null)
  const [dropHover, setDropHover] = useState<{ dateKey: string; time: string } | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState<PendingReschedule | null>(null)

  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedLessonTitle, setBlockedLessonTitle] = useState("")

  useEffect(() => {
    setDbReady(false)
    setReady(false)
    if (!studentId) {
      setLessons([])
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      const base = getTeacherStudentById(studentId)
      if (!base) {
        if (!cancelled) {
          setLessons([])
          setReady(true)
        }
        return
      }
      let list = getLessonsForTeacherView(base.id)
      const pid = base.chatProfileId?.trim()
      if (isSupabaseConfigured() && pid) {
        try {
          const supabase = createBrowserSupabaseClient()
          const { lessons: fromDb } = await loadStudentScheduleFromDb(supabase, pid)
          if (!cancelled && fromDb.length > 0) list = fromDb
        } catch {
          /* демо-расписание */
        }
      }
      if (!cancelled) {
        setLessons(list)
        setReady(true)
        setDbReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId])

  const profileId = student?.chatProfileId?.trim()

  useEffect(() => {
    if (!dbReady || !isSupabaseConfigured() || !profileId) return
    const supabase = createBrowserSupabaseClient()
    void saveStudentScheduleToDb(supabase, profileId, lessons)
  }, [lessons, dbReady, profileId])

  useEffect(() => {
    if (!ready || !studentId) return
    if (profileId) mirrorStudentLessonsForTeacher(profileId, lessons)
    else mirrorStudentLessonsForTeacher(studentId, lessons)
  }, [lessons, ready, profileId, studentId])

  const { monday, cells } = useMemo(() => {
    const monday0 = addDays(FIRST_WEEK_MONDAY, weekOffset * 7)
    const cells0 = weekDays.map((_, i) => addDays(monday0, i))
    return { monday: monday0, cells: cells0 }
  }, [weekOffset])

  const today = useMemo(() => getAppTodayStart(), [])
  const weekTitle = formatWeekLabel(monday)

  const attemptMove = useCallback(
    (lessonId: string, toDateKey: string, toTime: string) => {
      const lesson = lessons.find((l) => l.id === lessonId)
      if (!lesson) return

      if (lesson.dateKey === toDateKey && lesson.time === toTime) {
        setSelectedLessonId(null)
        return
      }

      if (isLessonPastOrStarted(lesson.dateKey, lesson.time)) {
        toast({
          title: "Занятие уже прошло",
          description: "Перенос прошедших занятий недоступен."
        })
        setSelectedLessonId(null)
        return
      }

      if (!canTeacherRescheduleLesson(lesson.dateKey, lesson.time)) {
        setSelectedLessonId(null)
        return
      }

      if (!isValidTeacherRescheduleTargetSlot(toDateKey, toTime)) {
        setBlockedLessonTitle(`${lesson.title} → ${formatSlotLabel(toDateKey, toTime)}`)
        setBlockedOpen(true)
        setSelectedLessonId(null)
        return
      }

      const occupant = findLessonAt(lessons, toDateKey, toTime)
      if (occupant && occupant.id !== lessonId) {
        toast({
          title: "Слот занят",
          description: "Выберите свободное время или другой день."
        })
        setSelectedLessonId(null)
        return
      }

      setPending({
        lessonId,
        fromDateKey: lesson.dateKey,
        fromTime: lesson.time,
        toDateKey,
        toTime
      })
      setConfirmOpen(true)
    },
    [lessons]
  )

  const onSelectLesson = useCallback(
    (id: string) => {
      const lesson = lessons.find((l) => l.id === id)
      if (!lesson || !canTeacherRescheduleLesson(lesson.dateKey, lesson.time)) return
      setSelectedLessonId((prev) => (prev === id ? null : id))
    },
    [lessons]
  )

  const onEmptyClick = useCallback(
    (dateKey: string, time: string) => {
      if (!selectedLessonId) return
      attemptMove(selectedLessonId, dateKey, time)
    },
    [selectedLessonId, attemptMove]
  )

  const onSlotDrop = useCallback(
    (lessonId: string, dateKey: string, time: string) => {
      setDropHover(null)
      attemptMove(lessonId, dateKey, time)
    },
    [attemptMove]
  )

  const onDragHoverSlot = useCallback((dateKey: string, time: string) => {
    setDropHover({ dateKey, time })
  }, [])

  const onDragStart = useCallback((e: React.DragEvent, lesson: ScheduledLesson) => {
    e.dataTransfer.setData(SCHEDULE_DRAG_MIME, lesson.id)
    e.dataTransfer.setData("text/plain", lesson.id)
    e.dataTransfer.effectAllowed = "move"
    setDraggingLessonId(lesson.id)
    setDropHover(null)
  }, [])

  const onDragEnd = useCallback(() => {
    setDraggingLessonId(null)
    setDropHover(null)
  }, [])

  const confirmReschedule = useCallback(() => {
    if (!pending || !student) return
    const p = pending
    setLessons((prev) =>
      prev.map((l) => (l.id === p.lessonId ? { ...l, dateKey: p.toDateKey, time: p.toTime } : l))
    )
    const feedStudentId = profileId ?? student.id
    pushTeacherFeedItem({
      studentId: feedStudentId,
      studentName: student.name,
      title: "Перенос занятия",
      message: `${user?.name?.trim() ? `${user.name} (преподаватель)` : "Преподаватель"}: ${student.name} — ${formatSlotLabel(p.fromDateKey, p.fromTime)} → ${formatSlotLabel(p.toDateKey, p.toTime)}`
    })
    setConfirmOpen(false)
    setPending(null)
    setSelectedLessonId(null)
    toast({
      title: "Занятие перенесено",
      description: profileId
        ? "Расписание ученика обновлено в базе."
        : "Изменение сохранено локально (демо, без профиля Supabase)."
    })
  }, [pending, student, profileId, user?.name])

  if (!studentId) {
    return (
      <div className="ds-figma-page">
        <p className="text-ds-text-secondary">Не указан ученик.</p>
        <Link href="/teacher/schedule" className="mt-4 inline-block text-ds-ink underline">
          К расписанию
        </Link>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="ds-figma-page">
        <p className="text-ds-text-secondary">Ученик не найден.</p>
        <Link href="/teacher/schedule" className="mt-4 inline-block text-ds-ink underline">
          К расписанию
        </Link>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="ds-figma-page">
        <p className="text-ds-text-secondary">Загрузка расписания…</p>
      </div>
    )
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <nav className="mb-4 text-[14px] text-ds-text-tertiary">
          <Link href="/teacher/dashboard" className="text-ds-text-secondary no-underline hover:underline">
            Главная
          </Link>
          <span className="mx-1.5">→</span>
          <Link href="/teacher/schedule" className="text-ds-text-secondary no-underline hover:underline">
            Расписание
          </Link>
          <span className="mx-1.5">→</span>
          <Link
            href={`/teacher/students/${student.id}`}
            className="text-ds-text-secondary no-underline hover:underline"
          >
            {student.name}
          </Link>
          <span className="mx-1.5">→</span>
          <span className="font-medium text-ds-ink">Перенос</span>
        </nav>

        <h1 className="mb-1 text-[28px] font-bold text-ds-ink sm:text-[34px]">Перенос занятия</h1>
        <p className="mb-6 text-[15px] text-[var(--ds-text-secondary)]">
          Ученик: <span className="font-medium text-ds-ink">{student.name}</span>. 24 слота в день, с 08:00 до 20:00
          (шаг 30 минут), преподаватель по умолчанию — {SCHEDULE_DEFAULT_TEACHER}. Для преподавателя можно переносить
          даже если до начала урока осталось меньше 24 часов; новое время должно быть в будущем и не позже чем через 7
          суток от текущего момента.
        </p>

        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="min-w-0 px-1 text-center text-[15px] font-semibold text-ds-ink">{weekTitle}</div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Следующая неделя"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="hidden gap-3 lg:grid lg:grid-cols-7">
          {cells.map((cellDate, i) => (
            <ScheduleDayColumn
              key={`w${weekOffset}-d${i}`}
              cellDate={cellDate}
              weekDayIndex={i}
              isToday={isSameDay(cellDate, today)}
              lessons={lessons}
              selectedLessonId={selectedLessonId}
              draggingLessonId={draggingLessonId}
              dropHover={dropHover}
              variant="teacher"
              onSelectLesson={onSelectLesson}
              onSlotDrop={onSlotDrop}
              onEmptyClick={onEmptyClick}
              onDragHoverSlot={onDragHoverSlot}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              slotTimes={TEACHER_SCHEDULE_SLOT_TIMES}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:hidden">
          {cells.map((cellDate, i) => {
            const dateKey = dateKeyFromDate(cellDate)
            const isToday = isSameDay(cellDate, today)
            const showDropHints = dragHintsActive(lessons, draggingLessonId, "teacher")

            return (
              <section
                key={`w${weekOffset}-m${i}`}
                className="rounded-[20px] border border-black/[0.06] bg-ds-surface p-4 dark:border-white/10"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-ds-text-tertiary">
                      {weekDays[i]}
                    </span>
                    <span className="text-[26px] font-bold leading-none text-ds-ink">{cellDate.getDate()}</span>
                  </div>
                  {isToday ? (
                    <span className="rounded-full bg-ds-sage px-2.5 py-1 text-[11px] font-semibold text-ds-ink dark:text-[#ecfccb]">
                      Сегодня
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {TEACHER_SCHEDULE_SLOT_TIMES.map((time) => {
                    const lesson = findLessonAt(lessons, dateKey, time)
                    if (lesson) {
                      const movable = canTeacherRescheduleLesson(lesson.dateKey, lesson.time)
                      const isPast = isLessonPastOrStarted(lesson.dateKey, lesson.time)
                      return (
                        <ScheduleLessonCard
                          key={`${lesson.id}-${time}`}
                          lesson={lesson}
                          selected={selectedLessonId === lesson.id}
                          movable={movable}
                          isPast={isPast}
                          variant="teacher"
                          onSelect={() => onSelectLesson(lesson.id)}
                          onDragStart={(e) => {
                            if (!canTeacherRescheduleLesson(lesson.dateKey, lesson.time)) {
                              e.preventDefault()
                              return
                            }
                            onDragStart(e, lesson)
                          }}
                          onDragEnd={onDragEnd}
                        />
                      )
                    }
                    const draggingMovable = showDropHints
                    const slotOk = isValidTeacherRescheduleTargetSlot(dateKey, time)
                    return (
                      <ScheduleEmptySlot
                        key={`${dateKey}-${time}`}
                        dateKey={dateKey}
                        time={time}
                        tapSelectActive={!!selectedLessonId && slotOk}
                        dragActive={draggingMovable && slotOk}
                        isDragHoverTarget={
                          draggingMovable && slotOk && dropHover?.dateKey === dateKey && dropHover?.time === time
                        }
                        onDragHoverSlot={onDragHoverSlot}
                        onDropLesson={(lessonId) => onSlotDrop(lessonId, dateKey, time)}
                        onClickPick={() => onEmptyClick(dateKey, time)}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setPending(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Перенести занятие ученика?</DialogTitle>
            <DialogDescription asChild>
              <div className="text-[15px] leading-relaxed text-ds-text-secondary">
                {pending ? (
                  <>
                    <p className="mb-2">Новое время:</p>
                    <p className="font-medium text-ds-ink dark:text-white">
                      {formatSlotLabel(pending.fromDateKey, pending.fromTime)}
                    </p>
                    <p className="my-2 text-ds-text-tertiary">→</p>
                    <p className="font-medium text-ds-ink dark:text-white">
                      {formatSlotLabel(pending.toDateKey, pending.toTime)}
                    </p>
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={confirmReschedule}>
              Подтвердить перенос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={blockedOpen}
        onOpenChange={(open) => {
          setBlockedOpen(open)
          if (!open) setBlockedLessonTitle("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Перенос недоступен</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-[15px] leading-relaxed text-ds-text-secondary">
                <p>
                  Новое время должно быть в будущем и не позже чем через 7 суток от текущего момента — выбранный слот в
                  эти рамки не попадает.
                </p>
                {blockedLessonTitle ? (
                  <p className="font-medium text-ds-ink dark:text-white">{blockedLessonTitle}</p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="default" onClick={() => setBlockedOpen(false)}>
              Понятно
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
