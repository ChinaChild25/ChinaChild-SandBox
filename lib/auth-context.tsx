"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import type { User, UserRole } from "./types"
import { mockTeacherUser, mockUser } from "./mock-data"
import { formatUiMessage, readStoredUiLocale } from "./ui-messages"
import { isSupabaseConfigured } from "./supabase/config"
import { createBrowserSupabaseClient } from "./supabase/browser"
import { getPasswordRecoveryRedirectUrl } from "./supabase/site-url"
import { fetchProfileForAuthUser, updateProfileFields, type ProfileWritableFields } from "./supabase/profile"

export const LAST_LOGIN_STORAGE_KEY = "chinachild-last-login"

/** Результат login / register (Supabase возвращает тексты ошибок — показываем на форме). */
export type AuthActionResult = { ok: true } | { ok: false; message?: string }

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  authReady: boolean
  usesSupabase: boolean
  /** Ошибка загрузки public.profiles (сессия сброшена). Показывать на экране входа. */
  profileError: string | null
  clearProfileError: () => void
  /** Перечитать public.profiles и обновить user (после сохранения настроек / загрузки аватара). */
  refreshProfile: () => Promise<AuthActionResult>
  login: (email: string, password: string, role?: UserRole) => Promise<AuthActionResult>
  register: (name: string, email: string, password: string) => Promise<AuthActionResult>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; message: string }>
  /** Запрос письма со ссылкой сброса пароля (Supabase). */
  requestPasswordReset: (email: string) => Promise<AuthActionResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function translateSupabaseError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "Неверный email или пароль."
  if (m.includes("email not confirmed")) return "Подтвердите email по ссылке из письма (или отключите подтверждение в Supabase для разработки)."
  if (m.includes("user already registered")) return "Этот email уже зарегистрирован."
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Слишком много запросов. Подождите несколько минут и попробуйте снова."
  }
  if (m.includes("password")) return message
  return message
}

function roleMismatchMessage(selected: UserRole, actual: UserRole): string {
  if (selected === "teacher") {
    return "В профиле указана роль «ученик». Войдите как ученик или попросите администратора выставить role = teacher в public.profiles."
  }
  return "В профиле указана роль «преподаватель». Выберите вход как преподаватель."
}

