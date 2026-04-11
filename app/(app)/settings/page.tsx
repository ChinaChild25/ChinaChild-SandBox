"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Bell, Camera, Globe, Moon, Save, Shield } from "lucide-react"

import {
  applyUiAccentToDocument,
  persistUiAccent,
  readStoredUiAccent
} from "@/components/app-providers"
import { useAuth } from "@/lib/auth-context"
import { placeholderImages } from "@/lib/placeholders"
import type { User } from "@/lib/types"

const LEVEL_RU: Record<User["level"], string> = {
  Beginner: "Начинающий уровень",
  Elementary: "Базовый уровень",
  Intermediate: "Средний уровень",
  Advanced: "Продвинутый уровень"
}

function SettingsField({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="ds-settings-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ds-settings-input"
      />
    </div>
  )
}

function FigmaToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`ds-figma-toggle ${checked ? "ds-figma-toggle--on" : "ds-figma-toggle--off"}`}
    >
      <span className="ds-figma-toggle-knob" />
    </button>
  )
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("+7 999 123-45-67")
  const [language, setLanguage] = useState("ru")
  const [notifications, setNotifications] = useState({
    lessons: true,
    homework: true,
    messages: true,
    news: false
  })
  const [saved, setSaved] = useState(false)
  /** 0 светлая, 1 тёмная, 2 зелёный акцент, 3 розовый (как Figmadasboard SettingsPage) */
  const [appearanceIndex, setAppearanceIndex] = useState(0)
  const [passwords, setPasswords] = useState({ cur: "", next: "", repeat: "" })

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
  }, [user])

  useEffect(() => {
    if (!resolvedTheme) return
    if (resolvedTheme === "dark") {
      setAppearanceIndex(1)
      return
    }
    const accent = readStoredUiAccent()
    if (accent === "sage") setAppearanceIndex(2)
    else if (accent === "pink") setAppearanceIndex(3)
    else setAppearanceIndex(0)
  }, [resolvedTheme])

  const handleSave = () => {
    if (user) {
      updateUser({ name, email })
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  if (!user) return null

  const avatarSrc = user.avatar ?? placeholderImages.studentAvatar

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <div className="mb-7">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">Настройки</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Управление профилем и предпочтениями
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="ds-settings-panel">
            <div className="ds-settings-section-head">
              <Shield size={20} aria-hidden />
              Профиль
            </div>

            <div className="mb-6 flex items-center gap-4">
              <div className="relative">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-ds-sidebar">
                  <Image
                    src={avatarSrc}
                    alt="Аватар"
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized={avatarSrc.startsWith("data:")}
                  />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const url = String(reader.result ?? "")
                      if (url) updateUser({ avatar: url })
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ""
                  }}
                />
                <button
                  type="button"
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-ds-ink"
                  aria-label="Изменить фото"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera size={13} className="text-white" aria-hidden />
                </button>
              </div>
              <div>
                <div className="text-[16px] font-semibold text-ds-ink">{name || user.name}</div>
                <div className="text-[13px] text-ds-text-tertiary">{LEVEL_RU[user.level]}</div>
              </div>
            </div>

            <div className="space-y-4">
              <SettingsField label="Имя" value={name} onChange={setName} />
              <SettingsField label="Email" value={email} onChange={setEmail} type="email" />
              <SettingsField label="Телефон" value={phone} onChange={setPhone} type="tel" />
            </div>
          </div>

          <div className="ds-settings-panel">
            <div className="ds-settings-section-head">
              <Bell size={20} aria-hidden />
              Уведомления
            </div>

            <div className="space-y-4">
              {(
                [
                  ["lessons", "Напоминания о занятиях"],
                  ["homework", "Дедлайны домашних заданий"],
                  ["messages", "Новые сообщения"],
                  ["news", "Новости и акции"]
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-[15px] text-ds-text-quaternary">{label}</span>
                  <FigmaToggle
                    checked={notifications[key]}
                    onChange={(v) => setNotifications((n) => ({ ...n, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-ds-sidebar pt-5">
              <div className="ds-settings-section-head mb-4">
                <Globe size={20} aria-hidden />
                Язык интерфейса
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ru", "Русский"],
                    ["en", "English"],
                    ["zh", "中文"]
                  ] as const
                ).map(([code, lab]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code)}
                    className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                      language === code
                        ? "bg-ds-ink text-white"
                        : "bg-ds-sidebar text-ds-ink hover:bg-ds-sidebar-hover"
                    }`}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ds-settings-panel">
            <div className="ds-settings-section-head">
              <Shield size={20} aria-hidden />
              Безопасность
            </div>
            <div className="space-y-4">
              <SettingsField
                label="Текущий пароль"
                value={passwords.cur}
                onChange={(v) => setPasswords((p) => ({ ...p, cur: v }))}
                type="password"
                placeholder="••••••••"
              />
              <SettingsField
                label="Новый пароль"
                value={passwords.next}
                onChange={(v) => setPasswords((p) => ({ ...p, next: v }))}
                type="password"
                placeholder="••••••••"
              />
              <SettingsField
                label="Повторите пароль"
                value={passwords.repeat}
                onChange={(v) => setPasswords((p) => ({ ...p, repeat: v }))}
                type="password"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="ds-settings-panel">
            <div className="ds-settings-section-head">
              <Moon size={20} aria-hidden />
              Внешний вид
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { label: "Светлая", bg: "#ffffff", border: true, mode: "light" as const, accent: "default" as const },
                  { label: "Тёмная", bg: "#1a1a1a", text: "#fff", mode: "dark" as const, accent: "default" as const },
                  { label: "Зелёная", bg: "#d4e7b0", mode: "light" as const, accent: "sage" as const },
                  { label: "Розовая", bg: "#f4c4c4", mode: "light" as const, accent: "pink" as const }
                ] as const
              ).map((theme, i) => (
                <button
                  key={theme.label}
                  type="button"
                  onClick={() => {
                    setAppearanceIndex(i)
                    setTheme(theme.mode)
                    persistUiAccent(theme.accent)
                    if (theme.mode === "dark") {
                      applyUiAccentToDocument("default")
                    } else {
                      applyUiAccentToDocument(theme.accent)
                    }
                  }}
                  className={`rounded-2xl p-4 text-left transition-transform hover:scale-[1.02] ${
                    appearanceIndex === i ? "ring-2 ring-ds-ink dark:ring-white" : ""
                  }`}
                  style={{
                    backgroundColor: theme.bg,
                    color: theme.text ?? "#1a1a1a",
                    border: theme.border ? "1px solid #e8e8e8" : "none"
                  }}
                >
                  <span className="text-[14px]">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-2 rounded-2xl px-7 py-3 text-[15px] transition-colors ${
              saved ? "bg-ds-sage-strong text-white" : "bg-ds-ink text-white hover:bg-[#333333]"
            }`}
          >
            <Save size={17} aria-hidden />
            {saved ? "Сохранено!" : "Сохранить изменения"}
          </button>
        </div>
      </div>
    </div>
  )
}
