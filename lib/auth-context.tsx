"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { User, UserRole } from "./types"
import { mockTeacherUser, mockUser } from "./mock-data"
import { formatUiMessage, readStoredUiLocale } from "./ui-messages"

export const LAST_LOGIN_STORAGE_KEY = "chinachild-last-login"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, role?: UserRole) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  /** Демо: смена пароля без бэкенда */
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; message: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (email: string, password: string, role: UserRole = "student"): Promise<boolean> => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    // Mock validation - in production, this would be a real API call
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
      return true
    }
    setIsLoading(false)
    return false
  }, [])

  const register = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1200))
    
    // Mock registration - in production, this would be a real API call
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
      return true
    }
    setIsLoading(false)
    return false
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await new Promise((r) => setTimeout(r, 600))
    const loc = readStoredUiLocale()
    if (currentPassword.length < 6) {
      return { ok: false, message: formatUiMessage(loc, "auth.pwdCurrentShort") }
    }
    if (newPassword.length < 6) {
      return { ok: false, message: formatUiMessage(loc, "auth.pwdNewShort") }
    }
    return { ok: true, message: formatUiMessage(loc, "auth.pwdUpdatedDemo") }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        changePassword
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
