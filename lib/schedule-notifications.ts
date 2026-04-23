"use client"

export type ScheduleNotificationAudience = "teacher" | "student"

export type ScheduleNotificationItem = {
  id: string
  at: string
  title: string
  message: string
  read: boolean
  studentName?: string
  fromLabel?: string
  toLabel?: string
  targetDateKey?: string
}

const STORAGE_KEY = "chinachild-schedule-notifications-v1"
const CHANGED_EVENT = "chinachild-schedule-notifications-changed"

function audienceKey(audience: ScheduleNotificationAudience, audienceId?: string) {
  return audienceId ? `${audience}:${audienceId}` : `${audience}:global`
}

function readAll(): Record<string, ScheduleNotificationItem[]> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ScheduleNotificationItem[]>) : {}
  } catch {
    return {}
  }
}

function writeAll(value: Record<string, ScheduleNotificationItem[]>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

export function pushScheduleNotification(input: {
  audience: ScheduleNotificationAudience
  audienceId?: string
  title: string
  message: string
  studentName?: string
  fromLabel?: string
  toLabel?: string
  targetDateKey?: string
}) {
  if (typeof window === "undefined") return
  const all = readAll()
  const key = audienceKey(input.audience, input.audienceId)
  const list = all[key] ?? []
  const next: ScheduleNotificationItem[] = [
    {
      id: `schedule-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      title: input.title,
      message: input.message,
      read: false,
      studentName: input.studentName,
      fromLabel: input.fromLabel,
      toLabel: input.toLabel,
      targetDateKey: input.targetDateKey
    },
    ...list
  ].slice(0, 50)
  all[key] = next
  writeAll(all)
}

export function readScheduleNotifications(audience: ScheduleNotificationAudience, audienceId?: string) {
  const all = readAll()
  const scoped = all[audienceKey(audience, audienceId)] ?? []
  const global = all[audienceKey(audience)] ?? []
  const merged = [...scoped, ...global]
  return merged
    .map((item) => normalizeNotificationItem(item))
    .filter((item) =>
      audience === "teacher"
        ? !(
            item.title === "Изменение в расписании ученика" &&
            !item.studentName &&
            !item.fromLabel &&
            !item.toLabel
          )
        : true
    )
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
}

export function markScheduleNotificationsRead(audience: ScheduleNotificationAudience, audienceId?: string) {
  const all = readAll()
  const keys = [audienceKey(audience, audienceId), audienceKey(audience)]
  for (const key of keys) {
    const list = all[key] ?? []
    all[key] = list.map((x) => ({ ...x, read: true }))
  }
  writeAll(all)
}

export function subscribeScheduleNotifications(cb: () => void) {
  if (typeof window === "undefined") return () => {}
  const handler = () => cb()
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb()
  }
  window.addEventListener(CHANGED_EVENT, handler)
  window.addEventListener("storage", storageHandler)
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler)
    window.removeEventListener("storage", storageHandler)
  }
}

function normalizeNotificationItem(item: ScheduleNotificationItem): ScheduleNotificationItem {
  if (item.studentName && item.fromLabel && item.toLabel) return item
  const match = item.message.match(/^(.+?):\s(.+)\s→\s(.+)$/)
  if (!match) return item
  const [, studentName, fromLabel, toLabel] = match
  return {
    ...item,
    studentName: item.studentName ?? studentName.trim(),
    fromLabel: item.fromLabel ?? fromLabel.trim(),
    toLabel: item.toLabel ?? toLabel.trim()
  }
}
