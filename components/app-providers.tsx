"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

import { ThemeProvider } from "@/components/theme-provider"

const UI_ACCENT_KEY = "chinachild-ui-accent"
export const THEME_STORAGE_KEY = "chinachild-theme"

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

/** Акценты фона только для светлой темы; в тёмной отключаем. */
function ThemeAccentSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!resolvedTheme) return
    if (resolvedTheme === "dark") {
      document.documentElement.removeAttribute("data-ui-accent")
      return
    }
    const accent = readStoredUiAccent()
    if (!accent || accent === "default") {
      document.documentElement.removeAttribute("data-ui-accent")
    } else {
      applyUiAccentToDocument(accent)
    }
  }, [resolvedTheme])

  return null
}

function UiAccentHydration() {
  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) return
    const accent = readStoredUiAccent()
    if (accent && accent !== "default") applyUiAccentToDocument(accent)
  }, [])
  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
    >
      <UiAccentHydration />
      <ThemeAccentSync />
      {children}
    </ThemeProvider>
  )
}
