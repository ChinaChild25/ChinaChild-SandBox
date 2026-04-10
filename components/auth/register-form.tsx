"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
        <Label htmlFor="name" className="text-[13px] font-medium text-black/70">
          Имя и фамилия
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-[15px] shadow-none placeholder:text-black/35 focus-visible:border-black/25 focus-visible:ring-black/10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-email" className="text-[13px] font-medium text-black/70">
          Почта
        </Label>
        <Input
          id="reg-email"
          type="email"
          placeholder="name@chinachild.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-[15px] shadow-none placeholder:text-black/35 focus-visible:border-black/25 focus-visible:ring-black/10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password" className="text-[13px] font-medium text-black/70">
          Пароль
        </Label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="Создайте пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 pr-11 text-[15px] shadow-none placeholder:text-black/35 focus-visible:border-black/25 focus-visible:ring-black/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-black/45 transition-colors hover:text-black"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {password && (
          <div className="mt-3 space-y-1.5 rounded-2xl border border-black/8 bg-black/[0.03] p-3">
            {passwordRequirements.map((req, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-xs ${
                  req.met ? "text-black/85" : "text-black/45"
                }`}
              >
                {req.met ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {req.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-[13px] font-medium text-black/70">
          Подтвердите пароль
        </Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Повторите пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-[15px] shadow-none placeholder:text-black/35 focus-visible:border-black/25 focus-visible:ring-black/10"
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <X className="h-3.5 w-3.5" />
            Пароли не совпадают
          </p>
        )}
      </div>

      <div className="flex items-start space-x-2 pt-2">
        <Checkbox
          id="terms"
          checked={acceptTerms}
          onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
          className="mt-0.5 rounded-[6px] border-black/25 data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
        />
        <Label
          htmlFor="terms"
          className="cursor-pointer text-[13px] leading-snug font-normal text-black/55"
        >
          Я принимаю{" "}
          <a href="#" className="text-black hover:underline">
            условия сервиса
          </a>{" "}
          и{" "}
          <a href="#" className="text-black hover:underline">
            политику конфиденциальности
          </a>
        </Label>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <Button 
        type="submit" 
        className="mt-2 h-11 w-full rounded-2xl bg-[#111320] text-[15px] font-medium text-white hover:bg-[#202336]" 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Создание аккаунта...
          </>
        ) : (
          "Создать аккаунт"
        )}
      </Button>

      <p className="pt-1 text-center text-sm text-black/55">
        Уже есть аккаунт?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-black hover:underline"
        >
          Войти
        </button>
      </p>
    </form>
  )
}
