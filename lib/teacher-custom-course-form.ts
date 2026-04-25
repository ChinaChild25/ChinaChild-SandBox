import type { CSSProperties } from "react"

export const TEACHER_COURSE_HSK_LEVELS = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"] as const

export type CourseCoverSurfaceStyle = CSSProperties

/** Затемнение поверх фото — текст на обложке остаётся читаемым без «мыльного» блюра */
export const COURSE_COVER_PHOTO_SCRIM =
  "linear-gradient(135deg, rgb(0 0 0 / 0.52), rgb(0 0 0 / 0.22))"

/** Проверка URL для обложки (внешняя ссылка или путь к своему сайту). */
export function isAllowedExternalCoverImageUrl(raw: string): boolean {
  const s = raw.trim()
  if (!s || s.length > 2048) return false
  if (/[\r\n\t\f\v]/.test(s)) return false
  if (/[()]/.test(s)) return false
  try {
    const u = new URL(s)
    if (u.protocol === "https:") return true
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true
    return false
  } catch {
    return s.startsWith("/") && !s.includes("..")
  }
}

export function normalizeCoverImagePosition(raw: string | null | undefined): string {
  const s = (raw ?? "").trim()
  const m = /^(\d{1,3})% (\d{1,3})%$/.exec(s)
  if (m) {
    const x = Math.min(100, Math.max(0, parseInt(m[1]!, 10)))
    const y = Math.min(100, Math.max(0, parseInt(m[2]!, 10)))
    return `${x}% ${y}%`
  }
  return "50% 50%"
}

export type CourseCoverImageOptions = {
  url?: string | null
  position?: string | null
  scale?: number | null
  flipX?: boolean | null
  flipY?: boolean | null
}

export type NormalizedCourseCoverImageOptions = {
  url: string | null
  position: string
  scale: number
  flipX: boolean
  flipY: boolean
}

/** Фон обложки: фото (со скримом) или цвет / градиент. */
/** Удобная обёртка для полей курса из API */
export function courseCoverFromCourse(course: {
  cover_color?: string | null
  cover_image_url?: string | null
  cover_image_position?: string | null
  cover_image_scale?: number | null
  cover_image_flip_x?: boolean | null
  cover_image_flip_y?: boolean | null
}): CourseCoverSurfaceStyle {
  return courseCoverSurfaceStyle(course.cover_color)
}

