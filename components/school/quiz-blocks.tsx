"use client"

import { useState } from "react"

import type { GamesData } from "@/lib/courses/types"

type Props = {
  games: GamesData
}

export function QuizBlocks({ games }: Props) {
  const [toneIx, setToneIx] = useState(0)
  const [tonePick, setTonePick] = useState<string | null>(null)
  const [sylIx, setSylIx] = useState(0)
  const [sylPick, setSylPick] = useState<string | null>(null)

  const tq = games.toneQuiz[toneIx]
  const sq = games.syllableQuiz[sylIx]

  return (
    <div className="grid gap-8">
      {tq ? (
        <div>
          <p className="cc-lesson-subtitle">Тоны</p>
          <p className="mt-2 text-[17px] font-semibold">{tq.prompt}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {tq.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className="cc-lesson-quiz-option"
                data-correct={tonePick !== null && opt === tq.correct ? true : undefined}
                data-wrong={tonePick !== null && opt === tonePick && opt !== tq.correct ? true : undefined}
                onClick={() => {
                  setTonePick(opt)
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {tonePick !== null ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="cc-lesson-btn-ghost text-sm" onClick={() => setTonePick(null)}>
                Сбросить
              </button>
              {toneIx < games.toneQuiz.length - 1 ? (
                <button
                  type="button"
                  className="cc-lesson-btn-primary text-sm"
                  onClick={() => {
                    setToneIx((i) => i + 1)
                    setTonePick(null)
                  }}
                >
                  Следующий вопрос
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {sq ? (
        <div>
          <p className="cc-lesson-subtitle">Слог</p>
          <p className="mt-2 text-[17px] font-semibold">{sq.prompt}</p>
          <p className="cc-lesson-note mt-1">
            Инициаль: <strong>{sq.initial}</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sq.finals.map((f) => (
              <button
                key={f}
                type="button"
                className="cc-lesson-quiz-option max-w-[200px]"
                data-correct={sylPick !== null && f === sq.correct ? true : undefined}
                data-wrong={sylPick !== null && f === sylPick && f !== sq.correct ? true : undefined}
                onClick={() => setSylPick(f)}
              >
                {sq.initial}
                {f}
              </button>
            ))}
          </div>
          {sylPick !== null ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="cc-lesson-btn-ghost text-sm" onClick={() => setSylPick(null)}>
                Сбросить
              </button>
              {sylIx < games.syllableQuiz.length - 1 ? (
                <button
                  type="button"
                  className="cc-lesson-btn-primary text-sm"
                  onClick={() => {
                    setSylIx((i) => i + 1)
                    setSylPick(null)
                  }}
                >
                  Следующий вопрос
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {games.wordPairs.length > 0 ? (
        <div>
          <p className="cc-lesson-subtitle">Соответствия</p>
          <div className="cc-lesson-grid-2 mt-3">
            {games.wordPairs.map((p, i) => (
              <div key={i} className="cc-lesson-pillcard flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <strong>{p.left}</strong>
                <span className="text-[var(--cc-hsk-muted)]">→</span>
                <span className="font-medium">{p.right}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
