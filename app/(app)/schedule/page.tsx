"use client"

import { CalendarClock, Plus } from "lucide-react"

const events = [
  { time: "09:00", title: "Урок #10", subtitle: "Китайские числительные" },
  { time: "11:00", title: "Разговорный клуб", subtitle: "Диалог по теме семьи" },
  { time: "16:00", title: "Домашняя практика", subtitle: "Закрепление новых слов" }
]

export default function SchedulePage() {
  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4">
        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Планирование</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-ds-ink">
            Расписание
          </h1>
        </section>

        <div className="grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
          <section className="ek-surface bg-ds-panel-muted px-7 py-6">
            <h2 className="text-[1.7rem] leading-none font-semibold tracking-[-0.03em] text-ds-ink">
              Сегодня
            </h2>
            <ul className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.time} className="flex items-center gap-4 rounded-2xl bg-white px-4 py-4">
                  <div className="w-20 rounded-xl bg-ds-ink px-3 py-2 text-center text-sm font-medium text-white">
                    {event.time}
                  </div>
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.02em] text-ds-ink">{event.title}</p>
                    <p className="text-sm text-black/55">{event.subtitle}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="ek-surface bg-ds-panel-muted px-6 py-6">
            <h2 className="text-[1.5rem] leading-none font-semibold tracking-[-0.03em] text-ds-ink">
              Быстрые действия
            </h2>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ds-ink px-4 py-3 text-sm font-medium text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Добавить занятие
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/12 bg-white px-4 py-3 text-sm font-medium text-ds-ink hover:bg-black/[0.03]"
              >
                <CalendarClock className="h-4 w-4" />
                Синхронизировать календарь
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
