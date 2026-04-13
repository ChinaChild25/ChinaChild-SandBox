"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { Eye, EyeOff, HelpCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { fetchProfileForAuthUser } from "@/lib/supabase/profile"

type Phase = "checking" | "form" | "bad_link" | "success"

function translateUpdatePasswordError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("same")) return "Новый пароль не должен совпадать со старым."
  if (m.includes("password")) return message
  return message
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const { usesSupabase, refreshProfile } = useAuth()
  const [phase, setPhase] = useState<Phase>("checking")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!usesSupabase || !isSupabaseConfigured()) {
      setPhase("bad_link")
      return
    }

    const supabase = createBrowserSupabaseClient()
    let cancelled = false

    const allowForm = () => {
      if (!cancelled) setPhase("form")
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        allowForm()
      }
    })

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        allowForm()
        return
      }

      await new Promise((r) => setTimeout(r, 200))
      if (cancelled) return
      const { data: { session: s2 } } = await supabase.auth.getSession()
      if (s2) {
        allowForm()
        return
      }

      await new Promise((r) => setTimeout(r, 1200))
      if (cancelled) return
      const { data: { session: s3 } } = await supabase.auth.getSession()
      if (s3) {
        allowForm()
      } else {
        setPhase("bad_link")
      }
    })()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [usesSupabase])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError("")

      if (password.length < 6) {
        setSubmitError("Пароль — минимум 6 символов.")
        return
      }
      if (password !== confirm) {
        setSubmitError("Пароли не совпадают.")
        return
      }

      setSubmitting(true)
      try {
        const supabase = createBrowserSupabaseClient()
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          setSubmitError(translateUpdatePasswordError(error.message))
          return
        }

        await refreshProfile()
        const {
          data: { user: authUser }
        } = await supabase.auth.getUser()
        if (authUser) {
          const pr = await fetchProfileForAuthUser(supabase, authUser)
          if (pr.ok) {
            router.replace(
              pr.user.role === "teacher" || pr.user.role === "curator" ? "/teacher/dashboard" : "/dashboard"
            )
            return
          }
        }
        setPhase("success")
      } catch {
        setSubmitError("Не удалось сохранить пароль. Попробуйте ещё раз.")
      } finally {
        setSubmitting(false)
      }
    },
    [password, confirm, refreshProfile, router]
  )

  if (!usesSupabase) {
    return (
      <div className="ds-auth-root">
        <div className="ds-auth-form-aside w-full max-w-none">
          <div className="ds-auth-form-scroll">
            <div className="ds-auth-form-inner mx-auto max-w-md">
              <h1 className="ds-auth-screen-title">Сброс пароля</h1>
              <p className="ds-auth-screen-sub">Supabase не подключён — восстановление пароля недоступно.</p>
              <Link href="/" className="ds-auth-accent-link text-[1.0625rem] font-medium">
                На страницу входа
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            <h1 className="ds-auth-screen-title">Новый пароль</h1>
            <p className="ds-auth-screen-sub">
              {phase === "checking"
                ? "Проверяем ссылку восстановления…"
                : "Придумайте новый пароль для входа в аккаунт."}
            </p>

            <div className="ds-auth-form-panel">
              {phase === "checking" ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : null}

              {phase === "bad_link" ? (
                <div className="space-y-5">
                  <div
                    className="rounded-[14px] border border-amber-200/90 bg-amber-50 px-4 py-3 text-[15px] text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/35 dark:text-amber-100"
                    role="alert"
                  >
                    Ссылка недействительна или устарела. Запросите новое письмо на экране входа («Забыли пароль?»).
                  </div>
                  <Link href="/" className="ds-btn-primary-solid inline-flex w-full items-center justify-center no-underline">
                    На страницу входа
                  </Link>
                </div>
              ) : null}

              {phase === "success" ? (
                <div className="space-y-5">
                  <p className="rounded-[14px] border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-[15px] text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-950/35 dark:text-emerald-100">
                    Пароль обновлён. Войдите с новым паролем.
                  </p>
                  <Link href="/" className="ds-btn-primary-solid inline-flex w-full items-center justify-center no-underline">
                    Войти
                  </Link>
                </div>
              ) : null}

              {phase === "form" ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {submitError ? (
                    <div
                      className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] leading-snug text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                      role="alert"
                    >
                      {submitError}
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="reset-password" className="ds-auth-field-label">
                      Новый пароль
                    </label>
                    <div className="relative">
                      <input
                        id="reset-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={submitting}
                        className="ds-input-field pr-11"
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reset-password-confirm" className="ds-auth-field-label">
                      Повторите пароль
                    </label>
                    <input
                      id="reset-password-confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={submitting}
                      className="ds-input-field"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>

                  <button type="submit" disabled={submitting} className="ds-btn-primary-solid w-full gap-2">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Сохранение…
                      </>
                    ) : (
                      "Сохранить пароль"
                    )}
                  </button>

                  <p className="text-center text-[1.0625rem] text-[#525252] dark:text-zinc-400">
                    <Link href="/" className="ds-auth-accent-link">
                      Назад ко входу
                    </Link>
                  </p>
                </form>
              ) : null}
            </div>
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
