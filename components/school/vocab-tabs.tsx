"use client"

import { useState } from "react"
import { ArrowRight, Lightbulb } from "lucide-react"

import type { VocabTab } from "@/lib/courses/types"

type Props = {
  tabs: VocabTab[]
  onContinue?: () => void
  continueLabel?: string
}

export function VocabTabs({ tabs, onContinue, continueLabel = "Далее" }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? "")
  const [flipped, setFlipped] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())

  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  if (!current) return null

  const cardKey = (i: number) => `${current.id}:${i}`

  const onFlip = (i: number) => {
    const isFlipped = flipped === i
    const next = isFlipped ? null : i
    setFlipped(next)
    if (!isFlipped) {
      setSeen((prev) => new Set(prev).add(cardKey(i)))
    }
  }

  const openedCount = current.cards.reduce((n, _, i) => n + (seen.has(cardKey(i)) ? 1 : 0), 0)

  return (
    <div className="cc-hsk-vocab min-w-0">
      <div className="cc-hsk-vocab-subtabs" role="tablist" aria-label="Словарь по разделам">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={`cc-hsk-vocab-subtab ${tab.id === active ? "cc-hsk-vocab-subtab--active" : ""}`}
            onClick={() => {
              setActive(tab.id)
              setFlipped(null)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="cc-hsk-vocab-grid"
        role="tabpanel"
      >
        {current.cards.map((c, i) => {
          const isFlipped = flipped === i
          return (
            <button
              key={`${current.id}-${i}`}
              type="button"
              onClick={() => onFlip(i)}
              className={`cc-hsk-vocab-card ${isFlipped ? "cc-hsk-vocab-card--open" : ""}`}
            >
              <div className="cc-hsk-vocab-han">{c.hanzi}</div>
              {isFlipped ? (
                <div className="cc-hsk-vocab-back">
                  <div className="cc-hsk-vocab-pin">{c.pinyin}</div>
                  <div className="cc-hsk-vocab-mean">{c.meaning}</div>
                </div>
              ) : (
                <div className="cc-hsk-vocab-pin-muted">{c.pinyin}</div>
              )}
            </button>
          )
        })}
      </div>

      <aside className="cc-hsk-vocab-tip">
        <div className="cc-hsk-vocab-tip-head">
          <Lightbulb className="cc-hsk-vocab-tip-bulb" aria-hidden />
          <strong>Совет по запоминанию</strong>
        </div>
        <p>
          Повторяй слова вслух сразу после переворота карточки. Произнеси его 3 раза подряд — так мозг запоминает и
          звук, и значение одновременно.
        </p>
      </aside>

      <div className="cc-hsk-vocab-foot">
        <span className="cc-hsk-vocab-opened">
          Открыто: {openedCount}/{current.cards.length}
        </span>
        {onContinue ? (
          <button type="button" className="cc-hsk-btn-next" onClick={onContinue}>
            {continueLabel}
            <ArrowRight className="cc-hsk-btn-next-arrow" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}
