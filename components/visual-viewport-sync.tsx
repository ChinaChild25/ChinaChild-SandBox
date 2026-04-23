"use client"

import { useEffect } from "react"

const CSS_VAR = "--visual-viewport-height"

/**
 * iOS Safari после клавиатуры часто оставляет «ломаную» высоту по 100dvh/innerHeight.
 * Подставляем реальную высоту visualViewport в CSS-переменную для min-height оболочки и чата.
 */
export function VisualViewportSync() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    if (!vv) return

    const apply = () => {
      const h = Math.max(1, Math.round(vv.height))
      root.style.setProperty(CSS_VAR, `${h}px`)
    }

    apply()
    vv.addEventListener("resize", apply)
    vv.addEventListener("scroll", apply)
    window.addEventListener("resize", apply)
    window.addEventListener("orientationchange", apply)

    const onFocusOut = () => {
      window.requestAnimationFrame(() => {
        window.setTimeout(apply, 100)
        window.setTimeout(apply, 350)
      })
    }
    document.addEventListener("focusout", onFocusOut)

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) apply()
    }
    window.addEventListener("pageshow", onPageShow)

    return () => {
      vv.removeEventListener("resize", apply)
      vv.removeEventListener("scroll", apply)
      window.removeEventListener("resize", apply)
      window.removeEventListener("orientationchange", apply)
      document.removeEventListener("focusout", onFocusOut)
      window.removeEventListener("pageshow", onPageShow)
      root.style.removeProperty(CSS_VAR)
    }
  }, [])

  return null
}
