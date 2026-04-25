export function buildLessonCallHref(lessonId: string): string {
  return `/lesson/${encodeURIComponent(lessonId)}?join=1`
}

export function buildScheduleCallHref(scheduleSlotId: string, backTo?: string): string {
  const base = `/call/schedule/${encodeURIComponent(scheduleSlotId)}`
  if (!backTo?.trim()) return base

  const params = new URLSearchParams({ backTo })
  return `${base}?${params.toString()}`
}
