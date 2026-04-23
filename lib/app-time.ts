/**
 * Единый источник текущего времени приложения.
 * В прод-режиме всегда используем реальное «сейчас» пользователя/сервера,
 * иначе валидация «слот в будущем» и разметка upcoming/past расходятся.
 */
const BOOT_NOW = new Date()
// Backward-compatible exports for modules that still import reference constants.
export const APP_REFERENCE_YEAR = BOOT_NOW.getFullYear()
export const APP_REFERENCE_MONTH = BOOT_NOW.getMonth()
export const APP_REFERENCE_DAY = BOOT_NOW.getDate()

export function getAppNow(): Date {
  return new Date()
}

/** Полночь «сегодня» по логике приложения */
export function getAppTodayStart(): Date {
  const n = getAppNow()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0)
}

/** Номер дня в месяце, если «сегодня» внутри указанного года/месяца (month 0-based), иначе null */
export function getAppDayInMonth(year: number, month0: number): number | null {
  const n = getAppNow()
  if (n.getFullYear() === year && n.getMonth() === month0) return n.getDate()
  return null
}
