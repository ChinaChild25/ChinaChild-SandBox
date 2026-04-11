"use client"

import { useState } from "react"

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [weekGoal, setWeekGoal] = useState("5 уроков")
  const [timezone, setTimezone] = useState("UTC+8 (Пекин)")

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4">
        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Конфигурация</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-ds-ink">
            Настройки
          </h1>
        </section>

        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-black/60">
              Недельная цель
              <input
                value={weekGoal}
                onChange={(e) => setWeekGoal(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-2xl border border-black/12 bg-white px-4 text-[15px] text-ds-ink focus:outline-none"
              />
            </label>
            <label className="text-sm text-black/60">
              Часовой пояс
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-2xl border border-black/12 bg-white px-4 text-[15px] text-ds-ink focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/8 bg-white px-4 py-3">
            <div>
              <p className="text-[0.98rem] font-medium text-ds-ink">Почтовые уведомления</p>
              <p className="text-xs text-black/50">Напоминания о занятиях и домашних заданиях</p>
            </div>
            <button
              type="button"
              onClick={() => setEmailNotifications((prev) => !prev)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                emailNotifications ? "bg-ds-ink text-white" : "bg-black/8 text-black/55"
              }`}
            >
              {emailNotifications ? "Включено" : "Выключено"}
            </button>
          </div>

          <button
            type="button"
            className="mt-5 rounded-2xl bg-ds-ink px-5 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Сохранить настройки
          </button>
        </section>
      </div>
    </div>
  )
}
