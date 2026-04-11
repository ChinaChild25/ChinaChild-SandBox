"use client"

import { useMemo, useState } from "react"

import type { DialogueTabDef, DialogueTexts } from "@/lib/courses/types"

type Props = {
  tabs: DialogueTabDef[]
  texts: DialogueTexts
}

export function DialoguePanel({ tabs, texts }: Props) {
  const ordered = useMemo(() => {
    const map = new Map(tabs.map((t) => [t.id, t]))
    return ["text1", "text2", "soundladder", "repeat"]
      .map((id) => map.get(id))
      .filter(Boolean) as DialogueTabDef[]
  }, [tabs])

  const [active, setActive] = useState(ordered[0]?.id ?? "text1")

  const panel = (() => {
    if (active === "text1" || active === "text2") {
      const block = active === "text1" ? texts.text1 : texts.text2
      return (
        <>
          <p className="cc-lesson-subtitle">Теория</p>
          <h3 className="text-lg font-bold tracking-tight">{block.title}</h3>
          <p className="cc-lesson-note mt-2">
            <strong>{block.lead}</strong>
          </p>
          <p className="cc-lesson-note mt-2">{block.body}</p>
        </>
      )
    }
    if (active === "soundladder") {
      const s = texts.soundladder
      return (
        <>
          <p className="cc-lesson-subtitle">Ритм урока</p>
          <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
          <p className="cc-lesson-note mt-2">{s.lead}</p>
          <div className="cc-lesson-grid-2 mt-4">
            {s.items.map((item, i) => (
              <div key={i} className="cc-lesson-pillcard">
                <strong>{item.text}</strong>
                <span>{item.note}</span>
              </div>
            ))}
          </div>
        </>
      )
    }
    if (active === "repeat") {
      const r = texts.repeat
      return (
        <>
          <p className="cc-lesson-subtitle">Громкая практика</p>
          <h3 className="text-lg font-bold tracking-tight">{r.title}</h3>
          <p className="cc-lesson-note mt-2">{r.lead}</p>
          <div className="cc-lesson-grid-2 mt-4">
            {r.items.map((item, i) => (
              <button
                key={i}
                type="button"
                className="cc-lesson-pillcard text-left transition-transform hover:-translate-y-0.5"
              >
                <strong>{item.text}</strong>
                <span>{item.note}</span>
              </button>
            ))}
          </div>
        </>
      )
    }
    return null
  })()

  return (
    <div className="min-w-0">
      <div className="cc-lesson-tabrow" role="tablist" aria-label="Речевая практика">
        {ordered.map((tab) => (
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
      <div className="mt-5 min-w-0">{panel}</div>
    </div>
  )
}
