"use client"

import { useAuth } from "@/lib/auth-context"

export default function TeacherSettingsPage() {
  const { user } = useAuth()

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,480px)]">
        <h1 className="mb-2 text-[28px] font-bold text-ds-ink">Настройки</h1>
        <p className="mb-8 text-[15px] text-ds-text-secondary">
          Профиль преподавателя и уведомления будут на сервере. Ниже — демо-данные сессии.
        </p>

        <div className="rounded-[var(--ds-radius-xl)] border border-black/10 bg-[var(--ds-neutral-row)] p-5 dark:border-white/10">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-ds-text-tertiary">Аккаунт</div>
          <div className="mt-2 text-[18px] font-semibold text-ds-ink">{user?.name}</div>
          <div className="mt-1 text-[14px] text-ds-text-secondary">{user?.email}</div>
        </div>
      </div>
    </div>
  )
}
