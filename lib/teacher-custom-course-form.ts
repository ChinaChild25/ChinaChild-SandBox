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
}

/** Фон обложки: фото (со скримом) или цвет / градиент. */
/** Удобная обёртка для полей курса из API */
export function courseCoverFromCourse(course: {
  cover_color?: string | null
  cover_image_url?: string | null
  cover_image_position?: string | null
}): CourseCoverSurfaceStyle {
  return courseCoverSurfaceStyle(course.cover_color, {
    url: course.cover_image_url,
    position: course.cover_image_position
  })
}

export function courseCoverSurfaceStyle(
  cover: string | null | undefined,
  image?: CourseCoverImageOptions | null
): CourseCoverSurfaceStyle {
  const urlRaw = (image?.url ?? "").trim()
  if (urlRaw && isAllowedExternalCoverImageUrl(urlRaw)) {
    const pos = normalizeCoverImagePosition(image?.position)
    const safeUrl = urlRaw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    return {
      backgroundImage: `${COURSE_COVER_PHOTO_SCRIM}, url("${safeUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: pos,
      backgroundRepeat: "no-repeat",
      backgroundColor: "var(--ds-neutral-row)"
    }
  }

  const raw = (cover ?? "").trim()
  if (!raw) return { backgroundColor: "var(--ds-neutral-row)" }
  if (raw.toLowerCase().includes("gradient")) return { background: raw }
  return { backgroundColor: raw }
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

export function coverStyleForCourseSave(opts: { hasPhoto: boolean; coverColor: string }): "photo" | "gradient" | "solid" {
  if (opts.hasPhoto) return "photo"
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
