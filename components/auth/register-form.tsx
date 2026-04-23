"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Eye, EyeOff, Loader2, Check, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter()
  const { register, isLoading } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState("")

  const passwordRequirements = [
    { label: "Минимум 6 символов", met: password.length >= 6 },
    { label: "Содержит цифру", met: /\d/.test(password) },
    { label: "Содержит заглавную букву", met: /[A-ZА-ЯЁ]/.test(password) }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name || !email || !password || !confirmPassword) {
      setError("Заполните все поля")
      return
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают")
      return
    }

    if (!passwordRequirements.every((req) => req.met)) {
      setError("Пароль должен соответствовать всем условиям")
      return
    }

    if (!acceptTerms) {
      setError("Подтвердите согласие с условиями")
      return
    }

    const result = await register(name, email, password)
    if (result.ok) {
      router.push("/dashboard")
    } else {
      setError(result.message ?? "Не удалось зарегистрироваться. Повторите попытку.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-[1.0625rem] leading-snug text-[#525252] dark:text-zinc-400">
        Уже есть аккаунт?{" "}
        <button type="button" onClick={onSwitchToLogin} className="ds-auth-accent-link cursor-pointer border-0 bg-transparent p-0">
          Войти
        </button>
      </p>

      <div>
        <label htmlFor="name" className="ds-auth-field-label">
          Имя и фамилия
        </label>
        <input
          id="name"
          type="text"
          placeholder="Надежда Толкачёва"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="reg-email" className="ds-auth-field-label">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          placeholder="n.tolkacheva@chinachild.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="reg-password" className="ds-auth-field-label">
          Пароль
        </label>
        <div className="relative">
          <input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="Создайте пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="ds-input-field pr-12"
            autoComplete="new-password"
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
        {password ? (
          <div className="mt-3 space-y-1.5 rounded-[14px] border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/5">
            {passwordRequirements.map((req, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-[14px] ${
                  req.met ? "text-ds-ink dark:text-zinc-200" : "text-ds-text-tertiary dark:text-zinc-500"
                }`}
              >
                {req.met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                {req.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirm-password" className="ds-auth-field-label">
          Подтвердите пароль
        </label>
        <input
          id="confirm-password"
          type="password"
          placeholder="Повторите пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="new-password"
        />
        {confirmPassword && password !== confirmPassword ? (
          <p className="mt-2 flex items-center gap-1.5 text-[14px] text-red-600 dark:text-red-400">
            <X className="h-3.5 w-3.5" aria-hidden />
            Пароли не совпадают
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3 pt-1">
        <Checkbox
          id="terms"
          checked={acceptTerms}
          onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
          className="mt-1"
        />
        <label htmlFor="terms" className="cursor-pointer text-[15px] leading-relaxed text-[#525252] dark:text-zinc-400">
          Я принимаю{" "}
          <a href="#" className="ds-auth-accent-link">
            условия сервиса
          </a>{" "}
          и{" "}
          <a href="#" className="ds-auth-accent-link">
            политику конфиденциальности
          </a>
        </label>
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
            Создание аккаунта...
          </>
        ) : (
          <>
            Зарегистрироваться
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>

      <p className="text-center text-[13px] leading-relaxed text-[#737373] dark:text-zinc-500">
        Нажимая кнопку, вы соглашаетесь с{" "}
        <a href="#" className="ds-auth-accent-link">
          политикой конфиденциальности
        </a>{" "}
        и{" "}
        <a href="#" className="ds-auth-accent-link">
          пользовательским соглашением
        </a>
        .
      </p>
    </form>
  )
}
