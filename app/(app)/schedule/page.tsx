"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { mirrorStudentLessonsForTeacher, pushTeacherFeedItem } from "@/lib/teacher-schedule-sync"
import {
  buildInitialAprilLessons,
  canRescheduleLesson,
  dateKeyFromDate,
  findLessonAt,
  isLessonPastOrStarted,
  isValidRescheduleTargetSlot,
  parseLessonStart,
  readStoredLessons,
  SCHEDULE_DEFAULT_TEACHER,
  SCHEDULE_MONTH_APRIL,
  SCHEDULE_SLOT_TIMES,
  SCHEDULE_YEAR,
  writeStoredLessons,
  type ScheduledLesson
} from "@/lib/schedule-lessons"

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const

const DRAG_MIME = "application/x-chinachild-lesson"

function dragHintsActive(lessons: ScheduledLesson[], draggingLessonId: string | null): boolean {
  if (!draggingLessonId) return false
  const L = lessons.find((l) => l.id === draggingLessonId)
  return L ? canRescheduleLesson(L.dateKey, L.time) : false
}

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

type ScheduleLessonCardProps = {
  lesson: ScheduledLesson
  selected: boolean
  movable: boolean
  isPast: boolean
  onSelect: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function ScheduleLessonCard({
  lesson,
  selected,
  movable,
  isPast,
  onSelect,
  onDragStart,
  onDragEnd
}: ScheduleLessonCardProps) {
  const ignoreClick = useRef(false)

  return (
    <div
      role="button"
      tabIndex={movable ? 0 : -1}
      draggable={movable}
      aria-disabled={!movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={() => {
        ignoreClick.current = true
        onDragEnd()
        window.setTimeout(() => {
          ignoreClick.current = false
        }, 0)
      }}
      onClick={(e) => {
        e.preventDefault()
        if (ignoreClick.current || !movable) return
        onSelect()
      }}
      onKeyDown={(e) => {
        if (!movable) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "ds-schedule-slot min-w-0 ds-schedule-slot--lesson",
        movable && "cursor-grab active:cursor-grabbing",
        !movable && "cursor-not-allowed opacity-[0.56] grayscale-[0.42]",
        selected && movable && "ring-2 ring-ds-sage ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] opacity-80">
            {isPast ? "Прошло" : "Онлайн-урок"}
          </div>
          <div className="text-[13px] font-semibold leading-snug sm:text-[12px]">{lesson.title}</div>
          <div className="text-[11px] opacity-80">{lesson.time}</div>
          <div className="mt-0.5 text-[11px] text-ds-text-secondary">
            {lesson.teacher ?? SCHEDULE_DEFAULT_TEACHER}
          </div>
        </div>
        {movable ? <GripVertical className="mt-0.5 h-4 w-4 shrink-0 opacity-35" aria-hidden /> : null}
      </div>
      <p className="mt-2 border-t border-black/[0.08] pt-2 text-[10px] leading-snug text-ds-text-tertiary dark:border-white/10">
        {isPast
          ? "Занятие уже прошло — перенос недоступен."
          : movable
            ? "Перетащите на другой слот или нажмите слот ниже."
            : "Перенос недоступен: до начала меньше 24 часов."}
      </p>
    </div>
  )
}

type EmptySlotProps = {
  dateKey: string
  time: string
  /** Режим «выбрали урок — жмём слот» */
  tapSelectActive: boolean
  /** Идёт перетаскивание: слот подходит под правило 24 ч + 7 дней */
  dragActive: boolean
  /** Курсор с перетаскиваемым уроком над этим слотом */
  isDragHoverTarget: boolean
  onDragHoverSlot: (dateKey: string, time: string) => void
  onDropLesson: (lessonId: string) => void
  onClickPick: () => void
}

function EmptySlot({
  dateKey,
  time,
  tapSelectActive,
  dragActive,
  isDragHoverTarget,
  onDragHoverSlot,
  onDropLesson,
  onClickPick
}: EmptySlotProps) {
  return (
    <button
      type="button"
      data-date-key={dateKey}
      data-time={time}
      onClick={onClickPick}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        onDragHoverSlot(dateKey, time)
      }}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain")
        if (id) onDropLesson(id)
      }}
      className={cn(
        "ds-schedule-empty flex min-h-[52px] w-full flex-col items-center justify-center rounded-[var(--ds-radius-md)] px-2 text-center transition-[transform,box-shadow,border-color,background-color] duration-150",
        /* Во время DnD — все свободные слоты заметно зелёные */
        dragActive &&
          !isDragHoverTarget &&
          "border-2 border-dashed border-ds-sage-strong bg-ds-sage/45 dark:border-ds-sage-hover dark:bg-ds-sage/35",
        /* Слот под курсором — сплошная обводка и сильнее заливка */
        dragActive &&
          isDragHoverTarget &&
          "z-[1] scale-[1.02] border-2 border-solid border-ds-sage-strong bg-ds-sage/80 shadow-[0_0_0_3px_color-mix(in_srgb,var(--ds-sage-strong)_38%,transparent)] dark:border-ds-sage-hover dark:bg-ds-sage/55 dark:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ds-sage-hover)_42%,transparent)]",
        /* Тап: выбран урок — подсказка без DnD */
        tapSelectActive &&
          !dragActive &&
          "border-2 border-dashed border-ds-sage-strong bg-ds-sage/25 dark:bg-ds-sage/15"
      )}
    >
      <span
        className={cn(
          "text-[11px] font-medium",
          isDragHoverTarget && dragActive ? "text-ds-ink dark:text-white" : "text-ds-text-tertiary"
        )}
      >
        {time}
      </span>
      <span
        className={cn(
          "text-[10px]",
          isDragHoverTarget && dragActive
            ? "font-medium text-ds-ink/90 dark:text-white/90"
            : "text-ds-text-tertiary/80"
        )}
      >
        {dragActive && isDragHoverTarget ? "Сюда" : "свободно"}
      </span>
    </button>
  )
}

