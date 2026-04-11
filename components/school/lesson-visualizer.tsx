"use client"

import { useState } from "react"

import type { VisualizerMode } from "@/lib/courses/types"

type Props = {
  modes: VisualizerMode[]
}

function decorateTone(base: string, tone: string): string {
  const toneNumber = Number(tone)
  if (!toneNumber) return base

  const marks: Record<string, string[]> = {
    a: ["ā", "á", "ǎ", "à"],
    e: ["ē", "é", "ě", "è"],
    i: ["ī", "í", "ǐ", "ì"],
    o: ["ō", "ó", "ǒ", "ò"],
    u: ["ū", "ú", "ǔ", "ù"],
    ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  }

  let index = base.indexOf("a")
  if (index === -1) index = base.indexOf("e")
  if (index === -1 && base.includes("ou")) index = base.indexOf("o")
  if (index === -1) {
    const vowels = ["a", "e", "i", "o", "u", "ü"]
    for (let i = base.length - 1; i >= 0; i -= 1) {
      if (vowels.includes(base.charAt(i))) {
        index = i
        break
      }
    }
  }

  if (index === -1) return base
  const letter = base.charAt(index)
  const list = marks[letter]
  const toned = list ? list[toneNumber - 1] : letter
  return base.slice(0, index) + toned + base.slice(index + 1)
}

export function LessonVisualizer({ modes }: Props) {
  const [active, setActive] = useState(modes[0]?.id ?? "system")
  const [initial, setInitial] = useState("m")
  const [final, setFinal] = useState("a")
  const [tone, setTone] = useState("1")

  const base = initial + final

  const panel = (() => {
    if (active === "system") {
      return (
        <>
          <p className="cc-lesson-subtitle">Строение слога</p>
          <h3 className="text-lg font-bold tracking-tight">Инициаль + финаль + тон</h3>
          <p className="cc-lesson-note mt-2">
            Смысл пиньиня в том, что звук и тон не живут отдельно. Мы сначала собираем базу слога, а потом добавляем
            мелодию, которая меняет значение.
          </p>
          <div className="cc-lesson-grid-2 mt-4">
            <div className="cc-lesson-pillcard">
              <strong>b / m / f</strong>
              <span>Инициаль задаёт старт и способ начала звука.</span>
            </div>
            <div className="cc-lesson-pillcard">
              <strong>a / o / i / u</strong>
              <span>Финаль даёт гласную основу и “тело” слога.</span>
            </div>
            <div className="cc-lesson-pillcard">
              <strong>1–4 тон</strong>
              <span>Тон — это мелодия слова, а не украшение сверху.</span>
            </div>
          </div>
        </>
      )
    }
    if (active === "tones") {
      return (
        <>
          <p className="cc-lesson-subtitle">Тоны</p>
          <h3 className="text-lg font-bold tracking-tight">Увидеть мелодию глазами</h3>
          <p className="cc-lesson-note mt-2">
            Здесь каждый тон живёт в своей отдельной карточке. Так он читается чище и не ломает сетку по ширине на
            разных экранах.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                label: "1 тон",
                ex: "mā",
                path: "M18 30 H142",
                stroke: "#1a1a1a",
              },
              {
                label: "2 тон",
                ex: "má",
                path: "M26 72 Q80 44 134 18",
                stroke: "#ff7a45",
              },
              {
                label: "3 тон",
                ex: "mǎ",
                path: "M20 30 Q56 82 92 58 Q122 40 140 18",
                stroke: "#3e7bfa",
              },
              {
                label: "4 тон",
                ex: "mà",
                path: "M24 18 Q74 42 136 76",
                stroke: "#5db87c",
              },
              {
                label: "Нейтральный",
                ex: "ma",
                path: "M54 46 H104",
                stroke: "#f0b542",
              },
            ].map((row) => (
              <div key={row.label} className="cc-lesson-pillcard">
                <strong>{row.label}</strong>
                <svg viewBox="0 0 160 92" fill="none" className="my-2 h-16 w-full max-w-[160px]" aria-hidden>
                  <path d={row.path} stroke={row.stroke} strokeWidth="8" strokeLinecap="round" />
                </svg>
                <span>Высота и форма: {row.ex}</span>
              </div>
            ))}
          </div>
        </>
      )
    }
    if (active === "builder") {
      const t = decorateTone(base, tone)
      return (
        <>
          <p className="cc-lesson-subtitle">Конструктор</p>
          <h3 className="text-lg font-bold tracking-tight">Собери слог руками</h3>
          <p className="cc-lesson-note mt-2">
            Выбирай начало, гласную основу и тон. Результат сразу показывается в правильной форме, без странных
            комбинаций.
          </p>
          <div className="mt-4 grid gap-5">
            <div>
              <p className="cc-lesson-subtitle">Инициаль</p>
              <div className="cc-lesson-tabrow">
                {["b", "p", "m", "f"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="cc-lesson-tab"
                    aria-pressed={v === initial}
                    onClick={() => setInitial(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="cc-lesson-subtitle">Финаль</p>
              <div className="cc-lesson-tabrow">
                {["a", "o", "i", "u"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="cc-lesson-tab"
                    aria-pressed={v === final}
                    onClick={() => setFinal(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="cc-lesson-subtitle">Тон</p>
              <div className="cc-lesson-tabrow">
                {["1", "2", "3", "4"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="cc-lesson-tab"
                    aria-pressed={v === tone}
                    onClick={() => setTone(v)}
                  >
                    {v} тон
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[var(--cc-radius-lg)] bg-white p-5 shadow-[var(--cc-shadow-card)]">
              <p className="cc-lesson-subtitle">Результат</p>
              <p className="mt-2 text-[clamp(1.75rem,5vw,2.5rem)] font-bold tracking-tight">{t}</p>
              <p className="cc-lesson-note mt-2">
                База: {base}. Попробуй произнести её несколько раз, сохраняя сам звук и меняя только мелодию.
              </p>
            </div>
          </div>
        </>
      )
    }
    if (active === "articulation") {
      return (
        <>
          <p className="cc-lesson-subtitle">Артикуляция</p>
          <h3 className="text-lg font-bold tracking-tight">Что делает рот при звуке</h3>
          <p className="cc-lesson-note mt-2">
            В первом уроке достаточно разделить основные зоны и почувствовать, чем отличаются губные и более “внутренние”
            звуки.
          </p>
          <div className="cc-lesson-grid-2 mt-4">
            <div className="cc-lesson-pillcard">
              <strong>Губы</strong>
              <span>b, p и m начинаются именно с них.</span>
            </div>
            <div className="cc-lesson-pillcard">
              <strong>Зубы</strong>
              <span>f ощущается на контакте губы и зубов.</span>
            </div>
            <div className="cc-lesson-pillcard">
              <strong>Открытие рта</strong>
              <span>a требует более свободного и открытого положения.</span>
            </div>
            <div className="cc-lesson-pillcard">
              <strong>Округление</strong>
              <span>o и u сильнее ощущаются по форме губ.</span>
            </div>
          </div>
        </>
      )
    }
    return null
  })()

  return (
    <div className="min-w-0">
      <p className="cc-lesson-note mb-4">
        Здесь мы собираем произношение по частям: понимаем структуру слога, видим тоны как отдельные мелодии и руками
        собираем свои первые сочетания без визуальных ошибок и переполнений.
      </p>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="cc-lesson-tabrow lg:flex lg:w-48 lg:flex-col lg:items-stretch" role="tablist">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === active}
              className="cc-lesson-tab lg:w-full"
              onClick={() => setActive(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">{panel}</div>
      </div>
    </div>
  )
}
