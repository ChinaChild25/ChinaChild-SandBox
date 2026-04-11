"use client"

import { useState } from "react"

import type { VocabTab } from "@/lib/courses/types"

type Props = {
  tabs: VocabTab[]
}

export function VocabTabs({ tabs }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? "")

  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  if (!current) return null

  return (
    <div className="min-w-0">
      <div className="cc-lesson-tabrow" role="tablist" aria-label="Словарь по разделам">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className="cc-lesson-tab"
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="cc-lesson-grid-2 mt-5" role="tabpanel">
        {current.cards.map((c, i) => (
          <div key={`${current.id}-${i}`} className="cc-lesson-pillcard">
            <strong className="text-xl tracking-tight">{c.hanzi}</strong>
            <span className="block text-[var(--cc-hsk-text)]">{c.pinyin}</span>
            <span>{c.meaning}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
