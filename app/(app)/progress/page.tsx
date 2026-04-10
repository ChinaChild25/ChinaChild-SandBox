"use client"

import { useMemo, useState } from "react"
import { BarChart3, Flame, Target } from "lucide-react"

const tabs = ["Неделя", "Месяц", "Квартал"] as const

export default function ProgressPage() {
  const [period, setPeriod] = useState<(typeof tabs)[number]>("Месяц")

  const progressRows = useMemo(
    () => [
      { label: "Лексика", value: period === "Неделя" ? 42 : period === "Месяц" ? 67 : 74 },
      { label: "Аудирование", value: period === "Неделя" ? 38 : period === "Месяц" ? 61 : 69 },
      { label: "Грамматика", value: period === "Неделя" ? 46 : period === "Месяц" ? 72 : 79 },
      { label: "Разговорная практика", value: period === "Неделя" ? 31 : period === "Месяц" ? 58 : 66 }
    ],
    [period]
  )

  return (
    <div className="px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[76.5rem] flex-col gap-4">
        <section className="ek-surface bg-[#ebebeb] px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Успеваемость</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-[#171a23]">
            Прогресс обучения
          </h1>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="ek-surface bg-[#d8ea95] px-6 py-5">
            <p className="inline-flex items-center gap-2 text-sm text-black/58">
              <Target className="h-4 w-4" />
              Выполнение плана
            </p>
            <p className="mt-3 text-5xl leading-none font-semibold tracking-[-0.04em] text-[#171a23]">78%</p>
          </section>
          <section className="ek-surface bg-[#13151f] px-6 py-5 text-white">
            <p className="inline-flex items-center gap-2 text-sm text-white/70">
              <Flame className="h-4 w-4" />
              Серия занятий
            </p>
            <p className="mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">12 дней</p>
          </section>
          <section className="ek-surface bg-[#ebebeb] px-6 py-5">
            <p className="inline-flex items-center gap-2 text-sm text-black/58">
              <BarChart3 className="h-4 w-4" />
              Средний балл
            </p>
            <p className="mt-3 text-5xl leading-none font-semibold tracking-[-0.04em] text-[#171a23]">93/100</p>
          </section>
        </div>

        <section className="ek-surface bg-[#ebebeb] px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.7rem] leading-none font-semibold tracking-[-0.03em] text-[#171a23]">
              Детализация по навыкам
            </h2>
            <div className="inline-flex rounded-full bg-black/5 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPeriod(tab)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    tab === period ? "bg-[#12151d] text-white" : "text-black/60 hover:text-black"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {progressRows.map((row) => (
              <li key={row.label} className="rounded-2xl bg-white px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#171a23]">{row.label}</span>
                  <span className="text-black/55">{row.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-[#12151d]" style={{ width: `${row.value}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
