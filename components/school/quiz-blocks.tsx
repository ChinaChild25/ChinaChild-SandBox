"use client"

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import type { GamesData } from "@/lib/courses/types"

type Props = {
  games: GamesData
  /** HSK lesson game tab: только интерактивные пары в макете из макета. */
  variant?: "default" | "hsk"
}

type RightSlot = { pairIndex: number; text: string }

function shuffleSlots(pairs: GamesData["wordPairs"]): RightSlot[] {
  const slots: RightSlot[] = pairs.map((p, pairIndex) => ({ pairIndex, text: p.right }))
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j]!, slots[i]!]
  }
  return slots
}

function WordPairsMatch({ pairs }: { pairs: GamesData["wordPairs"] }) {
  const [rightSlots, setRightSlots] = useState<RightSlot[]>([])
  const [leftPick, setLeftPick] = useState<number | null>(null)
  const [rightPick, setRightPick] = useState<number | null>(null)
  const [matched, setMatched] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    setRightSlots(shuffleSlots(pairs))
    setLeftPick(null)
    setRightPick(null)
    setMatched(new Set())
  }, [pairs])

  const tryPair = (l: number | null, r: number | null) => {
    if (l === null || r === null) return
    if (l === r) {
      setMatched((prev) => new Set(prev).add(l))
    }
    setLeftPick(null)
    setRightPick(null)
  }

  const onLeft = (pairIndex: number) => {
    if (matched.has(pairIndex)) return
    if (leftPick === pairIndex) {
      setLeftPick(null)
      return
    }
    if (leftPick === null) {
      setLeftPick(pairIndex)
      if (rightPick !== null) tryPair(pairIndex, rightPick)
      return
    }
    setLeftPick(pairIndex)
    if (rightPick !== null) tryPair(pairIndex, rightPick)
  }

  const onRight = (pairIndex: number) => {
    if (matched.has(pairIndex)) return
    if (rightPick === pairIndex) {
      setRightPick(null)
      return
    }
    if (rightPick === null) {
      setRightPick(pairIndex)
      if (leftPick !== null) tryPair(leftPick, pairIndex)
      return
    }
    setRightPick(pairIndex)
    if (leftPick !== null) tryPair(leftPick, pairIndex)
  }

  if (rightSlots.length === 0) return null

  return (
    <div className="cc-hsk-pairs-board">
      <div className="cc-hsk-pairs-col">
        {pairs.map((p, i) => {
          const isMatched = matched.has(i)
          const isSel = leftPick === i
          return (
            <button
              key={`L-${i}`}
              type="button"
              disabled={isMatched}
              className={cn(
                "cc-hsk-pair-pill",
                isMatched && "cc-hsk-pair-pill--matched",
                isSel && !isMatched && "cc-hsk-pair-pill--sel",
              )}
              onClick={() => onLeft(i)}
            >
              {p.left.replace(/\s*\([^)]*\)\s*$/, "").trim() || p.left}
            </button>
          )
        })}
      </div>
      <div className="cc-hsk-pairs-col">
        {rightSlots.map((slot, idx) => {
          const isMatched = matched.has(slot.pairIndex)
          const isSel = rightPick === slot.pairIndex
          return (
            <button
              key={`R-${idx}-${slot.pairIndex}`}
              type="button"
              disabled={isMatched}
              className={cn(
                "cc-hsk-pair-pill",
                isMatched && "cc-hsk-pair-pill--matched",
                isSel && !isMatched && "cc-hsk-pair-pill--sel",
              )}
              onClick={() => onRight(slot.pairIndex)}
            >
              {slot.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function QuizBlocks({ games, variant = "default" }: Props) {
  const [toneIx, setToneIx] = useState(0)
  const [tonePick, setTonePick] = useState<string | null>(null)
  const [sylIx, setSylIx] = useState(0)
  const [sylPick, setSylPick] = useState<string | null>(null)

  const tq = games.toneQuiz[toneIx]
  const sq = games.syllableQuiz[sylIx]

  const hskPairs = useMemo(() => (variant === "hsk" && games.wordPairs.length > 0 ? games.wordPairs : null), [games.wordPairs, variant])

  if (hskPairs) {
    return (
      <div className="min-w-0">
        <WordPairsMatch pairs={hskPairs} />
      </div>
    )
  }

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
