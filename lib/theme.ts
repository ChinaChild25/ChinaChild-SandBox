/**
 * ChinaChild design tokens — aligned with approved-ui-kit.html + HSK block-01-core.
 * Use these keys in TS; map to CSS variables in styles/cc-design-system.css.
 * Do not scatter magic numbers in components — extend this file first.
 */

export const theme = {
  colors: {
    primary: "#1e2b37",
    onPrimary: "#ffffff",
    primaryContainer: "#dde7f2",
    onPrimaryContainer: "#13222f",
    surface: "#f4f6fb",
    surfaceBright: "#fbfcff",
    onSurface: "#171c23",
    onSurfaceVariant: "#56606d",
    outline: "#aab3bd",
    outlineVariant: "#d5dbe3",
    error: "#ba1a1a",
    onError: "#ffffff",
    /** HSK lesson module (block-01-core) */
    hskAccent: "#1a1a1a",
    hskMuted: "rgba(23,23,23,0.62)",
    hskCard: "rgba(255,255,255,0.98)",
    hskBg: "#f5f6f8",
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
    fontDisplay: '"Lab Grotesque", "LabGrotesque", var(--font-inter), system-ui, sans-serif',
    fontBody: '"Lab Grotesque", "LabGrotesque", var(--font-inter), system-ui, sans-serif',
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
