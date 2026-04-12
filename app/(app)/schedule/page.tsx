"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const

type EventItem = {
  time: string
  duration: number
  title: string
  type: "lesson" | "club" | "test" | "event"
  teacher?: string
}

/** Индекс колонки: 0 = понедельник … 6 = воскресенье (как в Figma Schedule.tsx). */
const scheduleByWeekday: Record<number, EventItem[]> = {
  0: [{ time: "10:00", duration: 1.5, title: "Урок №8", type: "lesson", teacher: "Ли Вэй" }],
  1: [],
  2: [{ time: "16:00", duration: 2, title: "Разговорный клуб", type: "club", teacher: "Чэнь Мэйлин" }],
  3: [],
  4: [
    { time: "9:00", duration: 3, title: "Урок №10", type: "lesson", teacher: "Ли Вэй" },
    { time: "16:00", duration: 2, title: "Разговорный клуб", type: "club", teacher: "Чэнь Мэйлин" }
  ],
  5: [
    { time: "9:00", duration: 1, title: "Тест №2", type: "test", teacher: "Ли Вэй" },
    { time: "11:00", duration: 1, title: "Разговорный клуб", type: "club", teacher: "Чэнь Мэйлин" }
  ],
  6: [{ time: "9:00", duration: 5, title: "Экскурсия в Запретный город", type: "event" }]
}

const slotClass: Record<EventItem["type"], string> = {
  lesson: "ds-schedule-slot--lesson",
  club: "ds-schedule-slot--club",
  test: "ds-schedule-slot--test",
  event: "ds-schedule-slot--event"
}

const typeLabels: Record<string, string> = {
  lesson: "Урок",
  club: "Клуб",
  test: "Тест",
  event: "Событие"
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

/** Подписи недели как в Figmadasboard Schedule.tsx */
function figmaDemoWeekLabel(offset: number) {
  if (offset === 0) return "7 — 13 апреля 2025"
  if (offset === 1) return "14 — 20 апреля 2025"
  if (offset === -1) return "31 мар — 6 апреля 2025"
  return null
}

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

function ScheduleEventCard({ ev }: { ev: EventItem }) {
  return (
    <div className={`ds-schedule-slot min-w-0 ${slotClass[ev.type]}`}>
      <div className="text-[10px] opacity-80">{typeLabels[ev.type]}</div>
      <div className="text-[13px] font-semibold leading-snug sm:text-[12px]">{ev.title}</div>
      <div className="text-[11px] opacity-80">{ev.time}</div>
    </div>
  )
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)

  const { monday, cells } = useMemo(() => {
    const base = startOfWeekMonday(new Date())
    const monday0 = addDays(base, weekOffset * 7)
    const cells = weekDays.map((_, i) => addDays(monday0, i))
    return { monday: monday0, cells }
  }, [weekOffset])

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const weekTitle = figmaDemoWeekLabel(weekOffset) ?? formatWeekLabel(monday)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <div className="mb-6 sm:mb-7">
          <h1 className="text-[28px] font-bold leading-tight text-ds-ink sm:text-[36px] sm:leading-none">
            Расписание
          </h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Ваше еженедельное расписание занятий
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

        {/* Широкий экран: 7 колонок (на планшете — список по дням) */}
        <div className="hidden gap-3 lg:grid lg:grid-cols-7">
          {cells.map((cellDate, i) => {
            const events = weekOffset === 0 ? scheduleByWeekday[i] ?? [] : []
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
                  <ScheduleEventCard key={`${ev.time}-${j}`} ev={ev} />
                ))}

                {events.length === 0 ? <div className="ds-schedule-empty" /> : null}
              </div>
            )
          })}
        </div>

        {/* Узкий экран: карточки по дням */}
        <div className="flex flex-col gap-3 lg:hidden">
          {cells.map((cellDate, i) => {
            const events = weekOffset === 0 ? scheduleByWeekday[i] ?? [] : []
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
                    <ScheduleEventCard key={`${ev.time}-${j}`} ev={ev} />
                  ))}
                  {events.length === 0 ? (
                    <p className="rounded-[12px] border border-dashed border-black/10 py-6 text-center text-[14px] text-ds-text-tertiary dark:border-white/12">
                      Нет событий
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#e8e8e8] pt-6 dark:border-white/10">
          {Object.entries(typeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-3.5 w-3.5 shrink-0 rounded-full",
                  slotClass[key as EventItem["type"]],
                  key === "club" && "box-border border border-black/12 dark:border-white/14"
                )}
              />
              <span className="text-[13px] text-[var(--ds-text-secondary)]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
