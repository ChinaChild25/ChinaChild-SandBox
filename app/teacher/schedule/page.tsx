"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getAppTodayStart } from "@/lib/app-time"
import {
  addDays,
  buildHourlyIsoSlots,
  startOfWeekMonday,
  TEACHER_HOURLY_SLOTS,
  type TeacherScheduleStatus
} from "@/lib/teacher-schedule"
import { useAuth } from "@/lib/auth-context"

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const
const weekDaysLong = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h)

type Interval = { startHour: number; endHour: number }
type DayPlan = { enabled: boolean; intervals: Interval[] }

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`
}

function normalizeIntervals(intervals: Interval[]): Interval[] {
  const filtered = intervals
    .map((i) => ({
      startHour: Math.max(0, Math.min(23, i.startHour)),
      endHour: Math.max(1, Math.min(24, i.endHour))
    }))
    .filter((i) => i.endHour > i.startHour)
    .sort((a, b) => a.startHour - b.startHour)

  const merged: Interval[] = []
  for (const cur of filtered) {
    const prev = merged[merged.length - 1]
    if (!prev || cur.startHour > prev.endHour) {
      merged.push(cur)
      continue
    }
    prev.endHour = Math.max(prev.endHour, cur.endHour)
  }
  return merged
}

function freeHoursFromIntervals(intervals: Interval[]): Set<number> {
  const free = new Set<number>()
  for (const i of normalizeIntervals(intervals)) {
    for (let h = i.startHour; h < i.endHour; h++) free.add(h)
  }
  return free
}

function intervalsFromDayStatuses(statuses: TeacherScheduleStatus[]): Interval[] {
  const out: Interval[] = []
  let start: number | null = null
  for (let h = 0; h < 24; h++) {
    const isFree = statuses[h] === "free"
    if (isFree && start === null) start = h
    if ((!isFree || h === 23) && start !== null) {
      const end = isFree && h === 23 ? 24 : h
      out.push({ startHour: start, endHour: end })
      start = null
    }
  }
  return normalizeIntervals(out)
}

export default function TeacherSchedulePage() {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverSlots, setServerSlots] = useState<Record<string, TeacherScheduleStatus>>({})
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>(Array.from({ length: 7 }, () => ({ enabled: false, intervals: [] })))
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [showNonCoreHours, setShowNonCoreHours] = useState(false)

  useEffect(() => {
    const now = getAppTodayStart()
    const monday = startOfWeekMonday(now)
    const baseline = startOfWeekMonday(new Date(now.getFullYear(), 3, 1))
    const diff = Math.round((monday.getTime() - baseline.getTime()) / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diff)
  }, [])

  const monday = useMemo(() => addDays(startOfWeekMonday(new Date(2026, 3, 1)), weekOffset * 7), [weekOffset])
  const days = useMemo(() => weekDays.map((_, i) => addDays(monday, i)), [monday])

  const weekTitle = useMemo(() => {
    const sunday = addDays(monday, 6)
    const left = monday.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    const right = sunday.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
    return `${left} — ${right}`
  }, [monday])

  const refresh = async () => {
    const from = new Date(days[0])
    from.setHours(0, 0, 0, 0)
    const to = addDays(from, 7)
    const res = await fetch(`/api/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
    const payload = (await res.json().catch(() => ({}))) as { slots?: Array<{ slot_at: string; status: TeacherScheduleStatus }> }
    const nextMap: Record<string, TeacherScheduleStatus> = {}
    for (const item of payload.slots ?? []) nextMap[item.slot_at] = item.status
    setServerSlots(nextMap)

    const nextWeekPlan: DayPlan[] = days.map((day) => {
      const dayStatuses = buildHourlyIsoSlots(day).map((iso) => nextMap[iso] ?? "busy")
      const intervals = intervalsFromDayStatuses(dayStatuses)
      return { enabled: intervals.length > 0, intervals }
    })
    setWeekPlan(nextWeekPlan)
    setReady(true)
  }

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "curator") || days.length === 0) return
    void refresh()
  }, [user, days])

  const selectedDay = weekPlan[selectedDayIndex] ?? { enabled: false, intervals: [] }

  const setDayPlan = (dayIndex: number, updater: (prev: DayPlan) => DayPlan) => {
    setWeekPlan((prev) => prev.map((day, idx) => (idx === dayIndex ? updater(day) : day)))
  }

  const copyDayPlan = (sourceDayIndex: number, targetIndexes: number[]) => {
    const src = weekPlan[sourceDayIndex]
    if (!src) return
    setWeekPlan((prev) =>
      prev.map((day, idx) =>
        targetIndexes.includes(idx)
          ? { enabled: src.enabled, intervals: src.intervals.map((i) => ({ ...i })) }
          : day
      )
    )
  }

  const setWholeWeek = (status: "free" | "busy") => {
    if (status === "free") {
      setWeekPlan(Array.from({ length: 7 }, () => ({ enabled: true, intervals: [{ startHour: 0, endHour: 24 }] })))
      return
    }
    setWeekPlan(Array.from({ length: 7 }, () => ({ enabled: false, intervals: [] })))
  }

  const addIntervalToSelectedDay = () => {
    setDayPlan(selectedDayIndex, (day) => {
      const base = day.enabled ? day.intervals : []
      const last = normalizeIntervals(base).at(-1)
      const candidate: Interval = last ? { startHour: Math.min(23, last.endHour), endHour: Math.min(24, last.endHour + 1) } : { startHour: 8, endHour: 12 }
      return {
        enabled: true,
        intervals: normalizeIntervals([...base, candidate])
      }
    })
  }

  const saveBulk = async () => {
    const items: Array<{ slot_at: string; status: "free" | "busy" }> = []
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const plan = weekPlan[dayIdx] ?? { enabled: false, intervals: [] }
      const freeHours = plan.enabled ? freeHoursFromIntervals(plan.intervals) : new Set<number>()
      const slotIsos = buildHourlyIsoSlots(days[dayIdx])
      for (let h = 0; h < 24; h++) {
        const slot_at = slotIsos[h]
        const serverStatus = serverSlots[slot_at] ?? "busy"
        if (serverStatus === "booked") continue
        const status: "free" | "busy" = freeHours.has(h) ? "free" : "busy"
        if (serverStatus !== status) items.push({ slot_at, status })
      }
    }

    if (items.length === 0) return
    setSaving(true)
    const res = await fetch("/api/schedule/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: items })
    })
    setSaving(false)
    if (!res.ok) return
    await refresh()
  }

  const hasChanges = useMemo(() => {
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const plan = weekPlan[dayIdx] ?? { enabled: false, intervals: [] }
      const freeHours = plan.enabled ? freeHoursFromIntervals(plan.intervals) : new Set<number>()
      const slotIsos = buildHourlyIsoSlots(days[dayIdx])
      for (let h = 0; h < 24; h++) {
        const iso = slotIsos[h]
        const serverStatus = serverSlots[iso] ?? "busy"
        if (serverStatus === "booked") continue
        const target = freeHours.has(h) ? "free" : "busy"
        if (serverStatus !== target) return true
      }
    }
    return false
  }, [days, weekPlan, serverSlots])

  const selectedDaySlots = useMemo(() => {
    const slotIsos = buildHourlyIsoSlots(days[selectedDayIndex] ?? new Date())
    const freeHours = selectedDay.enabled ? freeHoursFromIntervals(selectedDay.intervals) : new Set<number>()
    return TEACHER_HOURLY_SLOTS.map((label, hour) => {
      const iso = slotIsos[hour]
      const serverStatus = serverSlots[iso] ?? "busy"
      const status: TeacherScheduleStatus = serverStatus === "booked" ? "booked" : freeHours.has(hour) ? "free" : "busy"
      return { hour, label, status }
    })
  }, [days, selectedDayIndex, selectedDay, serverSlots])

  const summaryForDay = (day: DayPlan): string => {
    if (!day.enabled || day.intervals.length === 0) return "Выходной"
    return day.intervals.map((i) => `${formatHour(i.startHour)}–${formatHour(i.endHour)}`).join(", ")
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <nav className="mb-4 text-[14px] text-ds-text-tertiary">
          <Link href="/teacher/dashboard" className="text-ds-text-secondary no-underline hover:underline">
            Главная
          </Link>
          <span className="mx-1.5">→</span>
          <span className="font-medium text-ds-ink">Расписание</span>
        </nav>

        <h1 className="mb-1 text-[28px] font-bold text-ds-ink sm:text-[34px]">Расписание</h1>
        <p className="mb-6 text-[15px] text-[var(--ds-text-secondary)]">
          Настройте доступные часы для записи учеников. Работайте через интервалы, копируйте между днями и сохраняйте
          изменения одним действием. Забронированные слоты сохраняются и не перезаписываются.
        </p>

        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center text-[15px] font-semibold text-ds-ink">{weekTitle}</div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="ds-neutral-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Следующая неделя"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={() => setWholeWeek("free")}>
            Сделать всю неделю свободной
          </button>
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={() => setWholeWeek("busy")}>
            Сделать всю неделю занятой
          </button>
          <button
            type="button"
            className="ds-neutral-pill px-3 py-1.5 text-[12px]"
            onClick={() => copyDayPlan(selectedDayIndex, [0, 1, 2, 3, 4])}
          >
            Применить к будням
          </button>
          <button
            type="button"
            className="ds-neutral-pill px-3 py-1.5 text-[12px]"
            onClick={() => copyDayPlan(selectedDayIndex, [0, 1, 2, 3, 4, 5, 6])}
          >
            Копировать день на всю неделю
          </button>
          <button
            type="button"
            className="rounded-full bg-ds-sage px-3 py-1.5 text-[12px] font-semibold text-ds-ink disabled:opacity-60"
            disabled={saving || !hasChanges}
            onClick={() => void saveBulk()}
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((day, idx) => {
            const dayPlan = weekPlan[idx] ?? { enabled: false, intervals: [] }
            const active = idx === selectedDayIndex
            return (
              <section
                key={day.toISOString()}
                className={`rounded-[var(--ds-radius-xl)] border p-3 transition ${active ? "border-ds-sage-strong bg-ds-sage/15" : "border-black/10 bg-ds-surface dark:border-white/10"}`}
              >
                <button type="button" className="w-full text-left" onClick={() => setSelectedDayIndex(idx)}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-ds-ink">
                      {weekDays[idx]}, {day.getDate()}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        dayPlan.enabled ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {dayPlan.enabled ? "Рабочий" : "Выходной"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ds-text-secondary">
                    {summaryForDay(dayPlan)}
                  </p>
                </button>
              </section>
            )
          })}
        </div>

        <section className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface p-4 dark:border-white/10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-ds-ink">{weekDaysLong[selectedDayIndex]}</h2>
              <p className="text-[12px] text-ds-text-secondary">Редактирование дня через интервалы</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDayPlan(selectedDayIndex, (d) => ({
                    enabled: !d.enabled,
                    intervals: d.enabled ? [] : d.intervals.length ? d.intervals : [{ startHour: 8, endHour: 20 }]
                  }))
                }
                className="ds-neutral-pill px-3 py-1.5 text-[12px]"
              >
                {selectedDay.enabled ? "Сделать выходным" : "Сделать рабочим"}
              </button>
              <button
                type="button"
                onClick={() => copyDayPlan(selectedDayIndex, [0, 1, 2, 3, 4].filter((i) => i !== selectedDayIndex))}
                className="ds-neutral-pill px-3 py-1.5 text-[12px]"
              >
                Скопировать в будни
              </button>
            </div>
          </div>

          {selectedDay.enabled ? (
            <>
              <div className="space-y-2">
                {selectedDay.intervals.map((interval, idx) => (
                  <div
                    key={`${interval.startHour}-${interval.endHour}-${idx}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 px-2 py-2 dark:border-white/10"
                  >
                    <select
                      value={interval.startHour}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDayPlan(selectedDayIndex, (d) => {
                          const next = [...d.intervals]
                          next[idx] = { ...next[idx], startHour: v, endHour: Math.max(v + 1, next[idx].endHour) }
                          return { ...d, intervals: normalizeIntervals(next) }
                        })
                      }}
                      className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-[13px] dark:border-white/15"
                    >
                      {HOUR_OPTIONS.slice(0, 24).map((h) => (
                        <option key={`s-${h}`} value={h}>
                          {formatHour(h)}
                        </option>
                      ))}
                    </select>
                    <span className="text-[12px] text-ds-text-secondary">—</span>
                    <select
                      value={interval.endHour}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDayPlan(selectedDayIndex, (d) => {
                          const next = [...d.intervals]
                          next[idx] = { ...next[idx], endHour: v, startHour: Math.min(next[idx].startHour, v - 1) }
                          return { ...d, intervals: normalizeIntervals(next) }
                        })
                      }}
                      className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-[13px] dark:border-white/15"
                    >
                      {HOUR_OPTIONS.slice(1).map((h) => (
                        <option key={`e-${h}`} value={h}>
                          {formatHour(h)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ml-auto text-[12px] text-destructive"
                      onClick={() =>
                        setDayPlan(selectedDayIndex, (d) => ({ ...d, intervals: d.intervals.filter((_, i) => i !== idx) }))
                      }
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={addIntervalToSelectedDay}>
                  Добавить интервал
                </button>
                <button
                  type="button"
                  className="ds-neutral-pill px-3 py-1.5 text-[12px]"
                  onClick={() => setDayPlan(selectedDayIndex, (d) => ({ ...d, intervals: [] }))}
                >
                  Очистить день
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-ds-text-secondary">День отмечен как выходной. Ученик не увидит доступных слотов.</p>
          )}

          <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-ds-ink">Детализация почасовых слотов</p>
              <button
                type="button"
                className="text-[12px] text-ds-text-secondary underline underline-offset-2"
                onClick={() => setShowNonCoreHours((x) => !x)}
              >
                {showNonCoreHours ? "Скрыть ранние/поздние часы" : "Показать ранние/поздние часы"}
              </button>
            </div>
            <div className="grid gap-1">
              {selectedDaySlots
                .filter((x) => showNonCoreHours || (x.hour >= 8 && x.hour < 20))
                .map((slot) => {
                  const statusLabel =
                    slot.status === "free" ? "Свободно" : slot.status === "booked" ? "Занято" : "Недоступно"
                  const style =
                    slot.status === "free"
                      ? "bg-emerald-100/60 text-emerald-900"
                      : slot.status === "booked"
                        ? "bg-amber-100/80 text-amber-900"
                        : "bg-zinc-200/60 text-zinc-700"
                  const core = slot.hour >= 8 && slot.hour < 20
                  return (
                    <div
                      key={slot.label}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] ${core ? "bg-ds-sage/15" : "opacity-75"}`}
                    >
                      <span className="text-ds-text-secondary">{slot.label}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${style}`}>{statusLabel}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
