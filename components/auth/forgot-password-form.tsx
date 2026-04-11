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
          <p
            className="rounded-[10px] border border-black/10 px-3 py-2.5 text-[14px] text-[#1a1a1a]"
            style={{ backgroundColor: "rgb(240 253 244)" }}
          >
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
          <p className="text-center text-[15px] text-[#737373]">
            <button
              type="button"
              onClick={onBackToLogin}
              className="border-0 bg-transparent font-bold text-black transition-opacity hover:opacity-80"
            >
              Назад ко входу
            </button>
          </p>
        </form>
      )}
    </div>
  )
}
