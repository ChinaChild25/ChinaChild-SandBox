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
    <div className="min-h-[100dvh] w-full bg-[#f5f5f5]">
      <div className="grid min-h-[100dvh] w-full lg:grid-cols-[1fr_1fr]">
        {/* Левая колонка — как сайдбар в Figma (#e8e8e8) */}
        <div className="flex flex-col justify-between bg-[#e8e8e8] px-6 py-8 md:px-10 md:py-12 lg:px-14 lg:py-14">
          <BrandLogo className="text-[28px] font-bold leading-none text-[#1a1a1a]" />

          <div className="my-10 max-w-xl lg:my-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#1a1a1a]/55">
              образовательная платформа
            </p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1a1a]">
              Учитесь эффективнее
              <br />
              с персональным
              <br />
              учебным кабинетом
            </h1>
            <p className="mt-6 max-w-[28rem] text-[15px] leading-[1.5] text-[#555]">
              Структурированные уроки, понятные метрики прогресса и поддержка наставников в едином интерфейсе.
            </p>

            <div className="mt-8 space-y-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                >
                  <div className="mt-0.5 grid h-10 w-10 shrink-0 place-content-center rounded-full bg-[#d4e7b0] text-[#1a1a1a]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-medium leading-tight tracking-[-0.02em] text-[#1a1a1a]">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-[14px] leading-snug text-[#555]">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-8 border-t border-black/10 pt-8 text-[#1a1a1a] lg:mt-0">
            <div>
              <p className="text-[36px] font-normal leading-none tracking-[-0.02em]">48</p>
              <p className="mt-1 text-[14px] text-[#555]">Всего уроков</p>
            </div>
            <div>
              <p className="text-[36px] font-normal leading-none tracking-[-0.02em]">12</p>
              <p className="mt-1 text-[14px] text-[#555]">Преподавателей</p>
            </div>
            <div>
              <p className="text-[36px] font-normal leading-none tracking-[-0.02em]">93%</p>
              <p className="mt-1 text-[14px] text-[#555]">Средний балл</p>
            </div>
          </div>
        </div>

        {/* Правая колонка — форма на белом, как основная зона Figma */}
        <div className="flex flex-col bg-white px-6 py-8 md:px-10 md:py-12 lg:px-14 lg:py-14">
          <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center">
            <div className="mb-6 inline-flex w-fit rounded-full bg-[#ececf0] p-1.5">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-[14px] font-medium transition-colors",
                  isLogin ? "bg-[#1a1a1a] text-white" : "text-[#555] hover:text-[#1a1a1a]"
                )}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-[14px] font-medium transition-colors",
                  !isLogin ? "bg-[#1a1a1a] text-white" : "text-[#555] hover:text-[#1a1a1a]"
                )}
              >
                Регистрация
              </button>
            </div>

            <div className="rounded-[28px] border border-black/[0.06] bg-[#fafafa] p-6 md:p-8">
              <h2 className="text-[28px] font-normal leading-tight tracking-[-0.03em] text-[#1a1a1a]">
                {isLogin ? "С возвращением" : "Добро пожаловать в ChinaChild"}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[#555]">
                {isLogin
                  ? "Войдите, чтобы открыть персональный учебный кабинет."
                  : "Создайте профиль и начните обучение по структурированной программе."}
              </p>

              <div className="mt-6">
                {isLogin ? (
                  <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
                ) : (
                  <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
                )}
              </div>
            </div>

            <p className="group mt-6 inline-flex items-center gap-2 text-[13px] text-[#555]">
              Доступ к урокам, заданиям и сообщениям преподавателей
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
