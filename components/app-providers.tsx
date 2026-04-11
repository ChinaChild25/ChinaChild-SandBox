"use client"

import { useEffect } from "react"

import { ThemeProvider } from "@/components/theme-provider"

const UI_ACCENT_KEY = "chinachild-ui-accent"
const THEME_STORAGE_KEY = "chinachild-theme"

export function readStoredUiAccent(): "default" | "sage" | "pink" | null {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(UI_ACCENT_KEY)
  if (v === "sage" || v === "pink" || v === "default") return v
  return null
}

export function persistUiAccent(accent: "default" | "sage" | "pink") {
  if (typeof window === "undefined") return
  window.localStorage.setItem(UI_ACCENT_KEY, accent)
}

export function applyUiAccentToDocument(accent: "default" | "sage" | "pink") {
  const root = document.documentElement
  if (accent === "default") root.removeAttribute("data-ui-accent")
  else root.setAttribute("data-ui-accent", accent)
}

/** Только светлая тема: сбрасываем тёмный класс и старые сохранения. */
function LightThemeLock() {
  useEffect(() => {
    document.documentElement.classList.remove("dark")
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, "light")
    } catch {
      /* ignore */
    }
  }, [])
  return null
}

function UiAccentHydration() {
  useEffect(() => {
    const accent = readStoredUiAccent()
    if (!accent || accent === "default") return
    applyUiAccentToDocument(accent)
  }, [])
  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
    >
      <LightThemeLock />
      <UiAccentHydration />
      {children}
    </ThemeProvider>
  )
}
