"use client"

import { useMemo, useState } from "react"
import { Award, Target, TrendingUp } from "lucide-react"

const gradesData = [
  { subject: "Тема №1 — Пиньинь, базовые штрихи", date: "15 фев", score: 98, maxScore: 100, type: "ДЗ" },
  { subject: "Тема №2 — Пиньинь, числа", date: "22 фев", score: 91, maxScore: 100, type: "ДЗ" },
  { subject: "Тема №3 — Приветствия", date: "1 мар", score: 100, maxScore: 100, type: "ДЗ" },
  { subject: "Тема №4 — Даты", date: "8 мар", score: 85, maxScore: 100, type: "ДЗ" },
  { subject: "Тема №5 — Возраст", date: "15 мар", score: 95, maxScore: 100, type: "ДЗ" },
  { subject: "Контрольная работа №1", date: "20 мар", score: 88, maxScore: 100, type: "Тест" },
  { subject: "Тема №6 — Телефонные номера", date: "29 мар", score: 92, maxScore: 100, type: "ДЗ" },
  { subject: "Тема №7 — Члены семьи", date: "5 апр", score: 90, maxScore: 100, type: "ДЗ" }
]

function scoreColor(score: number) {
  if (score >= 90) return "var(--ds-sage-strong)"
  if (score >= 75) return "#e6a817"
  return "var(--ds-pink-strong)"
}

export default function ProgressPage() {
  const [filter, setFilter] = useState<"all" | "homework" | "test">("all")

  const filtered = useMemo(
    () =>
      gradesData.filter((g) => {
        if (filter === "homework") return g.type === "ДЗ"
        if (filter === "test") return g.type === "Тест"
        return true
      }),
    [filter]
  )

  const avg = Math.round(gradesData.reduce((s, g) => s + g.score, 0) / gradesData.length)
  const best = Math.max(...gradesData.map((g) => g.score))
  const passed = gradesData.filter((g) => g.score >= 75).length

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <div className="mb-7">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">Мои оценки</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            История оценок и прогресс обучения
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-[24px] bg-ds-sidebar p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ds-surface">
              <TrendingUp size={22} className="text-ds-sage-strong" aria-hidden />
            </div>
            <div>
              <div className="text-[28px] font-bold leading-none text-ds-ink">{avg}</div>
              <div className="text-[13px] text-[var(--ds-text-secondary)]">Средний балл</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-[24px] bg-ds-sage p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/60">
              <Award size={22} className="text-ds-sage-strong" aria-hidden />
            </div>
            <div>
              <div className="text-[28px] font-bold leading-none text-ds-ink">{best}</div>
              <div className="text-[13px] text-ds-text-muted">Лучший результат</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-[24px] bg-ds-ink p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Target size={22} className="text-white" aria-hidden />
            </div>
            <div>
              <div className="text-[28px] font-bold leading-none text-white">
                {passed}/{gradesData.length}
              </div>
              <div className="text-[13px] text-ds-stat-muted-on-dark">Работ сдано</div>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              ["all", "Все"],
              ["homework", "Домашние задания"],
              ["test", "Тесты"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                filter === key
                  ? "bg-ds-ink text-white"
                  : "bg-ds-sidebar text-ds-ink hover:bg-ds-sidebar-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((grade, i) => {
            const col = scoreColor(grade.score)
            return (
              <div
                key={`${grade.subject}-${i}`}
                className="flex items-center gap-4 rounded-2xl bg-ds-surface-muted p-4"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${col}22` }}
                >
                  <span className="text-[16px] font-bold" style={{ color: col }}>
                    {grade.score}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-ds-ink">{grade.subject}</div>
                  <div className="text-[13px] text-ds-text-tertiary">
                    {grade.date} · {grade.type}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-ds-sidebar">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${grade.score}%`, backgroundColor: col }}
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] text-ds-text-tertiary">
                    {grade.score}/{grade.maxScore}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
