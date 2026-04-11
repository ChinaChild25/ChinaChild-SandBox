"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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

    const success = await register(name, email, password)
    if (success) {
      router.push("/dashboard")
    } else {
      setError("Не удалось зарегистрироваться. Повторите попытку.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Имя и фамилия</Label>
        <input
          id="name"
          type="text"
          placeholder="Введите имя и фамилию"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-email">Почта</Label>
        <input
          id="reg-email"
          type="email"
          placeholder="name@chinachild.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="ds-input-field"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">Пароль</Label>
        <div className="relative">
          <input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="Создайте пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="ds-input-field pr-11"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ds-text-muted transition-colors hover:text-ds-ink"
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password ? (
          <div className="mt-3 space-y-1.5 rounded-[var(--ds-radius-md)] border border-black/8 bg-ds-surface-muted p-3">
            {passwordRequirements.map((req, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-ds-sm ${
                  req.met ? "text-ds-text-primary" : "text-ds-text-tertiary"
                }`}
              >
                {req.met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                {req.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Подтвердите пароль</Label>
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
          <p className="mt-2 flex items-center gap-1.5 text-ds-sm text-red-600">
            <X className="h-3.5 w-3.5" aria-hidden />
            Пароли не совпадают
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-2 pt-2">
        <Checkbox
          id="terms"
          checked={acceptTerms}
          onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
          className="mt-0.5"
        />
        <Label htmlFor="terms" className="cursor-pointer font-normal leading-snug text-ds-text-muted">
          Я принимаю{" "}
          <a href="#" className="text-ds-ink underline-offset-2 hover:underline">
            условия сервиса
          </a>{" "}
          и{" "}
          <a href="#" className="text-ds-ink underline-offset-2 hover:underline">
            политику конфиденциальности
          </a>
        </Label>
      </div>

      {error ? (
        <p className="rounded-[var(--ds-radius-md)] border border-red-200 px-3 py-2 text-ds-body-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={isLoading} className="ds-btn-primary-solid mt-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Создание аккаунта...
          </>
        ) : (
          "Создать аккаунт"
        )}
      </button>

      <p className="pt-1 text-center text-ds-body-sm text-ds-text-muted">
        Уже есть аккаунт?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-ds-ink underline-offset-2 hover:underline"
        >
          Войти
        </button>
      </p>
    </form>
  )
}
