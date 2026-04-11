"use client"

import { SendHorizontal } from "lucide-react"
import { useState } from "react"

const dialogs = [
  { id: "1", name: "Ли Мэй", last: "Проверьте домашнее задание к четвергу", unread: true },
  { id: "2", name: "Ван Цзюнь", last: "Отлично поработали на разговорном клубе", unread: false }
]

export default function MessagesPage() {
  const [text, setText] = useState("")

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
            <ul className="space-y-2">
              {dialogs.map((dialog) => (
                <li key={dialog.id} className="rounded-2xl border border-black/8 bg-white px-4 py-3">
                  <p className="text-base font-semibold tracking-[-0.02em] text-ds-ink">{dialog.name}</p>
                  <p className="mt-1 text-sm text-black/55">{dialog.last}</p>
                  {dialog.unread ? (
                    <span className="mt-2 inline-flex rounded-full bg-ds-sage px-2 py-0.5 text-xs text-ds-ink">
                      Новое
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="ek-surface bg-ds-panel-muted px-6 py-5">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-black/55">Ли Мэй</p>
              <p className="mt-2 rounded-2xl bg-ds-surface-pill px-3 py-2 text-sm text-ds-ink">
                Добрый день! Напоминаю, что в пятницу будет мини-тест по теме «Время».
              </p>
              <p className="mt-2 text-right text-xs text-black/45">10:24</p>
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Введите сообщение..."
                className="h-11 flex-1 rounded-2xl border border-black/12 bg-white px-4 text-sm placeholder:text-black/35 focus:outline-none"
              />
              <button
                type="button"
                className="grid h-11 w-11 place-content-center rounded-2xl bg-ds-ink text-white hover:opacity-90"
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
