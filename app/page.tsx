"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ChartNoAxesCombined, MessageSquareMore, Sparkles } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
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
    <div className="min-h-screen bg-background px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[95rem] overflow-hidden rounded-[2rem] border border-black/5 bg-[#e9e9e9] shadow-[0_1px_0_rgba(0,0,0,0.03)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col p-7 md:p-10 lg:p-14">
          <BrandLogo className="text-[2.15rem] leading-7" />

          <div className="my-auto max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-black/45">
              образовательная платформа
            </p>
            <h1 className="mt-4 text-5xl leading-[0.98] font-semibold tracking-[-0.05em] text-[#13161f] lg:text-[4.35rem]">
              Учитесь эффективнее
              <br />
              с персональным
              <br />
              учебным кабинетом
            </h1>
            <p className="mt-7 max-w-[32rem] text-xl leading-[1.3] text-black/60">
              Структурированные уроки, понятные метрики прогресса и поддержка наставников в едином интерфейсе.
            </p>

            <div className="mt-10 space-y-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="ek-soft-panel flex items-start gap-4 px-5 py-4"
                >
                  <div className="mt-0.5 grid h-10 w-10 place-content-center rounded-full bg-[#d8ea95] text-[#141821]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#13161f]">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-[1.02rem] text-black/55">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-8 border-t border-black/8 pt-6 text-[#171a22]">
            <div>
              <p className="text-4xl font-semibold tracking-[-0.03em]">48</p>
              <p className="text-sm text-black/55">Всего уроков</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-[-0.03em]">12</p>
              <p className="text-sm text-black/55">Преподавателей</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-[-0.03em]">93%</p>
              <p className="text-sm text-black/55">Средний балл</p>
            </div>
          </div>
        </div>

        <div className="border-t border-black/8 bg-[#efefef] p-5 md:p-8 lg:border-l lg:border-t-0 lg:p-12">
          <div className="mx-auto w-full max-w-[34rem]">
            <div className="mb-5 inline-flex rounded-full bg-black/5 p-1.5">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                  isLogin
                    ? "bg-[#141720] text-white"
                    : "text-black/65 hover:text-black"
                )}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                  !isLogin
                    ? "bg-[#141720] text-white"
                    : "text-black/65 hover:text-black"
                )}
              >
                Регистрация
              </button>
            </div>

            <section className="ek-surface rounded-[1.75rem] bg-white px-6 py-8 md:px-8">
              <h2 className="ek-auth-title">
                {isLogin ? "С возвращением" : "Добро пожаловать в ChinaChild"}
              </h2>
              <p className="mt-2 text-[1rem] text-black/55">
                {isLogin
                  ? "Войдите, чтобы открыть персональный учебный кабинет."
                  : "Создайте профиль и начните обучение по структурированной программе."}
              </p>

              <div className="mt-7">
                {isLogin ? (
                  <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
                ) : (
                  <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
                )}
              </div>
            </section>

            <p className="mt-5 inline-flex items-center gap-2 text-sm text-black/55">
              Доступ к урокам, заданиям и сообщениям преподавателей
              <ArrowRight className="h-4 w-4" />
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
