"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ChartNoAxesCombined, MessageSquareMore, Sparkles } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { useAuth } from "@/lib/auth-context"
import { BrandLogo } from "@/components/brand-logo"

const features = [
  {
    icon: ChartNoAxesCombined,
    title: "Прозрачный прогресс",
    description: "Контролируйте занятия, домашние задания и результаты тестов в одном кабинете."
  },
  {
    icon: MessageSquareMore,
    title: "Связь с преподавателями",
    description: "Оставайтесь на связи с куратором и наставниками по курсам."
  },
  {
    icon: Sparkles,
    title: "Умный учебный ритм",
    description: "Планируйте неделю по расписанию и удерживайте стабильный темп."
  }
]

export default function AuthPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [isLogin, setIsLogin] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="ds-auth-root">
      <div className="ds-auth-marketing">
        <BrandLogo className="text-[length:var(--ds-logo-size)] font-bold leading-none text-ds-ink" />

        <div className="my-10 max-w-xl lg:my-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center">
          <p className="text-ds-xs font-bold uppercase tracking-[0.12em] text-ds-text-secondary">
            образовательная платформа
          </p>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(2rem,4vw,2.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-ds-ink lg:max-w-none lg:text-[length:var(--ds-text-8xl)]">
            Учитесь эффективнее
            <br />
            с персональным
            <br />
            учебным кабинетом
          </h1>
          <p className="mt-6 max-w-[28rem] text-ds-body leading-[var(--ds-leading-body)] text-ds-text-muted">
            Структурированные уроки, понятные метрики прогресса и поддержка наставников в едином интерфейсе.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {features.map((feature) => (
              <div key={feature.title} className="ds-feature-tile">
                <div className="ds-feature-tile__icon">
                  <feature.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-[length:var(--ds-text-body-xl)] font-medium leading-tight tracking-[-0.02em] text-ds-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-ds-body-sm leading-snug text-ds-text-muted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-8 border-t border-black/10 pt-8 text-ds-ink lg:mt-0">
          <div>
            <p className="text-[length:var(--ds-text-8xl)] font-normal leading-none tracking-[-0.02em]">48</p>
            <p className="mt-1 text-ds-body-sm text-ds-text-muted">Всего уроков</p>
          </div>
          <div>
            <p className="text-[length:var(--ds-text-8xl)] font-normal leading-none tracking-[-0.02em]">12</p>
            <p className="mt-1 text-ds-body-sm text-ds-text-muted">Преподавателей</p>
          </div>
          <div>
            <p className="text-[length:var(--ds-text-8xl)] font-normal leading-none tracking-[-0.02em]">93%</p>
            <p className="mt-1 text-ds-body-sm text-ds-text-muted">Средний балл</p>
          </div>
        </div>
      </div>

      <div className="ds-auth-form-aside">
        <div className="mx-auto flex w-full max-w-[min(26rem,100%)] flex-1 flex-col justify-center py-6 lg:py-10">
          <div className="ds-auth-form-panel">
            <div className="ds-segmented mb-8">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`ds-segmented__btn ${isLogin ? "ds-segmented__btn--active" : ""}`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`ds-segmented__btn ${!isLogin ? "ds-segmented__btn--active" : ""}`}
              >
                Регистрация
              </button>
            </div>

            <div className="mb-8 grid grid-cols-3 gap-2">
              <div className="rounded-[var(--ds-radius-lg)] bg-ds-sidebar px-2 py-3 text-center transition-transform duration-200 hover:scale-[1.02]">
                <p className="text-[1.35rem] font-semibold leading-none tracking-tight text-ds-ink">
                  9<span className="text-ds-text-tertiary">/48</span>
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ds-text-tertiary">
                  Занятия
                </p>
              </div>
              <div className="rounded-[var(--ds-radius-lg)] bg-ds-ink px-2 py-3 text-center text-white transition-transform duration-200 hover:scale-[1.02]">
                <p className="text-[1.35rem] font-semibold leading-none tracking-tight">
                  8<span className="text-white/65">/48</span>
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white/60">
                  Домашние
                </p>
              </div>
              <div className="rounded-[var(--ds-radius-lg)] bg-ds-sage px-2 py-3 text-center transition-transform duration-200 hover:scale-[1.02]">
                <p className="text-[1.35rem] font-semibold leading-none tracking-tight text-ds-ink">
                  93<span className="text-ds-text-secondary">/100</span>
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ds-text-muted">
                  Балл
                </p>
              </div>
            </div>

            <h2 className="text-[clamp(1.65rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-ds-ink">
              {isLogin ? "С возвращением" : "Добро пожаловать в ChinaChild"}
            </h2>
            <p className="mt-3 max-w-[28rem] text-[15px] leading-relaxed text-ds-text-secondary">
              {isLogin
                ? "Тот же кабинет, что и после входа: расписание, прогресс и контакты — в одной сетке."
                : "Один аккаунт — доступ к урокам, заданиям и чату с наставниками."}
            </p>

            <div className="mt-8">
              {isLogin ? (
                <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
              )}
            </div>
          </div>

          <p className="group mt-8 inline-flex items-center gap-2 px-1 text-ds-sm-plus text-ds-text-muted">
            Доступ к урокам, заданиям и сообщениям преподавателей
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </p>
        </div>
      </div>
    </div>
  )
}
