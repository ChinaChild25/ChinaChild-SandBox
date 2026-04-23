"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  formatUiMessage,
  localeToBcp47,
  localeToHtmlLang,
  readStoredUiLocale,
  UI_LANG_STORAGE_KEY,
  type UiLocale
} from "@/lib/ui-messages"

export type { UiLocale }
export { UI_LANG_STORAGE_KEY, readStoredUiLocale, formatUiMessage, localeToBcp47, localeToHtmlLang }

type UiLocaleContextValue = {
  locale: UiLocale
  setLocale: (next: UiLocale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null)

export function UiLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>("ru")

  useEffect(() => {
    setLocaleState(readStoredUiLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = localeToHtmlLang(locale)
  }, [locale])

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UI_LANG_STORAGE_KEY, next)
      document.documentElement.lang = localeToHtmlLang(next)
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string>) => formatUiMessage(locale, key, params),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
}

export function useUiLocale(): UiLocaleContextValue {
  const ctx = useContext(UiLocaleContext)
  if (!ctx) {
    throw new Error("useUiLocale must be used within UiLocaleProvider")
  }
  return ctx
}
