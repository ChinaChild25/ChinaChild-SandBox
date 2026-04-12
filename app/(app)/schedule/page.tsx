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
import {
  buildInitialAprilLessons,
  canRescheduleLesson,
  findLessonAt,
  isApril2026,
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
const LAST_WEEK_MONDAY = startOfWeekMonday(new Date(SCHEDULE_YEAR, SCHEDULE_MONTH_APRIL, 30))
const MS_7D = 7 * 24 * 60 * 60 * 1000
const WEEK_COUNT =
  Math.round((LAST_WEEK_MONDAY.getTime() - FIRST_WEEK_MONDAY.getTime()) / MS_7D) + 1

function initialWeekOffset(): number {
  const now = new Date()
  if (now.getFullYear() === SCHEDULE_YEAR && now.getMonth() === SCHEDULE_MONTH_APRIL) {
    const mon = startOfWeekMonday(now)
    const raw = Math.round((mon.getTime() - FIRST_WEEK_MONDAY.getTime()) / MS_7D)
    return Math.max(0, Math.min(WEEK_COUNT - 1, raw))
  }
  return 0
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

function formatSlotLabel(day: number, time: string) {
  const d = parseLessonStart(day, time)
  return `${d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })}, ${time}`
}

type PendingReschedule = {
  lessonId: string
  fromDay: number
  fromTime: string
  toDay: number
  toTime: string
}

type ScheduleLessonCardProps = {
  lesson: ScheduledLesson
  selected: boolean
  onSelect: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function ScheduleLessonCard({ lesson, selected, onSelect, onDragStart, onDragEnd }: ScheduleLessonCardProps) {
  const ignoreClick = useRef(false)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => {
        ignoreClick.current = true
        onDragEnd()
        window.setTimeout(() => {
          ignoreClick.current = false
        }, 0)
      }}
      onClick={(e) => {
        e.preventDefault()
        if (ignoreClick.current) return
        onSelect()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        `ds-schedule-slot min-w-0 ds-schedule-slot--lesson cursor-grab active:cursor-grabbing`,
        selected && "ring-2 ring-ds-sage ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] opacity-80">Онлайн-урок</div>
          <div className="text-[13px] font-semibold leading-snug sm:text-[12px]">{lesson.title}</div>
          <div className="text-[11px] opacity-80">{lesson.time}</div>
          {lesson.teacher ? <div className="mt-0.5 text-[11px] text-ds-text-secondary">{lesson.teacher}</div> : null}
        </div>
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 opacity-35" aria-hidden />
      </div>
      <p className="mt-2 border-t border-black/[0.08] pt-2 text-[10px] leading-snug text-ds-text-tertiary dark:border-white/10">
        Перетащите на другой слот или нажмите слот ниже
      </p>
    </div>
  )
}

type EmptySlotProps = {
  day: number
  time: string
  /** Режим «выбрали урок — жмём слот» */
  tapSelectActive: boolean
  /** Идёт перетаскивание с desktop */
  dragActive: boolean
  /** Курсор с перетаскиваемым уроком над этим слотом */
  isDragHoverTarget: boolean
  onDragHoverSlot: (day: number, time: string) => void
  onDropLesson: (lessonId: string) => void
  onClickPick: () => void
}

function EmptySlot({
  day,
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
      data-day={day}
      data-time={time}
      onClick={onClickPick}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        onDragHoverSlot(day, time)
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
  dropHover: { day: number; time: string } | null
  onSelectLesson: (id: string) => void
  onSlotDrop: (lessonId: string, day: number, time: string) => void
  onEmptyClick: (day: number, time: string) => void
  onDragHoverSlot: (day: number, time: string) => void
  onDragStart: (e: React.DragEvent, lesson: ScheduledLesson) => void
  onDragEnd: () => void
}) {
  const inApril = isApril2026(cellDate)
  const dayNum = cellDate.getDate()

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={`ds-schedule-day-head ${isToday ? "ds-schedule-day-head--today" : "ds-schedule-day-head--muted"}`}
      >
        <div className="text-[11px] uppercase">{weekDays[weekDayIndex]}</div>
        <div className={`text-[20px] ${isToday ? "font-bold" : "font-normal"}`}>{cellDate.getDate()}</div>
      </div>

      {!inApril ? (
        <div className="ds-schedule-empty flex min-h-[120px] items-center justify-center text-[12px] text-ds-text-tertiary">
          Вне апреля
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {SCHEDULE_SLOT_TIMES.map((time) => {
            const lesson = findLessonAt(lessons, dayNum, time)
            if (lesson) {
              return (
                <ScheduleLessonCard
                  key={`${lesson.id}-${time}`}
                  lesson={lesson}
                  selected={selectedLessonId === lesson.id}
                  onSelect={() => onSelectLesson(lesson.id)}
                  onDragStart={(e) => onDragStart(e, lesson)}
                  onDragEnd={onDragEnd}
                />
              )
            }
            return (
              <EmptySlot
                key={`${dayNum}-${time}`}
                day={dayNum}
                time={time}
                tapSelectActive={!!selectedLessonId}
                dragActive={!!draggingLessonId}
                isDragHoverTarget={
                  !!draggingLessonId &&
                  dropHover?.day === dayNum &&
                  dropHover?.time === time
                }
                onDragHoverSlot={onDragHoverSlot}
                onDropLesson={(lessonId) => onSlotDrop(lessonId, dayNum, time)}
                onClickPick={() => onEmptyClick(dayNum, time)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const [lessons, setLessons] = useState<ScheduledLesson[]>(buildInitialAprilLessons)
  const [storageReady, setStorageReady] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null)
  const [dropHover, setDropHover] = useState<{ day: number; time: string } | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState<PendingReschedule | null>(null)

  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedLessonTitle, setBlockedLessonTitle] = useState("")

  useEffect(() => {
    const s = readStoredLessons()
    if (s) setLessons(s)
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    writeStoredLessons(lessons)
  }, [lessons, storageReady])

  const { monday, cells } = useMemo(() => {
    const monday0 = addDays(FIRST_WEEK_MONDAY, weekOffset * 7)
    const cells = weekDays.map((_, i) => addDays(monday0, i))
    return { monday: monday0, cells }
  }, [weekOffset])

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const weekTitle = formatWeekLabel(monday)
  const atMin = weekOffset <= 0
  const atMax = weekOffset >= WEEK_COUNT - 1

  const attemptMove = useCallback(
    (lessonId: string, toDay: number, toTime: string) => {
      const lesson = lessons.find((l) => l.id === lessonId)
      if (!lesson) return

      if (lesson.day === toDay && lesson.time === toTime) {
        setSelectedLessonId(null)
        return
      }

      if (!canRescheduleLesson(lesson.day, lesson.time)) {
        setBlockedLessonTitle(`${lesson.title}, ${formatSlotLabel(lesson.day, lesson.time)}`)
        setBlockedOpen(true)
        setSelectedLessonId(null)
        return
      }

      const occupant = findLessonAt(lessons, toDay, toTime)
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
        fromDay: lesson.day,
        fromTime: lesson.time,
        toDay,
        toTime
      })
      setConfirmOpen(true)
    },
    [lessons]
  )

  const onSelectLesson = useCallback((id: string) => {
    setSelectedLessonId((prev) => (prev === id ? null : id))
  }, [])

  const onEmptyClick = useCallback(
    (day: number, time: string) => {
      if (!selectedLessonId) return
      attemptMove(selectedLessonId, day, time)
    },
    [selectedLessonId, attemptMove]
  )

  const onSlotDrop = useCallback(
    (lessonId: string, day: number, time: string) => {
      setDropHover(null)
      attemptMove(lessonId, day, time)
    },
    [attemptMove]
  )

  const onDragHoverSlot = useCallback((day: number, time: string) => {
    setDropHover({ day, time })
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
    setLessons((prev) =>
      prev.map((l) =>
        l.id === pending.lessonId ? { ...l, day: pending.toDay, time: pending.toTime } : l
      )
    )
    setConfirmOpen(false)
    setPending(null)
    setSelectedLessonId(null)
    toast({
      title: "Занятие перенесено",
      description: "Новое время сохранено в расписании (демо, только на этом устройстве)."
    })
  }, [pending])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <div className="mb-6 sm:mb-7">
          <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px] sm:leading-none">
            Расписание
          </h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Апрель {SCHEDULE_YEAR}: занятия в календаре, слоты {SCHEDULE_SLOT_TIMES.join(", ")}. Преподаватель:{" "}
            {SCHEDULE_DEFAULT_TEACHER}.
          </p>
          <p className="mt-1 text-[13px] text-ds-text-tertiary">
            Перетащите урок на другой день и время или выберите карточку, затем нажмите свободный слот. Пока вы
            тянете урок, свободные ячейки подсвечиваются зелёным; под курсором слот выделяется сильнее. Перенос
            возможен только если до начала занятия осталось больше 24 часов.
          </p>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
          <button
            type="button"
            disabled={atMin}
            onClick={() => setWeekOffset((w) => w - 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-35 sm:h-9 sm:w-9"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="min-w-0 px-1 text-center text-[15px] font-semibold leading-tight text-ds-ink sm:text-[16px]">
            {weekTitle}
          </div>
          <button
            type="button"
            disabled={atMax}
            onClick={() => setWeekOffset((w) => w + 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-35 sm:h-9 sm:w-9"
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
            const inApril = isApril2026(cellDate)
            const isToday = isSameDay(cellDate, today)
            const dayNum = cellDate.getDate()

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
                {!inApril ? (
                  <p className="text-center text-[14px] text-ds-text-tertiary">Вне апреля — слотов нет</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {SCHEDULE_SLOT_TIMES.map((time) => {
                      const lesson = findLessonAt(lessons, dayNum, time)
                      if (lesson) {
                        return (
                          <ScheduleLessonCard
                            key={`${lesson.id}-${time}`}
                            lesson={lesson}
                            selected={selectedLessonId === lesson.id}
                            onSelect={() => onSelectLesson(lesson.id)}
                            onDragStart={(e) => onDragStart(e, lesson)}
                            onDragEnd={onDragEnd}
                          />
                        )
                      }
                      return (
                        <EmptySlot
                          key={`${dayNum}-${time}`}
                          day={dayNum}
                          time={time}
                          tapSelectActive={!!selectedLessonId}
                          dragActive={!!draggingLessonId}
                          isDragHoverTarget={
                            !!draggingLessonId &&
                            dropHover?.day === dayNum &&
                            dropHover?.time === time
                          }
                          onDragHoverSlot={onDragHoverSlot}
                          onDropLesson={(lessonId) => onSlotDrop(lessonId, dayNum, time)}
                          onClickPick={() => onEmptyClick(dayNum, time)}
                        />
                      )
                    })}
                  </div>
                )}
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
                      {formatSlotLabel(pending.fromDay, pending.fromTime)}
                    </p>
                    <p className="my-2 text-ds-text-tertiary">→</p>
                    <p className="font-medium text-ds-ink dark:text-white">
                      {formatSlotLabel(pending.toDay, pending.toTime)}
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

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Перенос недоступен</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-[15px] leading-relaxed text-ds-text-secondary">
                <p>
                  Перенести это занятие нельзя: до его начала осталось меньше 24 часов. Такие изменения согласуются
                  с куратором и преподавателем.
                </p>
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
