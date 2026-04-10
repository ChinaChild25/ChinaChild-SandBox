"use client"

import { SendHorizontal } from "lucide-react"
import { useState } from "react"

const dialogs = [
  { id: "1", name: "Ео Ми-ран", last: "Проверьте домашнее задание к четвергу", unread: true },
  { id: "2", name: "Ким Джи-хун", last: "Отлично поработали на разговорном клубе", unread: false }
]

export default function MessagesPage() {
  const [text, setText] = useState("")

  return (
    <div className="px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[76.5rem] flex-col gap-4">
        <section className="ek-surface bg-[#ebebeb] px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Коммуникация</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-[#171a23]">
            Сообщения
          </h1>
        </section>

        <div className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
          <section className="ek-surface bg-[#ebebeb] p-4">
            <ul className="space-y-2">
              {dialogs.map((dialog) => (
                <li key={dialog.id} className="rounded-2xl border border-black/8 bg-white px-4 py-3">
                  <p className="text-base font-semibold tracking-[-0.02em] text-[#171a23]">{dialog.name}</p>
                  <p className="mt-1 text-sm text-black/55">{dialog.last}</p>
                  {dialog.unread ? (
                    <span className="mt-2 inline-flex rounded-full bg-[#d8ea95] px-2 py-0.5 text-xs text-[#171a23]">
                      Новое
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="ek-surface bg-[#ebebeb] px-6 py-5">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-black/55">Ео Ми-ран</p>
              <p className="mt-2 rounded-2xl bg-[#f2f2f2] px-3 py-2 text-sm text-[#171a23]">
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
                className="grid h-11 w-11 place-content-center rounded-2xl bg-[#12151d] text-white hover:bg-[#20242f]"
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
