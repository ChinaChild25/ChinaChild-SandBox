"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getAppTodayStart } from "@/lib/app-time"
import { useAuth } from "@/lib/auth-context"
import { addDays, buildHourlyIsoSlots, startOfWeekMonday } from "@/lib/teacher-schedule"
import {
  emptyWeeklyTemplate,
  hourlyStatusesToIntervals,
  intervalsToHourlyStatuses,
  normalizeIntervals,
  weekdayFromDate,
  WEEKDAY_KEYS,
  type SlotStatus,
  type WeekdayKey,
  type WeeklyTemplate
} from "@/lib/teacher-availability-template"
import { WeekOverview, WEEK_OVERVIEW_DAYS } from "@/components/schedule/week-overview"
import { DayEditor } from "@/components/schedule/day-editor"
import { CopyScheduleModal } from "@/components/schedule/copy-schedule-modal"

const DAY_LABEL_BY_KEY = new Map(WEEK_OVERVIEW_DAYS.map((d) => [d.key, d.full]))

export default function TeacherSchedulePage() {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState<WeeklyTemplate>(emptyWeeklyTemplate())
  const [serverSlots, setServerSlots] = useState<Record<string, SlotStatus>>({})
  const [timezone, setTimezone] = useState("Europe/Moscow")
  const [selectedDay, setSelectedDay] = useState<WeekdayKey>("monday")
  const [showNonCoreHours, setShowNonCoreHours] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [bookedWarning, setBookedWarning] = useState<string | null>(null)

  useEffect(() => {
    const now = getAppTodayStart()
    const monday = startOfWeekMonday(now)
    const baseline = startOfWeekMonday(new Date(now.getFullYear(), 3, 1))
    const diff = Math.round((monday.getTime() - baseline.getTime()) / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diff)
  }, [])

  const monday = useMemo(() => addDays(startOfWeekMonday(new Date(2026, 3, 1)), weekOffset * 7), [weekOffset])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])

  const weekTitle = useMemo(() => {
    const sunday = addDays(monday, 6)
    const left = monday.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    const right = sunday.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
    return `${left} — ${right}`
  }, [monday])

  const refresh = async () => {
    const tmplRes = await fetch("/api/schedule/template")
    if (tmplRes.ok) {
      const tmplPayload = (await tmplRes.json()) as { template: WeeklyTemplate; timezone: string }
      setTemplate(tmplPayload.template ?? emptyWeeklyTemplate())
      setTimezone(tmplPayload.timezone ?? "Europe/Moscow")
    }

    const from = new Date(days[0])
    from.setHours(0, 0, 0, 0)
    const to = addDays(from, 7)
    const res = await fetch(`/api/schedule/slots?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
    const payload = (await res.json().catch(() => ({}))) as { slots?: Array<{ slot_at: string; status: SlotStatus }> }
    const nextMap: Record<string, SlotStatus> = {}
    for (const item of payload.slots ?? []) nextMap[item.slot_at] = item.status
    setServerSlots(nextMap)
    setReady(true)
  }

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "curator") || days.length === 0) return
    void refresh()
  }, [user, days])

  const setTemplateDay = (day: WeekdayKey, intervals: WeeklyTemplate[WeekdayKey]) => {
    setTemplate((prev) => ({ ...prev, [day]: normalizeIntervals(intervals) }))
  }

  const copyDay = (source: WeekdayKey, targets: WeekdayKey[]) => {
    const srcIntervals = template[source]
    setTemplate((prev) => {
      const next = { ...prev }
      for (const t of targets) next[t] = srcIntervals.map((i) => ({ ...i }))
      return next
    })
  }

  const makeWeekAll = (status: "free" | "busy") => {
    setTemplate(
      status === "free"
        ? {
            monday: [{ start: "00:00", end: "24:00" }],
            tuesday: [{ start: "00:00", end: "24:00" }],
            wednesday: [{ start: "00:00", end: "24:00" }],
            thursday: [{ start: "00:00", end: "24:00" }],
            friday: [{ start: "00:00", end: "24:00" }],
            saturday: [{ start: "00:00", end: "24:00" }],
            sunday: [{ start: "00:00", end: "24:00" }]
          }
        : emptyWeeklyTemplate()
    )
  }

  const saveBulk = async () => {
    const saveTemplateRes = await fetch("/api/schedule/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, timezone })
    })
    if (!saveTemplateRes.ok) return

    const bookedOutside: string[] = []
    const items: Array<{ slot_at: string; status: "free" | "busy" }> = []
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx]
      const weekday = weekdayFromDate(day)
      const statuses = intervalsToHourlyStatuses(template[weekday])
      const slotIsos = buildHourlyIsoSlots(days[dayIdx])
      for (let h = 0; h < 24; h++) {
        const slot_at = slotIsos[h]
        const serverStatus = serverSlots[slot_at] ?? "busy"
        const status: "free" | "busy" = statuses[h] === "free" ? "free" : "busy"
        if (serverStatus === "booked") {
          if (status === "busy") bookedOutside.push(slot_at)
          continue
        }
        if (serverStatus !== status) items.push({ slot_at, status })
      }
    }
    if (bookedOutside.length > 0) {
      setBookedWarning(
        `Вне новой доступности остаются ${bookedOutside.length} забронированных слотов. Они не удалены автоматически. Отмените их вручную при необходимости.`
      )
    } else {
      setBookedWarning(null)
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
      const weekday = weekdayFromDate(days[dayIdx])
      const statuses = intervalsToHourlyStatuses(template[weekday])
      const slotIsos = buildHourlyIsoSlots(days[dayIdx])
      for (let h = 0; h < 24; h++) {
        const iso = slotIsos[h]
        const serverStatus = serverSlots[iso] ?? "busy"
        if (serverStatus === "booked") continue
        const target = statuses[h] === "free" ? "free" : "busy"
        if (serverStatus !== target) return true
      }
    }
    return false
  }, [days, template, serverSlots])

  const selectedDateIndex = WEEKDAY_KEYS.indexOf(selectedDay)
  const selectedDate = days[selectedDateIndex] ?? days[0]
  const bookedHoursForSelectedDay = useMemo(() => {
    const set = new Set<number>()
    const slotIsos = buildHourlyIsoSlots(selectedDate)
    slotIsos.forEach((iso, hour) => {
      if (serverSlots[iso] === "booked") set.add(hour)
    })
    return set
  }, [selectedDate, serverSlots])

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
          Настройте доступные часы для записи учеников через интервалы. Основная рабочая зона выделена с 08:00 до
          20:00. Слоты вне зоны можно раскрыть, а забронированные часы защищены от случайного удаления.
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
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={() => makeWeekAll("free")}>
            Сделать всю неделю свободной
          </button>
          <button type="button" className="ds-neutral-pill px-3 py-1.5 text-[12px]" onClick={() => makeWeekAll("busy")}>
            Сделать всю неделю занятой
          </button>
          <button
            type="button"
            className="ds-neutral-pill px-3 py-1.5 text-[12px]"
            onClick={() => copyDay(selectedDay, ["monday", "tuesday", "wednesday", "thursday", "friday"].filter((d) => d !== selectedDay) as WeekdayKey[])}
          >
            Применить к будням
          </button>
          <button
            type="button"
            className="ds-neutral-pill px-3 py-1.5 text-[12px]"
            onClick={() => setCopyOpen(true)}
          >
            Скопировать расписание
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

        <div className="mb-6">
          <WeekOverview template={template} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </div>

        <DayEditor
          dayLabel={DAY_LABEL_BY_KEY.get(selectedDay) ?? "День"}
          intervals={template[selectedDay]}
          bookedHours={bookedHoursForSelectedDay}
          showNonCoreHours={showNonCoreHours}
          onToggleNonCoreHours={() => setShowNonCoreHours((x) => !x)}
          onSetWorking={(working) =>
            setTemplateDay(
              selectedDay,
              working
                ? template[selectedDay].length
                  ? template[selectedDay]
                  : [{ start: "08:00", end: "20:00" }]
                : []
            )
          }
          onClear={() => setTemplateDay(selectedDay, [])}
          onChangeIntervals={(next) => {
            const daySlots = intervalsToHourlyStatuses(next)
            const conflict = Array.from(bookedHoursForSelectedDay).some((h) => daySlots[h] !== "free")
            if (conflict) {
              setBookedWarning(
                "Внутри изменяемого дня есть забронированные слоты. Они остаются занятыми и не будут удалены автоматически."
              )
            }
            setTemplateDay(selectedDay, next)
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-[13px] text-ds-text-secondary">
            Часовой пояс:
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="ml-2 rounded-md border border-black/10 bg-transparent px-2 py-1 text-[13px] text-ds-ink dark:border-white/15"
              placeholder="Europe/Moscow"
            />
          </label>
          <span className="text-[12px] text-ds-text-tertiary">Время отображается в зоне преподавателя.</span>
        </div>
        {bookedWarning ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            {bookedWarning}
          </div>
        ) : null}
      </div>

      <CopyScheduleModal
        open={copyOpen}
        sourceDay={selectedDay}
        onClose={() => setCopyOpen(false)}
        onApply={(targets) => copyDay(selectedDay, targets)}
      />
    </div>
  )
}
