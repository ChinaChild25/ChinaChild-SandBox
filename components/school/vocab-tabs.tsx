"use client"

import { useState } from "react"

import type { VocabTab } from "@/lib/courses/types"

type Props = {
  tabs: VocabTab[]
}

export function VocabTabs({ tabs }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? "")
  const [flipped, setFlipped] = useState<number | null>(null)

  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  if (!current) return null

  return (
    <div className="min-w-0">
      <div className="ds-lesson-figma-tabs" role="tablist" aria-label="Словарь по разделам">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={`ds-lesson-figma-tab ${tab.id === active ? "ds-lesson-figma-tab--active" : ""}`}
            onClick={() => {
              setActive(tab.id)
              setFlipped(null)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-[14px] text-ds-text-tertiary">Нажмите на карточку, чтобы увидеть перевод</p>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="tabpanel"
      >
        {current.cards.map((c, i) => {
          const isFlipped = flipped === i
          return (
            <button
              key={`${current.id}-${i}`}
              type="button"
              onClick={() => setFlipped(isFlipped ? null : i)}
              className="min-h-[120px] cursor-pointer rounded-2xl p-5 text-left transition-transform hover:scale-[1.02]"
              style={{
                backgroundColor: isFlipped ? "var(--ds-ink)" : "#f5f5f5",
                color: isFlipped ? "#ffffff" : "var(--ds-ink)"
              }}
            >
              <div className="text-center text-[32px] font-normal">{c.hanzi}</div>
              {isFlipped ? (
                <div className="mt-2 text-center">
                  <div className="text-[13px] text-[#aaaaaa]">{c.pinyin}</div>
                  <div className="text-[15px]">{c.meaning}</div>
                </div>
              ) : (
                <div className="mt-1 text-center text-[13px] text-ds-text-tertiary">{c.pinyin}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
