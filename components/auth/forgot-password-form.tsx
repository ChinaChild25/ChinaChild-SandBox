"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

type ForgotPasswordFormProps = {
  onBackToLogin: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[clamp(1.65rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-ds-ink">
        Сброс пароля
      </h2>
      <p className="max-w-[28rem] text-[15px] leading-relaxed text-ds-text-secondary">
        Укажите почту аккаунта — отправим ссылку для восстановления доступа (демо: без реальной отправки).
      </p>

      {sent ? (
        <div className="space-y-6">
          <p
            className="rounded-[var(--ds-radius-md)] border border-black/10 px-3 py-2.5 text-ds-sm-plus text-ds-ink"
            style={{ backgroundColor: "rgb(240 253 244)" }}
          >
            Если адрес зарегистрирован, письмо со ссылкой скоро придёт на <strong>{email}</strong>.
          </p>
          <button type="button" onClick={onBackToLogin} className="ds-btn-primary-solid h-12 text-[15px]">
            Вернуться ко входу
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="forgot-email" className="ds-auth-field-label">
              Почта
            </label>
            <input
              id="forgot-email"
              type="email"
              placeholder="yana@chinachild.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="ds-input-field"
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="ds-btn-primary-solid h-12 text-[15px]">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Отправка...
              </>
            ) : (
              "Отправить ссылку"
            )}
          </button>
          <p className="text-center text-ds-sm-plus text-ds-text-muted">
            <button
              type="button"
              onClick={onBackToLogin}
              className="font-semibold text-ds-ink underline-offset-4 transition-colors hover:underline"
            >
              Назад ко входу
            </button>
          </p>
        </form>
      )}
    </div>
  )
}
