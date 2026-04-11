"use client"

import { SendHorizontal } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const dialogs = [
  { id: "1", name: "Ли Мэй", last: "Проверьте домашнее задание к четвергу", unread: true },
  { id: "2", name: "Ван Цзюнь", last: "Отлично поработали на разговорном клубе", unread: false }
] as const

const threadById: Record<string, { preview: string; time: string }> = {
  "1": {
    preview: "Добрый день! Напоминаю, что в пятницу будет мини-тест по теме «Время».",
    time: "10:24"
  },
  "2": {
    preview: "Спасибо за активность на клубе — продолжим в следующий вторник.",
    time: "Вчера"
  }
}

export default function MessagesPage() {
  const [text, setText] = useState("")
  const [activeId, setActiveId] = useState<string>(dialogs[0].id)
  const thread = threadById[activeId] ?? threadById["1"]
  const activeName = dialogs.find((d) => d.id === activeId)?.name ?? dialogs[0].name

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4">
        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Коммуникация</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-ds-ink">
            Сообщения
          </h1>
        </section>

        <div className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
          <section className="ek-surface bg-ds-panel-muted p-4">
            <ul className="space-y-2" role="list">
              {dialogs.map((dialog) => {
                const selected = dialog.id === activeId
                return (
                  <li key={dialog.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(dialog.id)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/20",
                        selected
                          ? "border-ds-ink bg-white shadow-sm"
                          : "border-black/8 bg-white hover:bg-black/[0.03]"
                      )}
                    >
                      <p className="text-base font-semibold tracking-[-0.02em] text-ds-ink">{dialog.name}</p>
                      <p className="mt-1 text-sm text-black/55">{dialog.last}</p>
                      {dialog.unread ? (
                        <span className="mt-2 inline-flex rounded-full bg-ds-sage px-2 py-0.5 text-xs text-ds-ink">
                          Новое
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="ek-surface bg-ds-panel-muted px-6 py-5">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-black/55">{activeName}</p>
              <p className="mt-2 rounded-2xl bg-ds-surface-pill px-3 py-2 text-sm text-ds-ink">{thread.preview}</p>
              <p className="mt-2 text-right text-xs text-black/45">{thread.time}</p>
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Введите сообщение..."
                className="h-11 flex-1 rounded-2xl border border-black/12 bg-white px-4 text-sm placeholder:text-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/15"
              />
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-content-center rounded-2xl bg-ds-ink text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/30"
                aria-label="Отправить"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
