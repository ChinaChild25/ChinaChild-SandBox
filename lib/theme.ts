/**
 * ChinaChild design tokens — aligned with approved-ui-kit.html + HSK block-01-core.
 * Use these keys in TS; map to CSS variables in styles/cc-design-system.css.
 * Do not scatter magic numbers in components — extend this file first.
 */

export const theme = {
  colors: {
    /** Aligned with ds-figma-tokens / dashboard shell */
    primary: "#1a1a1a",
    onPrimary: "#ffffff",
    primaryContainer: "#e8e8e8",
    onPrimaryContainer: "#1a1a1a",
    surface: "#f5f5f5",
    surfaceBright: "#ffffff",
    onSurface: "#1a1a1a",
    onSurfaceVariant: "#666666",
    outline: "rgba(0,0,0,0.12)",
    outlineVariant: "rgba(0,0,0,0.08)",
    error: "#ba1a1a",
    onError: "#ffffff",
    /** HSK lesson module (block-01-core) */
    hskAccent: "#1a1a1a",
    hskMuted: "rgba(26,26,26,0.62)",
    hskCard: "rgba(255,255,255,0.98)",
    hskBg: "#f5f5f5",
    hskOrange: "#ff7a45",
    hskGreen: "#5db87c",
    hskBlue: "#3e7bfa",
    hskYellow: "#f0b542"
  },
  spacing: {
    /** 4px grid */
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 18,
    xl: 22,
    "2xl": 24,
    "3xl": 28,
    "4xl": 32,
    section: 40
  },
  radius: {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 28,
    xl: 34,
    pill: 999
  },
  typography: {
    fontDisplay: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
    fontBody: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
    /** px at 16px root */
    eyebrow: 12,
    body: 16,
    bodyLarge: 17,
    titleSm: 24,
    titleMd: 28,
    titleLg: 44,
    display: 62
  },
  motion: {
    fastMs: 140,
    baseMs: 220,
    slowMs: 380,
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  },
  layout: {
    contentMaxWidth: 1180,
    sidebarWidth: 280,
    tapMinHeight: 48
  }
} as const

export type Theme = typeof theme
