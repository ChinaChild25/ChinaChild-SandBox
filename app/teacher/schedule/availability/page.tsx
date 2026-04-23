"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Ban, Clipboard, ClipboardPaste, Copy, Plus, Trash2 } from "lucide-react"
import {
  emptyWeeklyTemplate,
  normalizeIntervals,
  type AvailabilityInterval,
  type WeekdayKey,
  type WeeklyTemplate
} from "@/lib/teacher-availability-template"

const DAYS: Array<{ key: WeekdayKey; label: string }> = [
  { key: "monday", label: "Пн" },
  { key: "tuesday", label: "Вт" },
  { key: "wednesday", label: "Ср" },
  { key: "thursday", label: "Чт" },
  { key: "friday", label: "Пт" },
  { key: "saturday", label: "Сб" },
  { key: "sunday", label: "Вс" }
]

export default function AvailabilitySettingsPage() {
  const [template, setTemplate] = useState<WeeklyTemplate>(emptyWeeklyTemplate())
  const [timezone, setTimezone] = useState("Europe/Moscow")
  const [saving, setSaving] = useState(false)
  const [copiedIntervals, setCopiedIntervals] = useState<AvailabilityInterval[] | null>(null)

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/schedule/template")
      if (!res.ok) return
      const payload = (await res.json()) as { template: WeeklyTemplate; timezone: string }
      setTemplate(payload.template ?? emptyWeeklyTemplate())
      setTimezone(payload.timezone ?? "Europe/Moscow")
    }
    void load()
  }, [])

  const addInterval = (day: WeekdayKey) => {
    setTemplate((prev) => ({
      ...prev,
      [day]: normalizeIntervals([...(prev[day] ?? []), { start: "09:00", end: "11:00" }])
    }))
  }

  const setDayUnavailable = (day: WeekdayKey) => {
    setTemplate((prev) => ({ ...prev, [day]: [] }))
  }

  const copyDayToBuffer = (from: WeekdayKey) => {
    const source = template[from] ?? []
    setCopiedIntervals(source.map((i) => ({ ...i })))
  }

  const pasteToDay = (day: WeekdayKey) => {
    if (!copiedIntervals) return
    setTemplate((prev) => ({ ...prev, [day]: copiedIntervals.map((i) => ({ ...i })) }))
  }

  const copyToAllDays = (from: WeekdayKey) => {
    const source = template[from] ?? []
    setTemplate((prev) => {
      const next = { ...prev }
      DAYS.forEach((d) => {
        next[d.key] = source.map((i) => ({ ...i }))
      })
      return next
    })
  }

  const updateInterval = (day: WeekdayKey, idx: number, patch: Partial<AvailabilityInterval>) => {
    setTemplate((prev) => {
      const next = [...prev[day]]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, [day]: normalizeIntervals(next) }
    })
  }

  const deleteInterval = (day: WeekdayKey, idx: number) => {
    setTemplate((prev) => {
      const next = prev[day].filter((_, i) => i !== idx)
      return { ...prev, [day]: next }
    })
  }

  const save = async () => {
    setSaving(true)
    await fetch("/api/schedule/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, timezone })
    })
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[#202124] dark:text-white sm:text-4xl">Настройка доступности</h1>
          <p className="mt-2 text-base text-[#5f6368] dark:text-[#b0b6c0]">
            Добавляйте несколько интервалов в один день, копируйте и вставляйте расписание между днями.
          </p>
        </div>
        <Link href="/teacher/schedule" className="rounded-2xl border border-black/10 px-5 py-2.5 text-base hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10">
          Назад в календарь
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#5f6368] dark:border-white/10 dark:bg-[#1a1d21] dark:text-[#b0b6c0]">
        <Clipboard size={18} />
        {copiedIntervals ? `Скопировано интервалов: ${copiedIntervals.length}` : "Скопируйте день, затем вставьте в нужные дни"}
      </div>

      <div className="space-y-4 rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#1a1d21] sm:p-5">
        {DAYS.map((day) => (
          <div key={day.key} className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xl font-semibold text-[#202124] dark:text-white">{day.label}</div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl p-2.5 hover:bg-black/5"
                  title="Добавить ещё один период для этого дня"
                  onClick={() => addInterval(day.key)}
                >
                  <Plus size={20} />
                </button>
                <button
                  className="rounded-xl p-2.5 hover:bg-black/5"
                  title="Нет свободного времени в этот день"
                  onClick={() => setDayUnavailable(day.key)}
                >
                  <Ban size={20} />
                </button>
                <button
                  className="rounded-xl p-2.5 hover:bg-black/5"
                  title="Скопировать в буфер"
                  onClick={() => copyDayToBuffer(day.key)}
                >
                  <Copy size={20} />
                </button>
                <button
                  className="rounded-xl p-2.5 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Вставить из буфера в этот день"
                  disabled={!copiedIntervals}
                  onClick={() => pasteToDay(day.key)}
                >
                  <ClipboardPaste size={20} />
                </button>
                <button
                  className="rounded-xl p-2.5 hover:bg-black/5"
                  title="Копировать этот шаблон во все дни"
                  onClick={() => copyToAllDays(day.key)}
                >
                  <Clipboard size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {(template[day.key] ?? []).length === 0 ? (
                <div className="rounded-2xl bg-[#f1f3f4] px-4 py-3 text-lg text-[#5f6368] dark:bg-[#23272d] dark:text-[#b0b6c0]">Нельзя запланировать</div>
              ) : (
                template[day.key].map((interval, idx) => (
                  <div key={`${day.key}-${idx}`} className="flex flex-wrap items-center gap-3">
                    <input
                      type="time"
                      className="w-36 rounded-2xl border border-black/10 bg-[#f1f3f4] px-4 py-3 text-xl text-[#202124] dark:border-white/10 dark:bg-[#23272d] dark:text-white sm:w-40"
                      value={interval.start}
                      onChange={(e) => updateInterval(day.key, idx, { start: e.target.value })}
                    />
                    <span className="text-2xl text-[#5f6368] dark:text-[#b0b6c0]">-</span>
                    <input
                      type="time"
                      className="w-36 rounded-2xl border border-black/10 bg-[#f1f3f4] px-4 py-3 text-xl text-[#202124] dark:border-white/10 dark:bg-[#23272d] dark:text-white sm:w-40"
                      value={interval.end}
                      onChange={(e) => updateInterval(day.key, idx, { end: e.target.value })}
                    />
                    <button
                      className="rounded-xl p-2.5 text-[#5f6368] hover:bg-black/5 hover:text-[#202124]"
                      title="Удалить интервал"
                      onClick={() => deleteInterval(day.key, idx)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-2xl border border-black/10 px-4 py-3 text-base dark:border-white/10 dark:bg-[#1a1d21] dark:text-white sm:w-72"
          placeholder="Timezone"
        />
        <button
          className="rounded-2xl border border-black/10 bg-black px-6 py-3 text-base text-white hover:bg-black/85 disabled:opacity-60 dark:bg-white dark:text-black"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  )
}