function firstHexColorFromString(raw: string): string | null {
  const match = raw.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i)
  return match ? normalizeHexColor(match[0]) : null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function srgbChannelToLinear(value: number): number {
  const normalized = value / 255
  if (normalized <= 0.03928) return normalized / 12.92
  return ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const r = srgbChannelToLinear(rgb.r)
  const g = srgbChannelToLinear(rgb.g)
  const b = srgbChannelToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function mixedRgb(
  source: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
): { r: number; g: number; b: number } {
  const blend = (a: number, b: number) => Math.round(a * (1 - amount) + b * amount)
  return {
    r: blend(source.r, target.r),
    g: blend(source.g, target.g),
    b: blend(source.b, target.b),
  }
}

export function courseCoverTone(cover: string | null | undefined): "light" | "dark" {
  const raw = (cover ?? "").trim()
  const hex = normalizeHexColor(raw) ?? firstHexColorFromString(raw)
  if (!hex) return "light"
  const rgb = hexToRgb(hex)
  if (!rgb) return "light"
  return relativeLuminance(rgb) < 0.34 ? "dark" : "light"
}

export function courseBannerPalette(cover: string | null | undefined) {
  const tone = courseCoverTone(cover)
  if (tone === "dark") {
    return {
      tone,
      text: "#F8F7F4",
      muted: "rgb(248 247 244 / 0.82)",
      secondary: "rgb(248 247 244 / 0.72)",
      tertiary: "rgb(248 247 244 / 0.62)",
      chipBg: "rgb(255 255 255 / 0.16)",
      teacherCardBg: "rgb(255 255 255 / 0.16)",
      artworkSlotBg: "rgb(255 255 255 / 0.18)",
      progressTrack: "rgb(255 255 255 / 0.34)",
      divider: "rgb(255 255 255 / 0.18)",
    }
  }
  return {
    tone,
    text: "#171717",
    muted: "rgb(23 23 23 / 0.82)",
    secondary: "rgb(23 23 23 / 0.68)",
    tertiary: "rgb(23 23 23 / 0.58)",
    chipBg: "rgb(255 255 255 / 0.72)",
    teacherCardBg: "rgb(255 255 255 / 0.72)",
    artworkSlotBg: "rgb(255 255 255 / 0.34)",
    progressTrack: "rgb(255 255 255 / 0.7)",
    divider: "rgb(23 23 23 / 0.08)",
  }
}

export function courseAccentFromCourse(course: {
  cover_color?: string | null
  cover_image_url?: string | null
  cover_style?: string | null
}): string {
  const raw = (course.cover_color ?? "").trim()
  if (!raw) return "var(--ds-sage-strong)"

  const hex = normalizeHexColor(raw) ?? firstHexColorFromString(raw)
  if (!hex) return "var(--ds-sage-strong)"

  return `color-mix(in srgb, ${hex} 78%, black)`
}

export function normalizeCoverImageScale(raw: number | string | null | undefined): number {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseFloat(raw.trim())
        : Number.NaN
  if (!Number.isFinite(parsed)) return 1
  return Math.min(2.5, Math.max(1, parsed))
}

export function normalizeCoverImageFlip(raw: boolean | null | undefined): boolean {
  return raw === true
}

export function courseCoverImageFromCourse(course: {
  cover_image_url?: string | null
  cover_image_position?: string | null
  cover_image_scale?: number | null
  cover_image_flip_x?: boolean | null
  cover_image_flip_y?: boolean | null
}): NormalizedCourseCoverImageOptions {
  return {
    url: course.cover_image_url?.trim() || null,
    position: normalizeCoverImagePosition(course.cover_image_position),
    scale: normalizeCoverImageScale(course.cover_image_scale),
    flipX: normalizeCoverImageFlip(course.cover_image_flip_x),
    flipY: normalizeCoverImageFlip(course.cover_image_flip_y),
  }
}

export function courseCoverHasImage(course: {
  cover_image_url?: string | null
  cover_style?: string | null
}): boolean {
  return Boolean(course.cover_image_url?.trim())
}

export function courseCoverSurfaceStyle(
  cover: string | null | undefined,
  _image?: CourseCoverImageOptions | null
): CourseCoverSurfaceStyle {
  const raw = (cover ?? "").trim()
  if (!raw) return { backgroundColor: "var(--ds-neutral-row)" }
  if (raw.toLowerCase().includes("gradient")) return { background: raw }
  return { backgroundColor: raw }
}

function muteHexColorForDarkTheme(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const subdued = mixedRgb(rgb, { r: 18, g: 18, b: 20 }, 0.42)
  return `#${subdued.r.toString(16).padStart(2, "0")}${subdued.g.toString(16).padStart(2, "0")}${subdued.b
    .toString(16)
    .padStart(2, "0")}`.toUpperCase()
}

export function mutedCoverColorForDarkTheme(cover: string | null | undefined): string | null {
  const raw = (cover ?? "").trim()
  if (!raw) return null
  if (raw.toLowerCase().includes("gradient")) {
    return raw.replace(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi, (value) => {
      const normalized = normalizeHexColor(value)
      return normalized ? muteHexColorForDarkTheme(normalized) : value
    })
  }
  const hex = normalizeHexColor(raw)
  if (!hex) return raw
  return muteHexColorForDarkTheme(hex)
}

export function courseCoverSurfaceStyleForTheme(
  cover: string | null | undefined,
  isDark: boolean,
): CourseCoverSurfaceStyle {
  if (!isDark) return courseCoverSurfaceStyle(cover)
  const muted = mutedCoverColorForDarkTheme(cover)
  return courseCoverSurfaceStyle(muted ?? cover)
}

export function courseCoverFromCourseForTheme(
  course: {
    cover_color?: string | null
    cover_image_url?: string | null
    cover_image_position?: string | null
    cover_image_scale?: number | null
    cover_image_flip_x?: boolean | null
    cover_image_flip_y?: boolean | null
  },
  isDark: boolean,
): CourseCoverSurfaceStyle {
  return courseCoverSurfaceStyleForTheme(course.cover_color, isDark)
}

export function courseAccentForTheme(accent: string, isDark: boolean): string {
  if (!isDark) return accent
  return `color-mix(in srgb, ${accent} 68%, #0f0f11)`
}

export function courseCardTextPaletteForTheme(
  cover: string | null | undefined,
  isDark: boolean,
): {
  text: string
  meta: string
  helper: string
  iconBg: string
} {
  if (isDark) {
    return {
      text: "#F4F4F5",
      meta: "rgb(244 244 245 / 0.84)",
      helper: "rgb(244 244 245 / 0.72)",
      iconBg: "rgb(255 255 255 / 0.16)",
    }
  }
  const palette = courseBannerPalette(cover)
  if (palette.tone === "dark") {
    return {
      text: "#F8F7F4",
      meta: "rgb(248 247 244 / 0.82)",
      helper: "rgb(248 247 244 / 0.72)",
      iconBg: "rgb(255 255 255 / 0.16)",
    }
  }
  return {
    text: "#171717",
    meta: "rgb(23 23 23 / 0.74)",
    helper: "rgb(23 23 23 / 0.62)",
    iconBg: "rgb(255 255 255 / 0.58)",
  }
}

export const TEACHER_COURSE_COVER_PALETTE = [
  "linear-gradient(120deg, #3b82f6, #8b5cf6)",
  "linear-gradient(120deg, #0ea5e9, #14b8a6)",
  "linear-gradient(120deg, #f97316, #ef4444)",
  "linear-gradient(120deg, #22c55e, #16a34a)",
  "linear-gradient(120deg, #ec4899, #8b5cf6)",
  "linear-gradient(120deg, #64748b, #334155)"
] as const

export function parseLevelForCourseForm(level: string | null | undefined): {
  selectValue: string
  levelCustom: string
} {
  const raw = (level ?? "").trim()
  if (!raw) return { selectValue: "HSK1", levelCustom: "" }
  if ((TEACHER_COURSE_HSK_LEVELS as readonly string[]).includes(raw)) {
    return { selectValue: raw, levelCustom: "" }
  }
  return { selectValue: "custom", levelCustom: raw }
}

export function isTeacherCourseCoverPreset(value: string): boolean {
  return (TEACHER_COURSE_COVER_PALETTE as readonly string[]).includes(value.trim())
}

export function coverStyleForStoredColor(value: string): "gradient" | "solid" {
  return isTeacherCourseCoverPreset(value) ? "gradient" : "solid"
}

export function coverStyleForCourseSave(opts: { hasPhoto: boolean; coverColor: string }): "gradient" | "solid" {
  return coverStyleForStoredColor(opts.coverColor)
}

/** Принимает `#RGB`, `#RRGGBB` или `RRGGBB`; возвращает нормализованный `#RRGGBB` или null. */
export function normalizeHexColor(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  if (!s.startsWith("#")) s = `#${s}`
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return null
  if (s.length === 4) {
    const r = s[1]!
    const g = s[2]!
    const b = s[3]!
    s = `#${r}${r}${g}${g}${b}${b}`
  }
  return s.toUpperCase()
}

/** Для `<input type="color" />` — всегда 7 символов #RRGGBB. */
export function hexForColorInput(raw: string): string {
  const n = normalizeHexColor(raw)
  if (n) return n
  return "#64748B"
}
