"use client"

import type { CharacterLesson } from "@/lib/courses/types"

type Props = {
  character: CharacterLesson
}

export function LessonCharacter({ character }: Props) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <p className="cc-lesson-subtitle">Базовые черты</p>
        <div className="mt-3 space-y-3">
          {character.strokes.map((s) => (
            <div key={s.id} className="cc-lesson-pillcard">
              <strong>{s.label}</strong>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        <p className="cc-lesson-subtitle">Схема 妈</p>
        <div className="mt-3 overflow-hidden rounded-[var(--cc-radius-lg)] bg-white p-4 shadow-[var(--cc-shadow-card)]">
          <svg viewBox="0 0 300 300" className="h-auto w-full max-w-full" aria-label="Штрихи иероглифа">
            {character.strokes.map((s) => (
              <path
                key={s.id}
                d={s.path}
                fill="none"
                stroke="rgba(23,23,23,0.18)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--cc-hsk-text)]">
          {character.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
