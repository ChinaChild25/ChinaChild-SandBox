"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface LoginFormProps {
  onSwitchToRegister: () => void
  onForgotPassword: () => void
}

export function LoginForm({ onSwitchToRegister, onForgotPassword }: LoginFormProps) {
  const router = useRouter()
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [accountType, setAccountType] = useState<"student" | "teacher">("student")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Заполните все поля")
      return
    }

    const result = await login(email, password, accountType)
    if (result.ok) {
      router.push(accountType === "teacher" ? "/teacher/dashboard" : "/dashboard")
    } else {
      setError(result.message ?? "Не удалось войти. Проверьте email и пароль.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <span className="ds-auth-field-label mb-2 block">Войти как</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccountType("student")}
            className={`rounded-[14px] border px-3 py-2.5 text-[15px] font-medium transition-colors ${
              accountType === "student"
                ? "border-ds-ink bg-ds-ink text-white dark:border-white dark:bg-white dark:text-ds-ink"
                : "border-black/15 bg-white/60 text-ds-ink hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            }`}
          >
            Ученик
          </button>
          <button
            type="button"
            onClick={() => setAccountType("teacher")}
            className={`rounded-[14px] border px-3 py-2.5 text-[15px] font-medium transition-colors ${
              accountType === "teacher"
                ? "border-ds-ink bg-ds-ink text-white dark:border-white dark:bg-white dark:text-ds-ink"
                : "border-black/15 bg-white/60 text-ds-ink hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            }`}
          >
            Преподаватель
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="email" className="ds-auth-field-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="password" className="ds-auth-field-label">
          Пароль
        </label>
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
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#a3a3a3] transition-colors hover:bg-black/[0.06] hover:text-[#525252] dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-[14px] border border-red-200/90 bg-red-50 px-4 py-3 text-[15px] text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={isLoading} className="ds-btn-primary-solid w-full gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Вход...
          </>
        ) : (
          <>
            Войти
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>

      <p className="text-center">
        <button
          type="button"
          onClick={onForgotPassword}
          className="border-0 bg-transparent text-[1.0625rem] text-[#525252] underline-offset-4 transition-colors hover:text-[#141414] dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Забыли пароль?
        </button>
      </p>

      <hr className="ds-auth-divider" />

      <p className="text-center text-[1.0625rem] text-[#525252] dark:text-zinc-400">
        Нет аккаунта?{" "}
        <button type="button" onClick={onSwitchToRegister} className="ds-auth-accent-link cursor-pointer border-0 bg-transparent p-0">
          Зарегистрироваться
        </button>
      </p>
    </form>
  )
}
