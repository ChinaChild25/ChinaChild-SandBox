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
    <div className="space-y-5">
      {sent ? (
        <div className="space-y-5">
          <p className="rounded-[14px] border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-[15px] text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-950/35 dark:text-emerald-100">
            Если адрес зарегистрирован, письмо со ссылкой скоро придёт на <strong>{email}</strong>.
          </p>
          <button type="button" onClick={onBackToLogin} className="ds-btn-primary-solid w-full">
            Вернуться ко входу
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="forgot-email" className="ds-auth-field-label">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="ds-input-field"
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="ds-btn-primary-solid w-full gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Отправка...
              </>
            ) : (
              "Отправить ссылку"
            )}
          </button>
          <hr className="ds-auth-divider" />
          <p className="text-center text-[1.0625rem] text-[#525252] dark:text-zinc-400">
            <button type="button" onClick={onBackToLogin} className="ds-auth-accent-link cursor-pointer border-0 bg-transparent p-0">
              Назад ко входу
            </button>
          </p>
        </form>
      )}
    </div>
  )
}
