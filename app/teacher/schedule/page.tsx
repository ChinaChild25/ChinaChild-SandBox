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

export default function TeacherSchedulePage() {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [slots, setSlots] = useState<Record<string, TeacherScheduleStatus>>({})
  const [pending, setPending] = useState<Record<string, TeacherScheduleStatus>>({})

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

  const weekIsoSlots = useMemo(() => days.flatMap((day) => buildHourlyIsoSlots(day)), [days])

  const refresh = async () => {
    const from = new Date(days[0])
    from.setHours(0, 0, 0, 0)
    const to = addDays(from, 7)
    const res = await fetch(`/api/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
    const payload = (await res.json().catch(() => ({}))) as { slots?: Array<{ slot_at: string; status: TeacherScheduleStatus }> }
    const next: Record<string, TeacherScheduleStatus> = {}
    for (const item of payload.slots ?? []) next[item.slot_at] = item.status
    setSlots(next)
    setPending({})
    setReady(true)
  }

  useEffect(() => {
    if (!user || user.role !== "teacher" || days.length === 0) return
    void refresh()
  }, [user, days])

  const displayStatus = (slotIso: string): TeacherScheduleStatus => pending[slotIso] ?? slots[slotIso] ?? "busy"
  const cycleStatus = (current: TeacherScheduleStatus): TeacherScheduleStatus => (current === "free" ? "busy" : "free")

  const setBulk = (status: TeacherScheduleStatus) => {
    const next: Record<string, TeacherScheduleStatus> = {}
    for (const slotIso of weekIsoSlots) {
      const s = displayStatus(slotIso)
      if (s === "booked") continue
      next[slotIso] = status
    }
    setPending((prev) => ({ ...prev, ...next }))
  }

  const copyDayToWeekdays = (sourceDayIndex: number) => {
    const sourceDay = days[sourceDayIndex]
    if (!sourceDay) return
    const sourceSlots = buildHourlyIsoSlots(sourceDay)
    const sourceStatus = sourceSlots.map((slotIso) => displayStatus(slotIso))
    const next: Record<string, TeacherScheduleStatus> = {}
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      const daySlots = buildHourlyIsoSlots(days[dayIdx])
      daySlots.forEach((slotIso, hourIdx) => {
        if (displayStatus(slotIso) === "booked") return
        const status = sourceStatus[hourIdx]
        if (status === "booked") return
        next[slotIso] = status
      })
    }
    setPending((prev) => ({ ...prev, ...next }))
  }

  const saveBulk = async () => {
    const items = Object.entries(pending)
      .filter(([, status]) => status === "free" || status === "busy")
      .map(([slot_at, status]) => ({ slot_at, status }))
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
          Сетка 7 × 24 (каждый слот = 1 час). Переключайте статус слотов: <b>free</b> или <b>busy</b>. Слоты
          со статусом <b>booked</b> блокируются от ручного изменения.
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
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={() => setBulk("free")}>
            Вся неделя free
          </button>
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={() => setBulk("busy")}>
            Вся неделя busy
          </button>
          <button
            type="button"
            className="ds-neutral-pill px-3 py-1.5 text-[12px]"
            onClick={() => copyDayToWeekdays(0)}
          >
            Пн → будни
          </button>
          <button
            type="button"
            className="rounded-full bg-ds-sage px-3 py-1.5 text-[12px] font-semibold text-ds-ink disabled:opacity-60"
            disabled={saving || Object.keys(pending).length === 0}
            onClick={() => void saveBulk()}
          >
            {saving ? "Сохраняем..." : `Сохранить (${Object.keys(pending).length})`}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th className="border border-black/10 bg-[var(--ds-neutral-row)] px-2 py-1 text-left text-[11px] text-ds-text-tertiary">
                  Час
                </th>
                {days.map((day, idx) => (
                  <th
                    key={day.toISOString()}
                    className="border border-black/10 bg-[var(--ds-neutral-row)] px-2 py-1 text-center text-[11px] text-ds-text-tertiary"
                  >
                    {weekDays[idx]} {day.getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEACHER_HOURLY_SLOTS.map((hour, hourIdx) => (
                <tr key={hour}>
                  <td className="border border-black/10 px-2 py-1 text-[11px] text-ds-text-secondary">{hour}</td>
                  {days.map((day) => {
                    const slotIso = buildHourlyIsoSlots(day)[hourIdx]
                    const status = displayStatus(slotIso)
                    const style =
                      status === "free"
                        ? "bg-emerald-100/70 text-emerald-900"
                        : status === "busy"
                          ? "bg-zinc-200/70 text-zinc-700"
                          : "bg-amber-100/80 text-amber-900"
                    return (
                      <td key={slotIso} className="border border-black/10 p-1">
                        <button
                          type="button"
                          disabled={!ready || status === "booked"}
                          onClick={() => {
                            if (status === "booked") return
                            const next = cycleStatus(status)
                            setPending((prev) => ({ ...prev, [slotIso]: next }))
                          }}
                          className={`w-full rounded px-1 py-1 text-[11px] font-semibold ${style} disabled:cursor-not-allowed disabled:opacity-80`}
                        >
                          {status}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
