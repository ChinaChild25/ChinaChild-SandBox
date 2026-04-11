"use client"

import Image from "next/image"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { placeholderImages } from "@/lib/placeholders"

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [goal, setGoal] = useState("Разговорная практика")

  return (
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4">
        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Личный кабинет</p>
          <h1 className="mt-3 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-ds-ink">
            Профиль
          </h1>
        </section>

        <div className="grid gap-4 lg:grid-cols-[0.38fr_0.62fr]">
          <section className="ek-surface bg-ds-panel-muted px-6 py-6">
            <div className="mx-auto h-32 w-32 overflow-hidden rounded-full">
              <Image
                src={placeholderImages.studentAvatar}
                alt="Аватар ученика"
                width={128}
                height={128}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-4 text-center text-[1.45rem] font-semibold tracking-[-0.02em] text-ds-ink">
              {user?.name}
            </p>
            <p className="mt-1 text-center text-sm text-black/55">{user?.email}</p>
          </section>

          <section className="ek-surface bg-ds-panel-muted px-7 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-black/60">
                Имя
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-black/12 bg-white px-4 text-[15px] text-ds-ink focus:outline-none"
                />
              </label>
              <label className="text-sm text-black/60">
                Почта
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-black/12 bg-white px-4 text-[15px] text-ds-ink focus:outline-none"
                />
              </label>
              <label className="sm:col-span-2 text-sm text-black/60">
                Цель обучения
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-black/12 bg-white px-4 text-[15px] text-ds-ink focus:outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => updateUser({ name, email })}
              className="mt-5 rounded-2xl bg-ds-ink px-5 py-3 text-sm font-medium text-white hover:opacity-90"
            >
              Сохранить изменения
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
