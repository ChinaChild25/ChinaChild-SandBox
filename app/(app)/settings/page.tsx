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
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { updateProfileFields } from "@/lib/supabase/profile"
import { uploadUserAvatar } from "@/lib/supabase/upload-avatar"
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
  placeholder,
  readOnly,
  hint
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
  readOnly?: boolean
  hint?: string
}) {
  return (
    <div>
      <label className="ds-settings-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        placeholder={placeholder}
        className={`ds-settings-input ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
      />
      {hint ? <p className="mt-1 text-[12px] text-ds-text-tertiary">{hint}</p> : null}
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
  const { user, updateUser, changePassword, usesSupabase, refreshProfile } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const { t, locale, setLocale } = useUiLocale()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [displayFullName, setDisplayFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [accentKey, setAccentKey] = useState<AccentKey>("sage")
  const [passwords, setPasswords] = useState({ cur: "", next: "", repeat: "" })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaveOk, setProfileSaveOk] = useState(false)
  const [profileSaveErr, setProfileSaveErr] = useState<string | null>(null)
  const [profileBannerErr, setProfileBannerErr] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarErr, setAvatarErr] = useState<string | null>(null)
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const skipPersistNotificationsOnce = useRef(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ").filter(Boolean)
    setFirstName(user.firstName ?? parts[0] ?? "")
    setLastName(user.lastName ?? parts.slice(1).join(" ") ?? "")
    setDisplayFullName(user.profileFullName ?? "")
    setPhone(user.phone ?? "")
  }, [user])

  useEffect(() => {
    if (!usesSupabase || !user) return
    let alive = true
    void refreshProfile().then((r) => {
      if (!alive) return
      if (r.ok) setProfileBannerErr(null)
      else setProfileBannerErr(r.message ?? "Не удалось загрузить профиль.")
    })
    return () => {
      alive = false
    }
  }, [usesSupabase, user?.id, refreshProfile])

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

  const handleSaveProfile = async () => {
    if (!user) return
    setProfileSaveErr(null)
    setProfileSaveOk(false)
    setProfileBannerErr(null)

    const full =
      displayFullName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim()

    if (!usesSupabase) {
      updateUser({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        profileFullName: displayFullName.trim() || undefined,
        name: full || user.name,
        phone: phone.trim() || undefined
      })
      setProfileSaveOk(true)
      window.setTimeout(() => setProfileSaveOk(false), 2500)
      return
    }

    setProfileSaving(true)
    const supabase = createBrowserSupabaseClient()
    const { error } = await updateProfileFields(supabase, user.id, {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      full_name: full || null,
      phone: phone.trim() || null
    })
    setProfileSaving(false)

    if (error) {
      setProfileSaveErr(error.message)
      return
    }

    const r = await refreshProfile()
    if (!r.ok) {
      setProfileSaveErr(r.message ?? "Сохранено, но не удалось обновить профиль в интерфейсе.")
      return
    }

    setProfileSaveOk(true)
    window.setTimeout(() => setProfileSaveOk(false), 2500)
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
  const authEmail = user.email
  const levelKey = {
    Beginner: "profile.levelBeginner",
    Elementary: "profile.levelElementary",
    Intermediate: "profile.levelIntermediate",
    Advanced: "profile.levelAdvanced"
  }[user.level ?? "Beginner"] as string
  const subtitle =
    user.role === "teacher"
      ? (user.profileSubtitle ?? "Преподаватель")
      : (user.profileSubtitle ?? t("profile.subtitle", { level: t(levelKey) }))
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

            {profileBannerErr ? (
              <div
                className="mb-5 rounded-[var(--ds-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-900 dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-100"
                role="alert"
              >
                {profileBannerErr}
              </div>
            ) : null}

            <div className="mb-6 flex items-center gap-4">
            <div className="relative">
              <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06)] dark:bg-[#2c2c32] dark:shadow-[0_1px_2px_rgb(0_0_0/0.25)]">
                <Image
                  src={avatarSrc}
                  alt={t("settings.avatarAlt")}
                  fill
                  className="object-cover"
                  sizes="88px"
                  unoptimized={
                    avatarSrc.startsWith("data:") ||
                    avatarSrc.startsWith("http") ||
                    avatarSrc.includes("supabase.co")
                  }
                />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={avatarBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file || !user) return
                  setAvatarErr(null)
                  if (usesSupabase) {
                    void (async () => {
                      setAvatarBusy(true)
                      const supabase = createBrowserSupabaseClient()
                      const up = await uploadUserAvatar(supabase, user.id, file)
                      if (!up.ok) {
                        setAvatarErr(up.message)
                        setAvatarBusy(false)
                        e.target.value = ""
                        return
                      }
                      const { error } = await updateProfileFields(supabase, user.id, {
                        avatar_url: up.publicUrl
                      })
                      if (error) {
                        setAvatarErr(error.message)
                        setAvatarBusy(false)
                        e.target.value = ""
                        return
                      }
                      const r = await refreshProfile()
                      if (!r.ok) setAvatarErr(r.message ?? "Аватар загружен, но профиль не обновился.")
                      setAvatarBusy(false)
                      e.target.value = ""
                    })()
                  } else {
                    const reader = new FileReader()
                    reader.onload = () => {
                      const url = String(reader.result ?? "")
                      if (url) updateUser({ avatar: url })
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ""
                  }
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
              <div className="text-[17px] font-semibold text-ds-ink">
                {displayFullName.trim() || `${firstName} ${lastName}`.trim() || user.name}
              </div>
              <div className="text-[14px] text-[#737373] dark:text-ds-text-tertiary">{subtitle}</div>
              {usesSupabase ? (
                <p className="mt-2 text-[12px] text-ds-text-tertiary">Роль в системе: {user.role === "teacher" ? "преподаватель" : "ученик"}</p>
              ) : null}
            </div>
          </div>

          {avatarErr ? (
            <p className="mb-3 text-[13px] text-red-600 dark:text-red-300" role="alert">
              {avatarErr}
            </p>
          ) : null}

          <div className="space-y-4">
            <SettingsField label="Имя" value={firstName} onChange={setFirstName} />
            <SettingsField label="Фамилия" value={lastName} onChange={setLastName} />
            <SettingsField
              label="Полное имя (необязательно)"
              value={displayFullName}
              onChange={setDisplayFullName}
              hint="Если пусто, для отображения используется «Имя + Фамилия»."
            />
            <SettingsField
              label={t("settings.email")}
              value={authEmail}
              readOnly
              hint={usesSupabase ? "Email из Supabase Auth. Изменение — через сброс пароля / поддержку." : undefined}
            />
            <SettingsField
              label={t("settings.phone")}
              value={phone}
              onChange={setPhone}
              type="tel"
              placeholder={t("settings.phonePlaceholder")}
            />
          </div>

          {profileSaveErr ? (
            <p className="mt-4 text-[14px] text-red-600 dark:text-red-300" role="alert">
              {profileSaveErr}
            </p>
          ) : null}
          {profileSaveOk ? (
            <p className="mt-4 text-[14px] text-ds-sage-strong dark:text-green-300" role="status">
              {t("settings.saved")}
            </p>
          ) : null}

          <button
            type="button"
            disabled={profileSaving || avatarBusy}
            onClick={() => void handleSaveProfile()}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-black text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {profileSaving ? "Сохранение…" : t("settings.saveProfile")}
          </button>
        </section>

        <section className="ds-settings-panel" aria-labelledby="settings-security-heading">
          <h2 id="settings-security-heading" className="ds-settings-section-head">
            <Lock size={22} strokeWidth={1.75} aria-hidden />
            {t("settings.security")}
          </h2>
          <p className="mb-4 text-[13px] leading-snug text-ds-text-tertiary">
            Пароль хранится только в{" "}
            <strong className="font-medium text-ds-ink">Supabase Auth</strong>, не в таблице profiles. Ниже —
            обновление пароля через Auth API (как в продакшене).
          </p>

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
