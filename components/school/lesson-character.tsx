"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import type { CharacterLesson } from "@/lib/courses/types"

type Props = {
  character: CharacterLesson
}

/** «妈» — основной знак урока в данных курса */
const PRACTICE_CHAR = "妈"

export function LessonCharacter({ character }: Props) {
  const [activeIx, setActiveIx] = useState(0)
  const stroke = character.strokes[activeIx]

  const soloPath = useMemo(() => {
    if (!stroke) return null
    return <path d={stroke.path} fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
  }, [stroke])

  if (!stroke) return null

  return (
    <div className="cc-hsk-writing">
      <div className="cc-hsk-writing-grid">
        <div className="cc-hsk-writing-left">
          <p className="cc-hsk-writing-col-title">{character.strokes.length} базовых черт</p>
          <ul className="cc-hsk-stroke-list">
            {character.strokes.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={cn("cc-hsk-stroke-item", i === activeIx && "cc-hsk-stroke-item--active")}
                  onClick={() => setActiveIx(i)}
                >
                  <span className="cc-hsk-stroke-num">{i + 1}.</span>
                  <span className="cc-hsk-stroke-label">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="cc-hsk-writing-demo">
          <p className="cc-hsk-writing-demo-title">{stroke.label}</p>
          <div className="cc-hsk-writing-demo-canvas">
            <svg viewBox="0 0 300 300" className="cc-hsk-writing-demo-svg" aria-hidden>
              {soloPath}
            </svg>
          </div>
          <p className="cc-hsk-writing-demo-hint">Следи за направлением движения кисти</p>
        </div>
      </div>

      <section className="cc-hsk-writing-practice">
        <h3 className="cc-hsk-writing-practice-title">
          Практика: иероглиф {PRACTICE_CHAR} (mā) — «мама»
        </h3>
        <div className="cc-hsk-writing-practice-cells">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn("cc-hsk-writing-cell", i === 0 && "cc-hsk-writing-cell--sample")}
              aria-hidden={i === 0}
            >
              {i === 0 ? <span className="cc-hsk-writing-cell-char">{PRACTICE_CHAR}</span> : null}
            </div>
          ))}
        </div>
        <p className="cc-hsk-writing-practice-note">
          Перепиши иероглиф {PRACTICE_CHAR} в тетрадь 8 раз.
        </p>
      </section>
    </div>
  )
}
