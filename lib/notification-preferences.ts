export const NOTIFICATION_PREFERENCES_KEY = "chinachild-settings-notifications"

const PREFS_CHANGED_EVENT = "chinachild-notification-preferences-changed"

export type NotificationPreferences = {
  lessons: boolean
  homework: boolean
  messages: boolean
  news: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  lessons: true,
  homework: true,
  messages: true,
  news: false
}

export function readNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREFERENCES_KEY)
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    const p = JSON.parse(raw) as Partial<NotificationPreferences>
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...p }
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }
}

/** Сохранить и уведомить подписчиков (включая другие вкладки через storage). */
export function persistNotificationPreferences(prefs: NotificationPreferences) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(prefs))
  window.dispatchEvent(new Event(PREFS_CHANGED_EVENT))
}

export function subscribeNotificationPreferences(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}

  const handler = () => onChange()
  window.addEventListener(PREFS_CHANGED_EVENT, handler)
  const onStorage = (e: StorageEvent) => {
    if (e.key === NOTIFICATION_PREFERENCES_KEY) handler()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(PREFS_CHANGED_EVENT, handler)
    window.removeEventListener("storage", onStorage)
  }
}