function DayColumn({
  cellDate,
  weekDayIndex,
  isToday,
  lessons,
  selectedLessonId,
  draggingLessonId,
  dropHover,
  onSelectLesson,
  onSlotDrop,
  onEmptyClick,
  onDragHoverSlot,
  onDragStart,
  onDragEnd
}: {
  cellDate: Date
  weekDayIndex: number
  isToday: boolean
  lessons: ScheduledLesson[]
  selectedLessonId: string | null
  draggingLessonId: string | null
  dropHover: { dateKey: string; time: string } | null
  onSelectLesson: (id: string) => void
  onSlotDrop: (lessonId: string, dateKey: string, time: string) => void
  onEmptyClick: (dateKey: string, time: string) => void
  onDragHoverSlot: (dateKey: string, time: string) => void
  onDragStart: (e: React.DragEvent, lesson: ScheduledLesson) => void
  onDragEnd: () => void
}) {
  const dateKey = dateKeyFromDate(cellDate)
  const showDropHints = dragHintsActive(lessons, draggingLessonId)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={`ds-schedule-day-head ${isToday ? "ds-schedule-day-head--today" : "ds-schedule-day-head--muted"}`}
      >
        <div className="text-[11px] uppercase">{weekDays[weekDayIndex]}</div>
        <div className={`text-[20px] ${isToday ? "font-bold" : "font-normal"}`}>{cellDate.getDate()}</div>
      </div>

      <div className="flex flex-col gap-2">
        {SCHEDULE_SLOT_TIMES.map((time) => {
          const lesson = findLessonAt(lessons, dateKey, time)
          if (lesson) {
            const movable = canRescheduleLesson(lesson.dateKey, lesson.time)
            const isPast = isLessonPastOrStarted(lesson.dateKey, lesson.time)
            return (
              <ScheduleLessonCard
                key={`${lesson.id}-${time}`}
                lesson={lesson}
                selected={selectedLessonId === lesson.id}
                movable={movable}
                isPast={isPast}
                onSelect={() => onSelectLesson(lesson.id)}
                onDragStart={(e) => {
                  if (!canRescheduleLesson(lesson.dateKey, lesson.time)) {
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
          const slotOk = isValidRescheduleTargetSlot(dateKey, time)
          return (
            <EmptySlot
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
    </div>
  )
}

export default function SchedulePage() {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const [lessons, setLessons] = useState<ScheduledLesson[]>(buildInitialAprilLessons)
  const [storageReady, setStorageReady] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null)
  const [dropHover, setDropHover] = useState<{ dateKey: string; time: string } | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState<PendingReschedule | null>(null)

  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedLessonTitle, setBlockedLessonTitle] = useState("")
  const [blockedKind, setBlockedKind] = useState<"24h" | "window">("24h")

  useEffect(() => {
    const s = readStoredLessons()
    if (s) setLessons(s)
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    writeStoredLessons(lessons)
  }, [lessons, storageReady])

  useEffect(() => {
    if (!storageReady || user?.role !== "student" || !user.id) return
    mirrorStudentLessonsForTeacher(user.id, lessons)
  }, [lessons, storageReady, user])

  const { monday, cells } = useMemo(() => {
    const monday0 = addDays(FIRST_WEEK_MONDAY, weekOffset * 7)
    const cells = weekDays.map((_, i) => addDays(monday0, i))
    return { monday: monday0, cells }
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

      if (!canRescheduleLesson(lesson.dateKey, lesson.time)) {
        setBlockedKind("24h")
        setBlockedLessonTitle(`${lesson.title}, ${formatSlotLabel(lesson.dateKey, lesson.time)}`)
        setBlockedOpen(true)
        setSelectedLessonId(null)
        return
      }

      if (!isValidRescheduleTargetSlot(toDateKey, toTime)) {
        setBlockedKind("window")
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
      if (!lesson || !canRescheduleLesson(lesson.dateKey, lesson.time)) return
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
    e.dataTransfer.setData(DRAG_MIME, lesson.id)
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
    if (!pending) return
    const p = pending
    setLessons((prev) =>
      prev.map((l) => (l.id === p.lessonId ? { ...l, dateKey: p.toDateKey, time: p.toTime } : l))
    )
    if (typeof window !== "undefined" && user?.role === "student" && user.id) {
      pushTeacherFeedItem({
        studentId: user.id,
        studentName: user.name,
        title: "Перенос занятия",
        message: `${user.name}: ${formatSlotLabel(p.fromDateKey, p.fromTime)} → ${formatSlotLabel(p.toDateKey, p.toTime)}`
      })
    }
    setConfirmOpen(false)
    setPending(null)
    setSelectedLessonId(null)
    toast({
      title: "Занятие перенесено",
      description: "Новое время сохранено в расписании (демо, только на этом устройстве)."
    })
  }, [pending, user])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <div className="mb-6 sm:mb-7">
          <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px] sm:leading-none">
            Расписание
          </h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Недельный календарь (месяцы идут подряд), слоты {SCHEDULE_SLOT_TIMES.join(", ")}. Преподаватель:{" "}
            {SCHEDULE_DEFAULT_TEACHER}. Стартовые уроки в демо — по понедельникам и пятницам в апреле {SCHEDULE_YEAR}.
          </p>
          <p className="mt-1 text-[13px] text-ds-text-tertiary">
            «Сегодня» в расписании — 12 апреля {SCHEDULE_YEAR}, время суток как на вашем устройстве. Прошедшие
            занятия не переносятся. Перетащите урок на другой слот или выберите карточку, затем нажмите свободный
            слот; при перетаскивании подходящие ячейки подсвечиваются зелёным. Перенос: только если до начала урока
            больше 24 часов, и новое время не позже чем через 7 суток от текущего момента.
          </p>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="min-w-0 px-1 text-center text-[15px] font-semibold leading-tight text-ds-ink sm:text-[16px]">
            {weekTitle}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9"
            aria-label="Следующая неделя"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="hidden gap-3 lg:grid lg:grid-cols-7">
          {cells.map((cellDate, i) => (
            <DayColumn
              key={`w${weekOffset}-d${i}`}
              cellDate={cellDate}
              weekDayIndex={i}
              isToday={isSameDay(cellDate, today)}
              lessons={lessons}
              selectedLessonId={selectedLessonId}
              draggingLessonId={draggingLessonId}
              dropHover={dropHover}
              onSelectLesson={onSelectLesson}
              onSlotDrop={onSlotDrop}
              onEmptyClick={onEmptyClick}
              onDragHoverSlot={onDragHoverSlot}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:hidden">
          {cells.map((cellDate, i) => {
            const dateKey = dateKeyFromDate(cellDate)
            const isToday = isSameDay(cellDate, today)
            const showDropHints = dragHintsActive(lessons, draggingLessonId)

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
                  {SCHEDULE_SLOT_TIMES.map((time) => {
                    const lesson = findLessonAt(lessons, dateKey, time)
                    if (lesson) {
                      const movable = canRescheduleLesson(lesson.dateKey, lesson.time)
                      const isPast = isLessonPastOrStarted(lesson.dateKey, lesson.time)
                      return (
                        <ScheduleLessonCard
                          key={`${lesson.id}-${time}`}
                          lesson={lesson}
                          selected={selectedLessonId === lesson.id}
                          movable={movable}
                          isPast={isPast}
                          onSelect={() => onSelectLesson(lesson.id)}
                          onDragStart={(e) => {
                            if (!canRescheduleLesson(lesson.dateKey, lesson.time)) {
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
                    const slotOk = isValidRescheduleTargetSlot(dateKey, time)
                    return (
                      <EmptySlot
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

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#e8e8e8] pt-6 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#e2e3e8] dark:bg-zinc-600" />
            <span className="text-[13px] text-[var(--ds-text-secondary)]">Онлайн-урок</span>
          </div>
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
            <DialogTitle>Перенести занятие?</DialogTitle>
            <DialogDescription asChild>
              <div className="text-[15px] leading-relaxed text-ds-text-secondary">
                {pending ? (
                  <>
                    <p className="mb-2">Вы переносите урок на новое время:</p>
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
                {blockedKind === "24h" ? (
                  <p>
                    Перенести это занятие нельзя: до его начала осталось меньше 24 часов. Такие изменения
                    согласуются с куратором и преподавателем.
                  </p>
                ) : (
                  <p>
                    Новое время должно быть позже чем через 24 часа от сейчас и не позже чем через 7 суток —
                    выбранный слот в эти рамки не попадает. Уточните другое время или напишите куратору.
                  </p>
                )}
                {blockedLessonTitle ? (
                  <p className="font-medium text-ds-ink dark:text-white">{blockedLessonTitle}</p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" variant="default" onClick={() => setBlockedOpen(false)}>
              Понятно
            </Button>
            <Button type="button" variant="outline" asChild className="w-full sm:w-full">
              <Link href="/messages">Обсудить с куратором и преподавателем</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
