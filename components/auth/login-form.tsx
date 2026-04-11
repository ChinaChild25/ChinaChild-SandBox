"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const router = useRouter()
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Заполните все поля")
      return
    }

    const success = await login(email, password)
    if (success) {
      router.push("/dashboard")
    } else {
      setError("Неверные данные. Пароль должен содержать минимум 6 символов.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="ds-auth-field-label">
          Почта
        </label>
        <input
          id="email"
          type="email"
          placeholder="yana@chinachild.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="email"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="password" className="ds-auth-field-label ds-auth-field-label--flush">
            Пароль
          </label>
          <button
            type="button"
            className="text-[12px] font-medium text-ds-text-tertiary transition-colors hover:text-ds-ink"
          >
            Забыли пароль?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="ds-input-field pr-12"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--ds-radius-md)] text-ds-text-muted transition-colors hover:bg-black/[0.06] hover:text-ds-ink"
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="ds-auth-remember">
        <button
          type="button"
          role="switch"
          aria-checked={rememberMe}
          onClick={() => setRememberMe((v) => !v)}
          className={`ds-auth-remember-track ${rememberMe ? "ds-auth-remember-track--on" : "ds-auth-remember-track--off"}`}
        >
          <span className="ds-auth-remember-knob" />
        </button>
        <span className="text-ds-body-sm text-ds-text-muted">Запомнить меня на 30 дней</span>
      </div>

      {error ? (
        <p
          className="rounded-[var(--ds-radius-md)] border border-red-200/90 px-3 py-2.5 text-ds-sm-plus text-red-700"
          style={{ backgroundColor: "rgb(254 242 242)" }}
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={isLoading} className="ds-btn-primary-solid h-12 text-[15px]">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Вход...
          </>
        ) : (
          "Войти"
        )}
      </button>

      <div className="ds-auth-social-row">
        <button type="button" className="ds-auth-social-link">
          Google
        </button>
        <span className="ds-auth-social-sep" aria-hidden>
          ·
        </span>
        <button type="button" className="ds-auth-social-link">
          GitHub
        </button>
      </div>

      <p className="text-center text-ds-sm-plus text-ds-text-muted">
        Нет аккаунта?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-ds-ink underline-offset-4 transition-colors hover:underline"
        >
          Зарегистрироваться
        </button>
      </p>
    </form>
  )
}
