export const SCHEDULE_POLICY = {
  /** Студенту разрешено только если до начала строго больше 24 часов. */
  studentMinLeadMs: 24 * 60 * 60 * 1000,
  studentLeadPolicy: "STRICT_GT_24H",
  studentSingleBookingHorizonDays: 7,
  studentWeeklyAnchorHorizonDays: 14,
  studentFollowingRescheduleHorizonDays: 42,
  /** Пустой weekly template преподавателя трактуем как отсутствие доступных слотов. */
  emptyTemplatePolicy: "no_slots"
} as const

