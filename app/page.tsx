"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HelpCircle } from "lucide-react"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { useAuth } from "@/lib/auth-context"

export default function AuthPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login")

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="ds-auth-root">
      <div className="ds-auth-marketing">
        <div className="ds-auth-marketing__logo-corner">
          <Image
            src="/brand/chinachild-ch-mark.png"
            alt="ChinaChild"
            width={52}
            height={52}
            className="ds-auth-marketing__logo-img"
            priority
            unoptimized
          />
        </div>
        <div className="ds-auth-marketing__brand ds-auth-marketing__float">
          <span className="ds-auth-marketing__brand-text">ChinaChild</span>
        </div>
        <div className="ds-auth-marketing__shine" aria-hidden />
      </div>

      <div className="ds-auth-form-aside">
        <div className="ds-auth-form-scroll">
          <div className="ds-auth-form-inner">
            {authMode === "forgot" ? (
              <>
                <h1 className="ds-auth-screen-title">Сброс пароля</h1>
                <p className="ds-auth-screen-sub">
                  Укажите email — отправим ссылку для восстановления (в демо письмо не уходит).
                </p>
                <div className="ds-auth-form-panel">
                  <ForgotPasswordForm
                    onBackToLogin={() => {
                      setAuthMode("login")
                      setIsLogin(true)
                    }}
                  />
                </div>
              </>
            ) : isLogin ? (
              <>
                <h1 className="ds-auth-screen-title">Вход в аккаунт</h1>
                <p className="ds-auth-screen-sub">Рады видеть тебя снова</p>
                <div className="ds-auth-form-panel">
                  <LoginForm
                    onSwitchToRegister={() => {
                      setIsLogin(false)
                      setAuthMode("register")
                    }}
                    onForgotPassword={() => setAuthMode("forgot")}
                  />
                </div>
              </>
            ) : (
              <>
                <h1 className="ds-auth-screen-title">Регистрация аккаунта</h1>
                <p className="ds-auth-screen-sub">Заполните форму, чтобы создать свой аккаунт</p>
                <div className="ds-auth-form-panel">
                  <RegisterForm
                    onSwitchToLogin={() => {
                      setIsLogin(true)
                      setAuthMode("login")
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className="ds-auth-help-fab"
          aria-label="Помощь"
          onClick={() => window.open("mailto:support@chinachild.ru", "_blank")}
        >
          <HelpCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  )
}
