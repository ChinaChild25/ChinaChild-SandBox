"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

const typeColors: Record<string, { bg: string; text: string; border?: string }> = {
  lesson: { bg: "var(--ds-ink)", text: "#ffffff" },
  club: { bg: "var(--ds-gray-tile)", text: "var(--ds-ink)", border: "1px solid #cccccc" },
  test: { bg: "var(--ds-pink)", text: "var(--ds-ink)" },
  event: { bg: "var(--ds-sage)", text: "var(--ds-ink)" }
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

  return (
    <div className="ds-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)] px-4 py-8 md:px-8">
        <div className="mb-7">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">Расписание</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Ваше еженедельное расписание занятий
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-sidebar transition-colors hover:bg-ds-sidebar-hover"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="min-w-0 text-center text-[16px] font-semibold text-ds-ink">
            {formatWeekLabel(monday)}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-sidebar transition-colors hover:bg-ds-sidebar-hover"
            aria-label="Следующая неделя"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
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
                  <div
                    key={`${ev.time}-${j}`}
                    className="ds-schedule-slot min-w-0"
                    style={{
                      backgroundColor: typeColors[ev.type].bg,
                      color: typeColors[ev.type].text,
                      border: typeColors[ev.type].border
                    }}
                  >
                    <div className="text-[10px] opacity-70">{typeLabels[ev.type]}</div>
                    <div className="text-[12px] font-semibold leading-snug">{ev.title}</div>
                    <div className="text-[10px] opacity-70">{ev.time}</div>
                  </div>
                ))}

                {events.length === 0 ? <div className="ds-schedule-empty" /> : null}
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 border-t border-ds-sidebar pt-6">
          {Object.entries(typeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: typeColors[key].bg,
                  border: key === "club" ? "1px solid #cccccc" : "none"
                }}
              />
              <span className="text-[13px] text-[var(--ds-text-secondary)]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
