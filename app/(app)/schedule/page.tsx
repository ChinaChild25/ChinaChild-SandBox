"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const

const SCHEDULE_YEAR = 2026
const SCHEDULE_MONTH_APRIL = 3 // 0-based
const LESSON_TIME = "19:00"
const TEACHER_NAME = "Анастасия Пономарева"

const MS_24H = 24 * 60 * 60 * 1000

type EventItem = {
  time: string
  duration: number
  title: string
  type: "lesson"
  teacher?: string
}

const slotClass: Record<EventItem["type"], string> = {
  lesson: "ds-schedule-slot--lesson"
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

function isApril2026(d: Date) {
  return d.getFullYear() === SCHEDULE_YEAR && d.getMonth() === SCHEDULE_MONTH_APRIL
}

/** Уроки Яны: пн и пт в 19:00, только даты в апреле 2026 */
function eventsForDate(cellDate: Date): EventItem[] {
  if (!isApril2026(cellDate)) return []
  const dow = cellDate.getDay()
  if (dow !== 1 && dow !== 5) return []
  return [
    {
      time: LESSON_TIME,
      duration: 1,
      title: "Урок китайского",
      type: "lesson",
      teacher: TEACHER_NAME
    }
  ]
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

function parseLessonStart(cellDate: Date, timeHHMM: string): Date {
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10))
  const d = new Date(cellDate)
  d.setHours(h, m, 0, 0)
  return d
}

/** Перенос разрешён только если до начала занятия строго больше 24 часов */
function canRescheduleLesson(cellDate: Date, timeStr: string): boolean {
  const start = parseLessonStart(cellDate, timeStr)
  return Date.now() < start.getTime() - MS_24H
}

const APRIL_FIRST = new Date(SCHEDULE_YEAR, SCHEDULE_MONTH_APRIL, 1)
const FIRST_WEEK_MONDAY = startOfWeekMonday(APRIL_FIRST)
const LAST_WEEK_MONDAY = startOfWeekMonday(new Date(SCHEDULE_YEAR, SCHEDULE_MONTH_APRIL, 30))
const WEEK_COUNT =
  Math.round((LAST_WEEK_MONDAY.getTime() - FIRST_WEEK_MONDAY.getTime()) / (7 * MS_24H)) + 1

function initialWeekOffset(): number {
  const now = new Date()
  if (now.getFullYear() === SCHEDULE_YEAR && now.getMonth() === SCHEDULE_MONTH_APRIL) {
    const mon = startOfWeekMonday(now)
    const raw = Math.round((mon.getTime() - FIRST_WEEK_MONDAY.getTime()) / (7 * MS_24H))
    return Math.max(0, Math.min(WEEK_COUNT - 1, raw))
  }
  return 0
}

type ScheduleEventCardProps = {
  ev: EventItem
  cellDate: Date
  onReschedule: (cellDate: Date, ev: EventItem) => void
}

function ScheduleEventCard({ ev, cellDate, onReschedule }: ScheduleEventCardProps) {
  const isLesson = ev.type === "lesson"
  const canMove = isLesson && canRescheduleLesson(cellDate, ev.time)

  return (
    <div className={`ds-schedule-slot min-w-0 ${slotClass[ev.type]}`}>
      <div className="text-[10px] opacity-80">Онлайн-урок</div>
      <div className="text-[13px] font-semibold leading-snug sm:text-[12px]">{ev.title}</div>
      <div className="text-[11px] opacity-80">{ev.time}</div>
      {ev.teacher ? <div className="mt-0.5 text-[11px] text-ds-text-secondary">{ev.teacher}</div> : null}
      {isLesson ? (
        <div className="mt-2 border-t border-black/[0.06] pt-2 dark:border-white/10">
          {canMove ? (
            <button
              type="button"
              onClick={() => onReschedule(cellDate, ev)}
              className="text-[11px] font-medium text-ds-ink underline-offset-2 hover:underline dark:text-white"
            >
              Перенести занятие
            </button>
          ) : (
            <p className="text-[10px] leading-snug text-ds-text-tertiary">
              Перенос недоступен: до начала меньше 24 ч
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pending, setPending] = useState<{ cellDate: Date; ev: EventItem } | null>(null)

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

  const openReschedule = useCallback((cellDate: Date, ev: EventItem) => {
    setPending({ cellDate, ev })
    setDialogOpen(true)
  }, [])

  const confirmReschedule = useCallback(() => {
    setDialogOpen(false)
    setPending(null)
    toast({
      title: "Запрос отправлен",
      description: "Куратор свяжется с вами для согласования нового времени."
    })
  }, [])

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <div className="mb-6 sm:mb-7">
          <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px] sm:leading-none">
            Расписание
          </h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Апрель {SCHEDULE_YEAR}: два занятия в неделю — понедельник и пятница, {LESSON_TIME}. Преподаватель:{" "}
            {TEACHER_NAME}.
          </p>
          <p className="mt-1 text-[13px] text-ds-text-tertiary">
            Перенос занятия доступен только если до его начала осталось больше 24 часов.
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
          {cells.map((cellDate, i) => {
            const events = eventsForDate(cellDate)
            const isToday = isSameDay(cellDate, today)

            return (
              <div key={i} className="flex min-w-0 flex-col gap-2">
                <div
                  className={`ds-schedule-day-head ${isToday ? "ds-schedule-day-head--today" : "ds-schedule-day-head--muted"}`}
                >
                  <div className="text-[11px] uppercase">{weekDays[i]}</div>
                  <div className={`text-[20px] ${isToday ? "font-bold" : "font-normal"}`}>
                    {cellDate.getDate()}
                  </div>
                </div>

                {events.map((ev, j) => (
                  <ScheduleEventCard key={`${ev.time}-${j}`} ev={ev} cellDate={cellDate} onReschedule={openReschedule} />
                ))}

                {events.length === 0 ? <div className="ds-schedule-empty" /> : null}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 lg:hidden">
          {cells.map((cellDate, i) => {
            const events = eventsForDate(cellDate)
            const isToday = isSameDay(cellDate, today)

            return (
              <section
                key={i}
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
                  {events.map((ev, j) => (
                    <ScheduleEventCard key={`${ev.time}-${j}`} ev={ev} cellDate={cellDate} onReschedule={openReschedule} />
                  ))}
                  {events.length === 0 ? (
                    <p className="rounded-[12px] border border-dashed border-black/10 py-6 text-center text-[14px] text-ds-text-tertiary dark:border-white/12">
                      Нет занятий
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#e8e8e8] pt-6 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className={cn("h-3.5 w-3.5 shrink-0 rounded-full", slotClass.lesson)} />
            <span className="text-[13px] text-[var(--ds-text-secondary)]">Онлайн-урок</span>
          </div>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setPending(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Перенос занятия</DialogTitle>
            <DialogDescription>
              {pending
                ? `Отправить запрос на перенос урока ${pending.ev.time} (${pending.cellDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })})?`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={confirmReschedule}>
              Отправить запрос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
