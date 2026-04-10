"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
      <div className="space-y-2.5">
        <Label htmlFor="email" className="text-sm font-semibold text-[#161922]">Почта</Label>
        <Input
          id="email"
          type="email"
          placeholder="yana@chinachild.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-[15px] shadow-[0_2px_6px_rgba(16,19,28,0.05)] focus-visible:ring-2 focus-visible:ring-[#d8e98a]"
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-[#161922]">Пароль</Label>
          <button
            type="button"
            className="text-xs font-medium text-black/55 transition-colors hover:text-black"
          >
            Забыли пароль?
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[15px] shadow-[0_2px_6px_rgba(16,19,28,0.05)] focus-visible:ring-2 focus-visible:ring-[#d8e98a]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-black/45 hover:text-black transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="remember"
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
          className="rounded-md border-black/20 data-[state=checked]:border-[#161922] data-[state=checked]:bg-[#161922]"
        />
        <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-black/60">
          Remember me for 30 days
        </Label>
      </div>

      {error && (
        <p className="rounded-2xl bg-[#fce5e5] p-3 text-sm text-[#9e2f2f]">
          {error}
        </p>
      )}

      <Button 
        type="submit" 
        className="h-12 w-full rounded-2xl bg-[#12151d] text-base font-semibold text-white hover:bg-[#1e222e]" 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Вход...
          </>
        ) : (
          "Войти"
        )}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-black/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#f3f3f4] px-3 tracking-[0.12em] text-black/45">
            или продолжить через
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button 
          type="button" 
          variant="outline" 
          className="h-11 rounded-2xl border-black/12 bg-white text-[#202431] hover:bg-black/[0.03]"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          className="h-11 rounded-2xl border-black/12 bg-white text-[#202431] hover:bg-black/[0.03]"
        >
          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          GitHub
        </Button>
      </div>

      <p className="pt-2 text-center text-sm text-black/58">
        {"Нет аккаунта? "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-[#161922] hover:underline"
        >
          Зарегистрироваться
        </button>
      </p>
    </form>
  )
}
