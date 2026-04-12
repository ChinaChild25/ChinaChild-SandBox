"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Bell, Camera, Check, Globe, Loader2, Lock, Moon, Palette, Sun, User } from "lucide-react"

import {
  applyUiAccentToDocument,
  persistUiAccent,
  readStoredUiAccent,
  type UiAccent
} from "@/components/app-providers"
import { LAST_LOGIN_STORAGE_KEY, useAuth } from "@/lib/auth-context"
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  persistNotificationPreferences,
  readNotificationPreferences,
  type NotificationPreferences
} from "@/lib/notification-preferences"
import { placeholderImages } from "@/lib/placeholders"
import type { UiLocale } from "@/lib/ui-messages"
import { localeToBcp47, useUiLocale } from "@/lib/ui-locale"

type AccentKey = "sage" | "pink" | "blue" | "orange"

function accentKeyFromStorage(): AccentKey {
  const a = readStoredUiAccent()
  if (a === "pink") return "pink"
  if (a === "blue") return "blue"
  if (a === "orange") return "orange"
  if (a === "sage") return "sage"
  return "sage"
}

function uiAccentFromKey(k: AccentKey): Exclude<UiAccent, "default"> {
  return k
}

function formatLastLogin(
  iso: string | null,
  locale: UiLocale,
  t: (k: string, p?: Record<string, string>) => string
): string {
  if (!iso) return t("settings.lastLoginNone")
  try {
    const d = new Date(iso)
    const s = d.toLocaleString(localeToBcp47(locale), {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
    return t("settings.lastLoginLine", { date: s, tz: t("settings.lastLoginTz") })
  } catch {
    return t("settings.lastLoginNone")
  }
}

function isDocumentDark(): boolean {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.contains("dark")
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

const ACCENT_TILES: { key: AccentKey; bg: string }[] = [
  { key: "sage", bg: "#d4e7b0" },
  { key: "pink", bg: "#f4c4c4" },
  { key: "blue", bg: "#c8dff4" },
  { key: "orange", bg: "#fce4c4" }
]

export default function SettingsPage() {
  const { user, updateUser, changePassword } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const { t, locale, setLocale } = useUiLocale()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [accentKey, setAccentKey] = useState<AccentKey>("sage")
  const [passwords, setPasswords] = useState({ cur: "", next: "", repeat: "" })
  const [profileSaved, setProfileSaved] = useState(false)
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const skipPersistNotificationsOnce = useRef(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone ?? "")
  }, [user])

  useEffect(() => {
    if (typeof window === "undefined") return
    setNotifications(readNotificationPreferences())
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return
    if (skipPersistNotificationsOnce.current) {
      skipPersistNotificationsOnce.current = false
      return
    }
    persistNotificationPreferences(notifications)
  }, [notifications, mounted])

  const applyLanguage = useCallback(
    (code: "ru" | "en" | "zh") => {
      setLocale(code)
    },
    [setLocale]
  )

  useEffect(() => {
    if (!mounted) return
    setAccentKey(accentKeyFromStorage())
  }, [mounted, resolvedTheme])

  const lastLoginIso =
    typeof window !== "undefined" ? window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY) : null

  const handleSaveProfile = () => {
    if (user) {
      updateUser({ name, email, phone: phone.trim() || undefined })
    }
    setProfileSaved(true)
    window.setTimeout(() => setProfileSaved(false), 2000)
  }

  const handleAccentPick = (k: AccentKey) => {
    setAccentKey(k)
    const ua = uiAccentFromKey(k) as UiAccent
    persistUiAccent(ua)
    const dark = resolvedTheme === "dark" || isDocumentDark()
    if (!dark) {
      applyUiAccentToDocument(ua)
    }
  }

  const handleThemePick = (mode: "light" | "dark") => {
    setTheme(mode)
    if (mode === "dark") {
      applyUiAccentToDocument("default")
    } else {
      applyUiAccentToDocument(uiAccentFromKey(accentKey))
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)
    if (passwords.next !== passwords.repeat) {
      setPwdMsg({ type: "err", text: t("settings.pwdMismatch") })
      return
    }
    setPwdBusy(true)
    const res = await changePassword(passwords.cur, passwords.next)
    setPwdBusy(false)
    if (res.ok) {
      setPasswords({ cur: "", next: "", repeat: "" })
      setPwdMsg({ type: "ok", text: res.message })
    } else {
      setPwdMsg({ type: "err", text: res.message })
    }
  }

  if (!user) return null

  const avatarSrc = user.avatar ?? placeholderImages.studentAvatar
  const levelKey = {
    Beginner: "profile.levelBeginner",
    Elementary: "profile.levelElementary",
    Intermediate: "profile.levelIntermediate",
    Advanced: "profile.levelAdvanced"
  }[user.level ?? "Beginner"] as string
  const subtitle = user.profileSubtitle ?? t("profile.subtitle", { level: t(levelKey) })
  const isDark = resolvedTheme === "dark"

  return (
    <div className="ds-figma-page ds-settings-page-bleed">
      <div className="ds-settings-v0-stack">
        <header className="ds-settings-page-header">
          <h1 className="ds-settings-page-title">{t("settings.title")}</h1>
          <p className="ds-settings-page-lead">{t("settings.lead")}</p>
        </header>

        <div className="ds-settings-panels-grid">
        <section className="ds-settings-panel" aria-labelledby="settings-profile-heading">
          <h2 id="settings-profile-heading" className="ds-settings-section-head">
            <User size={22} strokeWidth={1.75} aria-hidden />
            {t("settings.profile")}
          </h2>

          <div className="mb-6 flex items-center gap-4">
            <div className="relative">
              <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full bg-[#f2f2f2] dark:bg-ds-surface-pill">
                <Image
                  src={avatarSrc}
                  alt={t("settings.avatarAlt")}
                  fill
                  className="object-cover"
                  sizes="88px"
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
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"
                aria-label={t("settings.changePhoto")}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={15} aria-hidden />
              </button>
            </div>
            <div>
              <div className="text-[17px] font-semibold text-ds-ink">{name || user.name}</div>
              <div className="text-[14px] text-[#737373] dark:text-ds-text-tertiary">{subtitle}</div>
            </div>
          </div>

          <div className="space-y-4">
            <SettingsField label={t("settings.name")} value={name} onChange={setName} />
            <SettingsField label={t("settings.email")} value={email} onChange={setEmail} type="email" />
            <SettingsField
              label={t("settings.phone")}
              value={phone}
              onChange={setPhone}
              type="tel"
              placeholder={t("settings.phonePlaceholder")}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            className={`mt-6 h-12 w-full rounded-[var(--ds-radius-md)] text-[15px] font-semibold transition-colors ${
              profileSaved ? "bg-ds-sage-strong text-white" : "bg-black text-white hover:opacity-90 dark:bg-white dark:text-black"
            }`}
          >
            {profileSaved ? t("settings.saved") : t("settings.saveProfile")}
          </button>
        </section>

        <section className="ds-settings-panel" aria-labelledby="settings-security-heading">
          <h2 id="settings-security-heading" className="ds-settings-section-head">
            <Lock size={22} strokeWidth={1.75} aria-hidden />
            {t("settings.security")}
          </h2>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <SettingsField
              label={t("settings.currentPassword")}
              value={passwords.cur}
              onChange={(v) => setPasswords((p) => ({ ...p, cur: v }))}
              type="password"
              placeholder="••••••••"
            />
            <SettingsField
              label={t("settings.newPassword")}
              value={passwords.next}
              onChange={(v) => setPasswords((p) => ({ ...p, next: v }))}
              type="password"
              placeholder="••••••••"
            />
            <SettingsField
              label={t("settings.repeatPassword")}
              value={passwords.repeat}
              onChange={(v) => setPasswords((p) => ({ ...p, repeat: v }))}
              type="password"
              placeholder="••••••••"
            />

            {pwdMsg ? (
              <p
                className={`rounded-[var(--ds-radius-md)] px-4 py-2 text-[14px] ${
                  pwdMsg.type === "ok"
                    ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200"
                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200"
                }`}
              >
                {pwdMsg.text}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pwdBusy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-black text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {pwdBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("settings.updatePassword")}
            </button>
          </form>

          <p className="mt-5 text-[13px] text-[#a3a3a3] dark:text-ds-text-tertiary">
            {formatLastLogin(lastLoginIso, locale, t)}
          </p>
        </section>

        <section className="ds-settings-panel" aria-labelledby="settings-appearance-heading">
          <h2 id="settings-appearance-heading" className="ds-settings-section-head">
            <Palette size={22} strokeWidth={1.75} aria-hidden />
            {t("settings.appearance")}
          </h2>

          <p className="ds-settings-subtitle">{t("settings.theme")}</p>
          <div className="ds-settings-segmented mb-6">
            <button
              type="button"
              onClick={() => handleThemePick("light")}
              className={`ds-settings-segmented__btn ${!isDark ? "ds-settings-segmented__btn--active" : ""}`}
            >
              <Sun size={16} strokeWidth={2} aria-hidden />
              {t("settings.themeLight")}
            </button>
            <button
              type="button"
              onClick={() => handleThemePick("dark")}
              className={`ds-settings-segmented__btn ${isDark ? "ds-settings-segmented__btn--active" : ""}`}
            >
              <Moon size={16} strokeWidth={2} aria-hidden />
              {t("settings.themeDark")}
            </button>
          </div>

          <p className="ds-settings-subtitle">{t("settings.accent")}</p>
          <p className="mb-3 text-[12px] leading-snug text-ds-text-tertiary">{t("settings.accentHelp")}</p>
          <div className="ds-settings-accent-grid">
            {ACCENT_TILES.map((tile) => {
              const active = accentKey === tile.key
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => handleAccentPick(tile.key)}
                  className={`ds-settings-accent-tile ${active ? "ds-settings-accent-tile--active" : ""}`}
                  style={{ backgroundColor: tile.bg, color: "#1a1a1a" }}
                >
                  {active ? (
                    <span className="ds-settings-accent-check" aria-hidden>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                  {t(`accent.${tile.key}`)}
                </button>
              )
            })}
          </div>
        </section>

        <section className="ds-settings-panel" aria-labelledby="settings-notifications-heading">
          <h2 id="settings-notifications-heading" className="ds-settings-section-head">
            <Bell size={22} strokeWidth={1.75} aria-hidden />
            {t("settings.notifications")}
          </h2>

          <p className="mb-4 text-[12px] leading-snug text-ds-text-tertiary">{t("settings.notificationsHelp")}</p>

          <div className="space-y-4">
            {(
              [
                ["lessons", "settings.notifyLessons"],
                ["homework", "settings.notifyHomework"],
                ["messages", "settings.notifyMessages"],
                ["news", "settings.notifyNews"]
              ] as const
            ).map(([key, labelKey]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-[15px] text-ds-ink">{t(labelKey)}</span>
                <FigmaToggle
                  checked={notifications[key]}
                  onChange={(v) => setNotifications((n) => ({ ...n, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-[#ebebeb] pt-6 dark:border-white/10">
            <h3 className="ds-settings-section-head mb-4 mt-0 text-[1.05rem]">
              <Globe size={22} strokeWidth={1.75} className="text-ds-text-tertiary" aria-hidden />
              {t("settings.interfaceLanguage")}
            </h3>
            <div className="ds-settings-segmented">
              {(
                [
                  ["ru", "settings.langRu"],
                  ["en", "settings.langEn"],
                  ["zh", "settings.langZh"]
                ] as const
              ).map(([code, labKey]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => applyLanguage(code)}
                  className={`ds-settings-segmented__btn ${locale === code ? "ds-settings-segmented__btn--active" : ""}`}
                >
                  {t(labKey)}
                </button>
              ))}
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  )
}
