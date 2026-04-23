/** Уровень HSK в школе: 0–5, хранится в profiles.hsk_level. */

export const HSK_LEVEL_MIN = 0
export const HSK_LEVEL_MAX = 5

export function hskLevelRange(): number[] {
  return Array.from({ length: HSK_LEVEL_MAX - HSK_LEVEL_MIN + 1 }, (_, i) => HSK_LEVEL_MIN + i)
}

export function formatHskLevelShort(level: number | null | undefined): string {
  if (level === null || level === undefined || Number.isNaN(level)) return "—"
  return `HSK ${level}`
}
