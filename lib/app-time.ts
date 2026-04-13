/**
 * «Сейчас» в приложении: календарная дата зафиксирована на сценарий апреля 2026,
 * время суток берётся с устройства пользователя (часы идут в реальном времени).
 * Так расписание и правило 24 ч согласованы с моками, даже если системные даты другие.
 *
 * Важно: экран переноса ученика (nextDaysFromAppNow, запрос /api/schedule?from&to) должен
 * опираться на getAppNow / getAppTodayStart, а не на new Date(), иначе dateKey не совпадут
 * с isValidRescheduleTargetSlot и список слотов будет пустым.
 */
export const APP_REFERENCE_YEAR = 2026
/** Апрель = 3 (JS) */
export const APP_REFERENCE_MONTH = 3
/** Текущий день сценария в апреле 2026 */
export const APP_REFERENCE_DAY = 12

export function getAppNow(): Date {
  const real = new Date()
  return new Date(
    APP_REFERENCE_YEAR,
    APP_REFERENCE_MONTH,
    APP_REFERENCE_DAY,
    real.getHours(),
    real.getMinutes(),
    real.getSeconds(),
    real.getMilliseconds()
  )
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