async function fetchProfileAfterSignUp(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  authUser: Session["user"]
) {
  const delays = [0, 500, 1200]
  for (const ms of delays) {
    if (ms > 0) await new Promise((r) => setTimeout(r, ms))
    const res = await fetchProfileForAuthUser(supabase, authUser)
    if (res.ok) return res
    if (!res.message.includes("не найден")) return res
  }
  return {
    ok: false as const,
    message:
      "Профиль ещё не появился в базе после регистрации. Подождите минуту и войдите снова или проверьте триггер на auth.users."
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [authReady, setAuthReady] = useState(() => !isSupabaseConfigured())
  const [profileError, setProfileError] = useState<string | null>(null)
  const usesSupabase = isSupabaseConfigured()

  const clearProfileError = useCallback(() => setProfileError(null), [])

  const applySession = useCallback(
    async (supabase: ReturnType<typeof createBrowserSupabaseClient>, session: Session | null) => {
      if (!session?.user) {
        setUser(null)
        setProfileError(null)
        return
      }
      const pr = await fetchProfileForAuthUser(supabase, session.user)
      if (!pr.ok) {
        await supabase.auth.signOut()
        setUser(null)
        setProfileError(pr.message)
        return
      }
      setUser(pr.user)
      setProfileError(null)
    },
    []
  )

  useEffect(() => {
    if (!usesSupabase) return

    const supabase = createBrowserSupabaseClient()
    let cancelled = false

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) {
        await applySession(supabase, session)
        setAuthReady(true)
      }
    })()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(supabase, session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [usesSupabase, applySession])

  const login = useCallback(
    async (email: string, password: string, role: UserRole = "student"): Promise<AuthActionResult> => {
      if (usesSupabase) {
        setIsLoading(true)
        setProfileError(null)
        const supabase = createBrowserSupabaseClient()
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error || !data.user) {
          setIsLoading(false)
          return { ok: false, message: error ? translateSupabaseError(error.message) : "Нет данных пользователя." }
        }
        const pr = await fetchProfileForAuthUser(supabase, data.user)
        if (!pr.ok) {
          await supabase.auth.signOut()
          setIsLoading(false)
          return { ok: false, message: pr.message }
        }
        if (pr.user.role !== role) {
          await supabase.auth.signOut()
          setIsLoading(false)
          return { ok: false, message: roleMismatchMessage(role, pr.user.role) }
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_LOGIN_STORAGE_KEY, new Date().toISOString())
        }
        setUser(pr.user)
        setProfileError(null)
        setIsLoading(false)
        return { ok: true }
      }

      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      if (email && password.length >= 6) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_LOGIN_STORAGE_KEY, new Date().toISOString())
        }
        if (role === "teacher") {
          setUser({ ...mockTeacherUser, email })
        } else {
          setUser({ ...mockUser, email })
        }
        setIsLoading(false)
        return { ok: true }
      }
      setIsLoading(false)
      return { ok: false, message: "Неверные данные. Пароль — минимум 6 символов." }
    },
    [usesSupabase]
  )

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<AuthActionResult> => {
      if (usesSupabase) {
        setIsLoading(true)
        setProfileError(null)
        const supabase = createBrowserSupabaseClient()
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        })
        if (error) {
          setIsLoading(false)
          return { ok: false, message: translateSupabaseError(error.message) }
        }
        if (!data.session?.user) {
          setIsLoading(false)
          return {
            ok: false,
            message:
              "Аккаунт создан, но вход не выполнен. Отключите «Confirm email» в Supabase (Authentication → Providers → Email) для мгновенного входа при разработке или подтвердите email."
          }
        }
        const pr = await fetchProfileAfterSignUp(supabase, data.session.user)
        if (!pr.ok) {
          await supabase.auth.signOut()
          setIsLoading(false)
          return { ok: false, message: pr.message }
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_LOGIN_STORAGE_KEY, new Date().toISOString())
        }
        setUser(pr.user)
        setProfileError(null)
        setIsLoading(false)
        return { ok: true }
      }

      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1200))
      if (name && email && password.length >= 6) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_LOGIN_STORAGE_KEY, new Date().toISOString())
        }
        setUser({
          ...mockUser,
          role: "student",
          id: `user-${Date.now()}`,
          name,
          email,
          assignedCuratorSlug: mockUser.assignedCuratorSlug,
          assignedTeacherSlug: mockUser.assignedTeacherSlug,
          dashboardStats: {
            attendedLessons: 0,
            lessonGoal: 48,
            completedHomework: 0,
            homeworkGoal: 48,
            averageScore: 0
          },
          joinDate: new Date().toISOString().split("T")[0],
          learningStreak: 0,
          totalLessonsCompleted: 0,
          totalStudyHours: 0,
          level: "Beginner",
          profileSubtitle: "студентка 1 степени"
        })
        setIsLoading(false)
        return { ok: true }
      }
      setIsLoading(false)
      return { ok: false, message: "Проверьте имя, email и пароль (минимум 6 символов)." }
    },
    [usesSupabase]
  )

  const logout = useCallback(async () => {
    if (usesSupabase) {
      const supabase = createBrowserSupabaseClient()
      await supabase.auth.signOut()
    }
    setUser(null)
    setProfileError(null)
  }, [usesSupabase])

  const refreshProfile = useCallback(async (): Promise<AuthActionResult> => {
    if (!usesSupabase) return { ok: true }
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user: authUser },
        error: authErr
      } = await supabase.auth.getUser()
      if (authErr || !authUser) {
        return { ok: false, message: "Сессия недействительна. Войдите снова." }
      }
      const pr = await fetchProfileForAuthUser(supabase, authUser)
      if (!pr.ok) return pr
      setUser(pr.user)
      return { ok: true }
    } catch {
      return { ok: false, message: "Ошибка при загрузке профиля." }
    }
  }, [usesSupabase])

  const updateUser = useCallback(
    (updates: Partial<User>) => {
      setUser((prev) => {
        if (!prev) return null
        const next = { ...prev, ...updates }
        if (usesSupabase) {
          const fields: ProfileWritableFields = {}
          if (updates.firstName !== undefined) fields.first_name = updates.firstName?.trim() || null
          if (updates.lastName !== undefined) fields.last_name = updates.lastName?.trim() || null
          if (updates.phone !== undefined) fields.phone = updates.phone?.trim() || null
          if (updates.profileFullName !== undefined) {
            fields.full_name = updates.profileFullName?.trim() || null
          }
          if (updates.avatar !== undefined) fields.avatar_url = updates.avatar ?? null

          const touchedDetailed =
            updates.firstName !== undefined ||
            updates.lastName !== undefined ||
            updates.phone !== undefined ||
            updates.profileFullName !== undefined ||
            updates.avatar !== undefined

          if (updates.name !== undefined && !touchedDetailed && updates.profileFullName === undefined) {
            fields.full_name = updates.name.trim() || null
          }

          if (Object.keys(fields).length > 0) {
            void (async () => {
              try {
                const supabase = createBrowserSupabaseClient()
                await updateProfileFields(supabase, prev.id, fields)
              } catch {
                /* локальный state уже обновлён */
              }
            })()
          }
        }
        return next
      })
    },
    [usesSupabase]
  )

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const trimmed = email.trim()
      if (!trimmed) {
        return { ok: false, message: "Укажите email." }
      }

      if (!usesSupabase) {
        await new Promise((r) => setTimeout(r, 900))
        return { ok: true }
      }

      const redirectTo = getPasswordRecoveryRedirectUrl()
      if (!redirectTo) {
        return {
          ok: false,
          message:
            "Не удалось сформировать ссылку восстановления. Задайте NEXT_PUBLIC_SITE_URL в .env.local (например http://localhost:3000) или откройте сайт по обычному адресу."
        }
      }

      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      if (error) {
        return { ok: false, message: translateSupabaseError(error.message) }
      }
      return { ok: true }
    },
    [usesSupabase]
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const loc = readStoredUiLocale()
      if (currentPassword.length < 6) {
        return { ok: false, message: formatUiMessage(loc, "auth.pwdCurrentShort") }
      }
      if (newPassword.length < 6) {
        return { ok: false, message: formatUiMessage(loc, "auth.pwdNewShort") }
      }

      if (usesSupabase) {
        const supabase = createBrowserSupabaseClient()
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
          return { ok: false, message: translateSupabaseError(error.message) }
        }
        return { ok: true, message: formatUiMessage(loc, "auth.pwdUpdatedDemo") }
      }

      await new Promise((r) => setTimeout(r, 600))
      return { ok: true, message: formatUiMessage(loc, "auth.pwdUpdatedDemo") }
    },
    [usesSupabase]
  )

  const busy = isLoading || (usesSupabase && !authReady)

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: busy,
        authReady,
        usesSupabase,
        profileError,
        clearProfileError,
        refreshProfile,
        login,
        register,
        logout,
        updateUser,
        changePassword,
        requestPasswordReset
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
