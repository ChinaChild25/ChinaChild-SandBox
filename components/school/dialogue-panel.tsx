"use client"

import { useMemo, useState } from "react"
import { Check, Lightbulb, Mic } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DialogueTabDef, DialogueTexts } from "@/lib/courses/types"

type Props = {
  tabs: DialogueTabDef[]
  texts: DialogueTexts
  variant?: "default" | "hsk"
}

export function DialoguePanel({ tabs, texts, variant = "default" }: Props) {
  const ordered = useMemo(() => {
    const map = new Map(tabs.map((t) => [t.id, t]))
    return ["text1", "text2", "soundladder", "repeat"]
      .map((id) => map.get(id))
      .filter(Boolean) as DialogueTabDef[]
  }, [tabs])

  const [active, setActive] = useState(ordered[0]?.id ?? "text1")
  const [spoken, setSpoken] = useState<Record<number, boolean>>({})

  const hsk = variant === "hsk"

  const panel = (() => {
    if (active === "text1" || active === "text2") {
      const block = active === "text1" ? texts.text1 : texts.text2
      return (
        <section className={cn(hsk && "cc-hsk-dialogue-theory")}>
          {!hsk ? <p className="cc-lesson-subtitle">Теория</p> : null}
          <h3 className={hsk ? "cc-hsk-dialogue-theory-title" : "text-lg font-bold tracking-tight"}>{block.title}</h3>
          <p className={cn("cc-lesson-note mt-2", hsk && "cc-hsk-dialogue-theory-lead")}>
            <strong>{block.lead}</strong>
          </p>
          <p className={cn("cc-lesson-note mt-2", hsk && "cc-hsk-dialogue-theory-body")}>{block.body}</p>
        </section>
      )
    }
    if (active === "soundladder") {
      const s = texts.soundladder
      return (
        <>
          {!hsk ? <p className="cc-lesson-subtitle">Ритм урока</p> : null}
          <h3 className={hsk ? "cc-hsk-dialogue-theory-title" : "text-lg font-bold tracking-tight"}>{s.title}</h3>
          <p className="cc-lesson-note mt-2">{s.lead}</p>
          <div className={cn("mt-4 grid gap-3", hsk ? "sm:grid-cols-2" : "cc-lesson-grid-2")}>
            {s.items.map((item, i) => (
              <div key={i} className={cn(hsk ? "cc-hsk-tone-chip" : "cc-lesson-pillcard")}>
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
          {!hsk ? (
            <>
              <p className="cc-lesson-subtitle">Громкая практика</p>
              <h3 className="text-lg font-bold tracking-tight">{r.title}</h3>
              <p className="cc-lesson-note mt-2">{r.lead}</p>
            </>
          ) : (
            <p className="cc-hsk-dialogue-repeat-lead">{r.lead}</p>
          )}
          <div className={cn("mt-4 flex flex-col gap-4", hsk && "cc-hsk-speech-stack")}>
            {r.items.map((item, i) => {
              const done = !!spoken[i]
              if (hsk) {
                return (
                  <div
                    key={i}
                    className={cn("cc-hsk-speech-card", done && "cc-hsk-speech-card--done")}
                  >
                    <div className="cc-hsk-speech-card-main">
                      <p className="cc-hsk-speech-pinyin">{item.text}</p>
                      <p className="cc-hsk-speech-trans">{item.note}</p>
                      <div className="cc-hsk-speech-tip">
                        <Lightbulb className="cc-hsk-speech-tip-icon" aria-hidden />
                        <span>Говори громко, не глотай финаль.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn("cc-hsk-speech-action", done && "cc-hsk-speech-action--done")}
                      aria-pressed={done}
                      aria-label={done ? "Отмечено" : "Отметить как произнесено"}
                      onClick={() => setSpoken((s) => ({ ...s, [i]: !s[i] }))}
                    >
                      {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Mic className="h-5 w-5" strokeWidth={1.75} />}
                    </button>
                  </div>
                )
              }
              return (
                <button
                  key={i}
                  type="button"
                  className="cc-lesson-pillcard text-left transition-transform hover:-translate-y-0.5"
                >
                  <strong>{item.text}</strong>
                  <span>{item.note}</span>
                </button>
              )
            })}
          </div>
        </>
      )
    }
    return null
  })()

  return (
    <div className={cn("min-w-0", hsk && "cc-hsk-dialogue-root")}>
      <div className={cn(hsk ? "cc-hsk-dialogue-tabs" : "cc-lesson-tabrow")} role="tablist" aria-label="Речевая практика">
        {ordered.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                hsk ? "cc-hsk-dialogue-tab" : "cc-lesson-tab",
                hsk && selected && "cc-hsk-dialogue-tab--active",
              )}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="mt-5 min-w-0">{panel}</div>
    </div>
  )
}
