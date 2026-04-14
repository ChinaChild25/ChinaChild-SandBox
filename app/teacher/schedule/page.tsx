"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Ban,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clipboard,
  ClipboardPaste,
  Copy,
  Loader2,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  X
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getAppNow } from "@/lib/app-time"
import { firstRecurringSlotDateKey } from "@/lib/schedule/calendar-ymd"
import { isFirstScheduledSlotInPast, nextEligibleStartDateKey } from "@/lib/schedule/recurring-slot-eligibility"
import { isValidTeacherRescheduleTargetSlot } from "@/lib/schedule-lessons"
import { addDays, buildHourlyIsoSlots, startOfWeekMonday } from "@/lib/teacher-schedule"
import {
  type AvailabilityInterval,
  emptyWeeklyTemplate,
  hourlyStatusesToIntervals,
  intervalsToHourlyStatuses,
  normalizeIntervals,
  weekdayFromDate,
  type SlotStatus,
  type WeekdayKey,
  type WeeklyTemplate
} from "@/lib/teacher-availability-template"
import {
  markScheduleNotificationsRead,
  pushScheduleNotification,
  readScheduleNotifications,
  subscribeScheduleNotifications,
  type ScheduleNotificationItem
} from "@/lib/schedule-notifications"

type SlotMeta = {
  status: SlotStatus
  studentName: string | null
}

type ExternalLesson = {
  slot_at: string
  date_key?: string
  time?: string
  title: string
  student_name: string
  student_avatar_url?: string
  student_id?: string
  type?: "lesson" | "completed" | "charged_absence" | string
}

/** Подсветка занятия на сетке после выбора из поиска */
type ScheduleSearchPulse =
  | { kind: "booked"; dateKey: string; startHour: number; endHourExclusive: number }
  | { kind: "external"; slotAt: string }

type StudentOption = {
  id: string
  name: string
}

type DragState = {
  dayIdx: number
  startHour: number
  endHour: number
}

const ROW_HEIGHT = 34
const SLOT_HEIGHT = 32
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`)
const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h + 1).padStart(2, "0")}:00`)
const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const WEEKDAY_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

/** Дательный падеж мн.ч. для «по понедельникам, …» */
const WEEKDAY_RU_DATIVE_PLURAL = [
  "воскресеньям",
  "понедельникам",
  "вторникам",
  "средам",
  "четвергам",
  "пятницам",
  "субботам"
]

function formatDateKeyLongRuForHint(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return dateKey
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(dt)
}

/** День недели 0–6 (Вс–Сб), как в create-event и `Date.getUTCDay()`. */
function jsWeekdayFromYmd(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return 1
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
}
const WEEKDAY_KEYS_ORDER: WeekdayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const TIMEZONE_OPTIONS = [
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Kiev",
  "Asia/Almaty",
  "Asia/Dubai",
  "Asia/Tbilisi",
  "Asia/Yerevan",
  "Asia/Baku",
  "Asia/Tashkent",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland"
]

export default function TeacherSchedulePage() {
  const { user } = useAuth()
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week">("week")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [template, setTemplate] = useState<WeeklyTemplate>(emptyWeeklyTemplate())
  const [slotMap, setSlotMap] = useState<Record<string, SlotMeta>>({})
  const [externalLessons, setExternalLessons] = useState<ExternalLesson[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [timezone, setTimezone] = useState("Europe/Moscow")
  const [drag, setDrag] = useState<DragState | null>(null)
  const [popover, setPopover] = useState<{ x: number; y: number; dayIdx: number; fromHour: number; toHour: number } | null>(null)
  const [nowTs, setNowTs] = useState(() => getAppNow().getTime())
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [calendarRangeLoading, setCalendarRangeLoading] = useState(false)
  const initialCalendarBootstrapDone = useRef(false)
  const calendarFetchGen = useRef(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showWeekends, setShowWeekends] = useState(true)
  const [searchText, setSearchText] = useState("")
  const [scheduleSearchPulse, setScheduleSearchPulse] = useState<ScheduleSearchPulse | null>(null)
  const [createScheduleKind, setCreateScheduleKind] = useState<"recurring" | "single">("recurring")
  const createWeekdaysBackupRef = useRef<number[]>([1, 4])
  const [createWeekdays, setCreateWeekdays] = useState<number[]>([1, 4])
  const [createStartDateKey, setCreateStartDateKey] = useState(localDateKey(new Date()))
  const [createHour, setCreateHour] = useState(10)
  const [createWeeks, setCreateWeeks] = useState(12)
  const [createMode, setCreateMode] = useState<"busy" | "booked">("booked")
  const [createStudentId, setCreateStudentId] = useState<string>("")
  const [createTitle, setCreateTitle] = useState("Занятие")
  const [createFeedback, setCreateFeedback] = useState<string | null>(null)
  const [createSaving, setCreateSaving] = useState(false)
  const [createSuccessOpen, setCreateSuccessOpen] = useState(false)
  const [createSuccessPayload, setCreateSuccessPayload] = useState<{
    lessonTitle: string
    mode: "busy" | "booked"
    warning: string | null
    startDateKey: string
    weekdays: number[]
    hour: number
    weeks: number
    timeZoneId: string
    scheduleKind: "recurring" | "single"
  } | null>(null)
  const [copiedIntervals, setCopiedIntervals] = useState<AvailabilityInterval[] | null>(null)
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null)
  const [lessonActions, setLessonActions] = useState<{ x: number; y: number; lesson: ExternalLesson } | null>(null)
  const [lessonStatusOpen, setLessonStatusOpen] = useState(false)
  const [statusLesson, setStatusLesson] = useState<ExternalLesson | null>(null)
  const [statusValue, setStatusValue] = useState<"lesson" | "completed" | "charged_absence">("lesson")
  const [draggedLesson, setDraggedLesson] = useState<ExternalLesson | null>(null)
  const [dragTarget, setDragTarget] = useState<{ dayIdx: number; hour: number } | null>(null)
  const [lessonDecision, setLessonDecision] = useState<{
    action: "cancel" | "reschedule"
    lesson: ExternalLesson
    toDateKey?: string
    toHour?: number
  } | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleSlot, setRescheduleSlot] = useState({ date: "", hour: "10" })
  const [rescheduleContext, setRescheduleContext] = useState<{ lesson: ExternalLesson; scope: "single" | "following" } | null>(null)
  const [actionToast, setActionToast] = useState<string | null>(null)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionResultPopup, setActionResultPopup] = useState<{
    tone: "success" | "cancel"
    title: string
    message: string
    studentName?: string
    studentAvatarUrl?: string
  } | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [scheduleNotifications, setScheduleNotifications] = useState<ScheduleNotificationItem[]>([])
  const [notificationDetails, setNotificationDetails] = useState<ScheduleNotificationItem | null>(null)
  const headerScrollRef = useRef<HTMLDivElement | null>(null)
  const bodyScrollRef = useRef<HTMLDivElement | null>(null)

  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate])
  const visibleDays = useMemo(() => {
    const days = viewMode === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [anchorDate]
    if (viewMode !== "week" || showWeekends) return days
    return days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
  }, [anchorDate, showWeekends, viewMode, weekStart])

  useEffect(() => {
    setNowTs(getAppNow().getTime())
    const timer = window.setInterval(() => setNowTs(getAppNow().getTime()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (createOpen) setNowTs(getAppNow().getTime())
  }, [createOpen])

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "curator")) return
    const sync = () => setScheduleNotifications(readScheduleNotifications("teacher", user.id))
    sync()
    return subscribeScheduleNotifications(sync)
  }, [user])

  useEffect(() => {
    if (!notificationsOpen || !user || (user.role !== "teacher" && user.role !== "curator")) return
    markScheduleNotificationsRead("teacher", user.id)
  }, [notificationsOpen, user])

  useEffect(() => {
    if (!lessonActions) return
    const slotMs = new Date(lessonActions.lesson.slot_at).getTime()
    if (!Number.isFinite(slotMs) || slotMs > nowTs) return
    setLessonActions(null)
  }, [lessonActions, nowTs])

  useEffect(() => {
    if (!scheduleSearchPulse) return
    const pulse = scheduleSearchPulse
    const t = window.setTimeout(() => setScheduleSearchPulse(null), 3000)
    const scroll = () => {
      let el: Element | null = null
      if (pulse.kind === "external") {
        document.querySelectorAll("[data-external-slot-at]").forEach((n) => {
          if (n.getAttribute("data-external-slot-at") === pulse.slotAt) el = n
        })
      } else {
        el = document.querySelector(`[data-booked-pulse-anchor="${pulse.dateKey}-${pulse.startHour}"]`)
      }
      el?.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" })
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(scroll))
    return () => {
      window.clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [scheduleSearchPulse])

  useLayoutEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "curator")) return
    setCalendarRangeLoading(true)
  }, [user, visibleDays, viewMode])

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "curator")) {
      setCalendarRangeLoading(false)
      return
    }

    const gen = ++calendarFetchGen.current
    const ac = new AbortController()

    const rangeFrom = new Date(visibleDays[0])
    rangeFrom.setHours(0, 0, 0, 0)
    const rangeTo = addDays(rangeFrom, viewMode === "week" ? 7 : 1)
    const queryFrom = addDays(rangeFrom, -1)
    const queryTo = addDays(rangeTo, 1)
    const slotsUrl = `/api/schedule/slots?from=${encodeURIComponent(queryFrom.toISOString())}&to=${encodeURIComponent(queryTo.toISOString())}`

    const applySlotsPayload = (payload: {
      slots?: Array<{ slot_at: string; status: SlotStatus; booked_student_name: string | null }>
      external_lessons?: ExternalLesson[]
    }) => {
      const next: Record<string, SlotMeta> = {}
      for (const s of payload.slots ?? []) {
        next[s.slot_at] = { status: s.status, studentName: s.booked_student_name }
      }
      setSlotMap(next)
      setExternalLessons(payload.external_lessons ?? [])
    }

    const load = async () => {
      try {
        if (!initialCalendarBootstrapDone.current) {
          const [tmplRes, slotsRes, studentsRes] = await Promise.all([
            fetch("/api/schedule/template", { signal: ac.signal }),
            fetch(slotsUrl, { signal: ac.signal }),
            fetch("/api/schedule/students", { signal: ac.signal })
          ])
          if (gen !== calendarFetchGen.current) return
          if (tmplRes.ok) {
            const payload = (await tmplRes.json()) as { template: WeeklyTemplate; timezone: string }
            setTemplate(payload.template ?? emptyWeeklyTemplate())
            setTimezone(payload.timezone ?? "Europe/Moscow")
          }
          if (slotsRes.ok) {
            const payload = (await slotsRes.json()) as {
              slots?: Array<{ slot_at: string; status: SlotStatus; booked_student_name: string | null }>
              external_lessons?: ExternalLesson[]
            }
            applySlotsPayload(payload)
          }
          if (studentsRes.ok) {
            const payload = (await studentsRes.json()) as { students?: StudentOption[] }
            setStudents(payload.students ?? [])
          }
          initialCalendarBootstrapDone.current = true
          setReady(true)
        } else {
          const slotsRes = await fetch(slotsUrl, { signal: ac.signal })
          if (gen !== calendarFetchGen.current) return
          if (slotsRes.ok) {
            const payload = (await slotsRes.json()) as {
              slots?: Array<{ slot_at: string; status: SlotStatus; booked_student_name: string | null }>
              external_lessons?: ExternalLesson[]
            }
            applySlotsPayload(payload)
          }
        }
      } finally {
        if (gen === calendarFetchGen.current) {
          setCalendarRangeLoading(false)
        }
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user, visibleDays, viewMode])

  const monthTitle = `${anchorDate.toLocaleDateString("ru-RU", { month: "long" })} ${anchorDate.getFullYear()}`
  const dayColumnCount = visibleDays.length
  const unreadNotificationsCount = scheduleNotifications.filter((n) => !n.read).length

  const refreshCalendarData = async () => {
    const rangeFrom = new Date(visibleDays[0])
    rangeFrom.setHours(0, 0, 0, 0)
    const rangeTo = addDays(rangeFrom, viewMode === "week" ? 7 : 1)
    const queryFrom = addDays(rangeFrom, -1)
    const queryTo = addDays(rangeTo, 1)
    const slotsRes = await fetch(`/api/schedule/slots?from=${encodeURIComponent(queryFrom.toISOString())}&to=${encodeURIComponent(queryTo.toISOString())}`)
    if (!slotsRes.ok) return
    const payload = (await slotsRes.json()) as {
      slots?: Array<{ slot_at: string; status: SlotStatus; booked_student_name: string | null }>
      external_lessons?: ExternalLesson[]
    }
    const next: Record<string, SlotMeta> = {}
    for (const s of payload.slots ?? []) {
      next[s.slot_at] = { status: s.status, studentName: s.booked_student_name }
    }
    setSlotMap(next)
    setExternalLessons(payload.external_lessons ?? [])
  }

  const slotMapByTimezone = useMemo(() => {
    const out: Record<string, SlotMeta> = {}
    for (const [iso, meta] of Object.entries(slotMap)) {
      const d = new Date(iso)
      const parts = getDateTimePartsInTimeZone(d, timezone)
      const key = `${parts.dateKey}-${parts.hour}`
      const prev = out[key]
      if (!prev || prev.status !== "booked" || meta.status === "booked") {
        out[key] = meta
      }
    }
    return out
  }, [slotMap, timezone])

  const isBookedHour = (day: Date, hour: number) => {
    const dateKey = getDateKeyInTimeZone(day, timezone)
    return slotMapByTimezone[`${dateKey}-${String(hour).padStart(2, "0")}`]?.status === "booked"
  }

  const getHourStatus = (day: Date, hour: number): SlotStatus => {
    const dateKey = getDateKeyInTimeZone(day, timezone)
    const slot = slotMapByTimezone[`${dateKey}-${String(hour).padStart(2, "0")}`]
    if (slot?.status === "booked") return "booked"
    const weekday = weekdayFromDateKey(dateKey)
    return intervalsToHourlyStatuses(template[weekday])[hour]
  }

  const rescheduleDisabledTimes = useMemo(() => {
    if (!rescheduleSlot.date) return new Set<string>()
    const selectedDateKey = rescheduleSlot.date
    const blocked = new Set<string>()
    for (const opt of HOUR_OPTIONS) {
      const hour = Number.parseInt(opt.slice(0, 2), 10)
      const slot = slotMapByTimezone[`${selectedDateKey}-${String(hour).padStart(2, "0")}`]
      if (slot?.status === "booked") blocked.add(opt)
    }
    const now = new Date(nowTs)
    const todayKey = localDateKey(now)
    if (selectedDateKey === todayKey) {
      const currentHour = now.getHours()
      for (const opt of HOUR_OPTIONS) {
        if (Number.parseInt(opt.slice(0, 2), 10) <= currentHour) blocked.add(opt)
      }
    }
    return blocked
  }, [nowTs, rescheduleSlot.date, slotMapByTimezone])

  useEffect(() => {
    if (!rescheduleOpen) return
    const selected = `${String(Number(rescheduleSlot.hour)).padStart(2, "0")}:00`
    if (!rescheduleDisabledTimes.has(selected)) return
    const firstAllowed = HOUR_OPTIONS.find((opt) => !rescheduleDisabledTimes.has(opt))
    if (!firstAllowed) return
    setRescheduleSlot((prev) => ({ ...prev, hour: String(Number(firstAllowed.slice(0, 2))) }))
  }, [rescheduleDisabledTimes, rescheduleOpen, rescheduleSlot.hour])

  const applySelection = (mode: "free" | "busy") => {
    if (!popover) return
    const day = visibleDays[popover.dayIdx]
    const weekday = weekdayFromDate(day)
    const statuses = intervalsToHourlyStatuses(template[weekday])
    const hourStart = popover.fromHour
    const hourEnd = popover.toHour
    for (let hour = hourStart; hour <= hourEnd; hour++) {
      if (isBookedHour(day, hour)) continue
      statuses[hour] = mode
    }
    setTemplate((prev) => ({ ...prev, [weekday]: hourlyStatusesToIntervals(statuses) }))
    setPopover(null)
  }

  const saveChanges = async () => {
    const normalizedTemplate: WeeklyTemplate = { ...template }
    WEEKDAY_KEYS_ORDER.forEach((d) => {
      normalizedTemplate[d] = normalizeIntervals(template[d] ?? [])
    })
    setTemplate(normalizedTemplate)
    setSaving(true)
    await fetch("/api/schedule/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: normalizedTemplate, timezone })
    })

    const updates: Array<{ slot_at: string; status: "free" | "busy" }> = []
    for (const day of visibleDays) {
      const weekday = weekdayFromDate(day)
      const statuses = intervalsToHourlyStatuses(normalizedTemplate[weekday])
      const slots = buildHourlyIsoSlots(day)
      for (let hour = 0; hour < 24; hour++) {
        if (slotMap[slots[hour]]?.status === "booked") continue
        updates.push({ slot_at: slots[hour], status: statuses[hour] === "free" ? "free" : "busy" })
      }
    }
    await fetch("/api/schedule/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: updates })
    })
    setSaving(false)
  }

  const bookedBlocks = useMemo(() => {
    return visibleDays.map((day) => {
      const dateKey = getDateKeyInTimeZone(day, timezone)
      const hours = HOURS.map((hour) => ({
        hour,
        meta: slotMapByTimezone[`${dateKey}-${String(hour).padStart(2, "0")}`]
      }))
      const blocks: Array<{ top: number; height: number; label: string; time: string; startHour: number }> = []
      let start: number | null = null
      let name = ""
      for (let i = 0; i < hours.length; i++) {
        const isBooked = hours[i].meta?.status === "booked"
        if (isBooked && start === null) {
          start = i
          name = hours[i].meta?.studentName ?? "Ученик"
        }
        if ((!isBooked || i === hours.length - 1) && start !== null) {
          const endHour = isBooked && i === hours.length - 1 ? i + 1 : i
          const top = start * ROW_HEIGHT
          const height = (endHour - start) * ROW_HEIGHT
          blocks.push({
            top,
            height,
            label: name,
            time: `${String(start).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`,
            startHour: start
          })
          start = null
        }
      }
      return blocks
    })
  }, [slotMapByTimezone, timezone, visibleDays])

  const externalBlocks = useMemo(() => {
    const byDay = visibleDays.map(() => [] as Array<{ top: number; label: string; time: string; lesson: ExternalLesson; hour: number; isPast: boolean }>)
    const visibleDateKeys = visibleDays.map((d) => getDateKeyInTimeZone(d, timezone))
    for (const lesson of externalLessons) {
      const dateKey = lesson.date_key ?? getDateTimePartsInTimeZone(new Date(lesson.slot_at), timezone).dateKey
      const time = lesson.time ?? `${getDateTimePartsInTimeZone(new Date(lesson.slot_at), timezone).hour}:00`
      const hour = Number(time.slice(0, 2))
      const dayIdx = visibleDateKeys.findIndex((key) => key === dateKey)
      if (dayIdx < 0) continue
      const fromSlotAt = new Date(lesson.slot_at).getTime()
      const startMs = Number.isFinite(fromSlotAt)
        ? fromSlotAt
        : new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00`).getTime()
      byDay[dayIdx].push({
        top: hour * ROW_HEIGHT,
        label: lesson.student_name || lesson.title || "Занятие",
        time,
        lesson,
        hour,
        isPast: Number.isFinite(startMs) && startMs <= nowTs
      })
    }
    return byDay
  }, [externalLessons, timezone, visibleDays, nowTs])

  const searchResults = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return []
    const inBooked = visibleDays.flatMap((day, dayIdx) =>
      (bookedBlocks[dayIdx] ?? [])
        .filter((b) => b.label.toLowerCase().includes(q))
        .map((b) => {
          const dateKey = getDateKeyInTimeZone(day, timezone)
          const endHourExclusive = b.startHour + Math.round(b.height / ROW_HEIGHT)
          const pulse: ScheduleSearchPulse = {
            kind: "booked",
            dateKey,
            startHour: b.startHour,
            endHourExclusive
          }
          return { day, label: b.label, time: b.time, source: "booked" as const, pulse }
        })
    )
    const inExternal = externalLessons
      .filter((l) => `${l.student_name} ${l.title}`.toLowerCase().includes(q))
      .map((l) => {
        const d = new Date(l.slot_at)
        const parts = getDateTimePartsInTimeZone(new Date(l.slot_at), timezone)
        return {
          day: d,
          label: l.student_name || l.title,
          time: l.time ?? `${parts.hour}:00`,
          source: "external" as const,
          pulse: { kind: "external" as const, slotAt: l.slot_at }
        }
      })
    return [...inBooked, ...inExternal]
  }, [bookedBlocks, externalLessons, searchText, timezone, visibleDays])

  const nowLine = useMemo(() => {
    const now = new Date(nowTs)
    const nowParts = getDateTimePartsInTimeZone(now, timezone)
    const dayIdx = visibleDays.findIndex((d) => getDateKeyInTimeZone(d, timezone) === nowParts.dateKey)
    if (dayIdx < 0) return null
    const top = ((Number(nowParts.hour) * 60 + Number(nowParts.minute)) / 60) * ROW_HEIGHT
    return { dayIdx, top }
  }, [nowTs, timezone, visibleDays])

  const miniCalendarDays = useMemo(() => {
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    const offset = monthStart.getDay()
    const gridStart = addDays(monthStart, -offset)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [anchorDate])

  const createEffectiveWeekdays = useMemo(
    () =>
      createScheduleKind === "single" ? [jsWeekdayFromYmd(createStartDateKey)] : createWeekdays,
    [createScheduleKind, createStartDateKey, createWeekdays]
  )
  const createEffectiveWeeks = createScheduleKind === "single" ? 1 : createWeeks

  const createPastSlotHint = useMemo(() => {
    if (createEffectiveWeekdays.length === 0) {
      return { firstInPast: false, suggestedStart: null as string | null }
    }
    const firstInPast = isFirstScheduledSlotInPast(
      createStartDateKey,
      createEffectiveWeekdays,
      createEffectiveWeeks,
      createHour,
      timezone,
      nowTs
    )
    const wallTime = `${String(createHour).padStart(2, "0")}:00`
    const suggestedStart = firstInPast
      ? nextEligibleStartDateKey(createStartDateKey, createEffectiveWeekdays, wallTime, timezone, nowTs)
      : null
    return { firstInPast, suggestedStart }
  }, [
    createStartDateKey,
    createEffectiveWeekdays,
    createEffectiveWeeks,
    createHour,
    timezone,
    nowTs
  ])

  const createRecurringEvent = async () => {
    setCreateFeedback(null)
    setCreateSaving(true)
    try {
      const res = await fetch("/api/schedule/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekdays: createEffectiveWeekdays,
          start_date_key: createStartDateKey,
          hour: createHour,
          weeks: createEffectiveWeeks,
          status: createMode,
          student_id: createMode === "booked" ? createStudentId : null,
          title: createTitle,
          timezone
        })
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        created?: number
        studentLessonsCreated?: number
        warning?: string | null
        suggested_start_date_key?: string | null
      }
      if (!res.ok) {
        let msg = payload.error || "Не удалось создать регулярные занятия"
        if (payload.suggested_start_date_key) {
          msg += ` Предлагаем начать с ${formatDateKeyLongRuForHint(payload.suggested_start_date_key)} — нажмите «Начать с этой даты» в форме или укажите эту дату вручную.`
        }
        setCreateFeedback(msg)
        await refreshCalendarData()
        return
      }
      const created = payload.created ?? 0
      const studentCreated = payload.studentLessonsCreated ?? 0
      await refreshCalendarData()

      if (created > 0) {
        setCreateOpen(false)
        setCreateFeedback(null)
        setCreateSuccessPayload({
          lessonTitle: createTitle.trim() || "Занятие",
          mode: createMode,
          warning: payload.warning ?? null,
          startDateKey: createStartDateKey,
          weekdays: [...createEffectiveWeekdays],
          hour: createHour,
          weeks: createEffectiveWeeks,
          timeZoneId: timezone,
          scheduleKind: createScheduleKind
        })
        setCreateSuccessOpen(true)
        return
      }

      const baseMessage =
        createMode === "booked"
          ? `Новых слотов не добавлено (возможно, выбранные слоты уже заняты). Создано: ${created}, у ученика: ${studentCreated}.`
          : `Новых слотов не добавлено. Создано: ${created}.`
      setCreateFeedback(payload.warning ? `${baseMessage} Предупреждение: ${payload.warning}` : baseMessage)
    } finally {
      setCreateSaving(false)
    }
  }

  const cancelExternalLesson = async (lesson: ExternalLesson) => {
    setLessonDecision({ action: "cancel", lesson })
    setLessonActions(null)
  }

  const postJson = useCallback(async (url: string, payload: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(body.error || "Операция не выполнена")
    return body
  }, [])

  const isRecurringLesson = useCallback(
    (lesson: ExternalLesson) => {
      const src = lesson.date_key && lesson.time
        ? { dateKey: lesson.date_key, hour: lesson.time.slice(0, 2) }
        : getDateTimePartsInTimeZone(new Date(lesson.slot_at), timezone)
      const srcWeekday = weekdayFromDateKey(src.dateKey)
      const srcTime = `${String(Number.parseInt(src.hour, 10)).padStart(2, "0")}:00`
      const srcDate = new Date(`${src.dateKey}T00:00:00`)
      return externalLessons.some((candidate) => {
        if (candidate === lesson) return false
        if ((candidate.student_id ?? "") !== (lesson.student_id ?? "")) return false
        const c = candidate.date_key && candidate.time
          ? { dateKey: candidate.date_key, hour: candidate.time.slice(0, 2) }
          : getDateTimePartsInTimeZone(new Date(candidate.slot_at), timezone)
        const cWeekday = weekdayFromDateKey(c.dateKey)
        const cTime = `${String(Number.parseInt(c.hour, 10)).padStart(2, "0")}:00`
        if (cWeekday !== srcWeekday || cTime !== srcTime) return false
        const cDate = new Date(`${c.dateKey}T00:00:00`)
        return cDate.getTime() > srcDate.getTime()
      })
    },
    [externalLessons, timezone]
  )

  const openRescheduleModal = useCallback((lesson: ExternalLesson, scope: "single" | "following") => {
    const d = new Date(lesson.slot_at)
    const date = lesson.date_key ?? localDateKey(d)
    const hour = lesson.time ? Number(lesson.time.slice(0, 2)) : d.getHours()
    setRescheduleSlot({ date, hour: String(hour) })
    setRescheduleContext({ lesson, scope })
    setRescheduleOpen(true)
    setLessonActions(null)
    setLessonDecision(null)
  }, [])

  const rescheduleExternalLesson = async (
    scope: "single" | "following",
    params?: { lesson: ExternalLesson; toDateKey: string; toHour: number }
  ) => {
    const source = params
      ? { lesson: params.lesson, toDateKey: params.toDateKey, toHour: params.toHour }
      : lessonDecision && lessonDecision.action === "reschedule" && lessonDecision.toDateKey && lessonDecision.toHour !== undefined
        ? { lesson: lessonDecision.lesson, toDateKey: lessonDecision.toDateKey, toHour: lessonDecision.toHour }
        : null
    if (!source) return
    const toTime = `${String(source.toHour).padStart(2, "0")}:00`
    if (!isValidTeacherRescheduleTargetSlot(source.toDateKey, toTime)) {
      setActionToast("Преподаватель может переносить только в будущий свободный слот")
      window.setTimeout(() => setActionToast(null), 3500)
      return
    }
    setActionSubmitting(true)
    try {
      await postJson("/api/schedule/external-lesson", {
        action: "reschedule",
        lesson: source.lesson,
        to_date_key: source.toDateKey,
        to_hour: source.toHour,
        scope,
        timezone
      })
      setRescheduleOpen(false)
      setRescheduleContext(null)
      setLessonDecision(null)
      const fromDate = new Date(source.lesson.slot_at)
      const fromLabel = `${localDateKey(fromDate)} ${String(fromDate.getHours()).padStart(2, "0")}:00`
      const toLabel = `${source.toDateKey} ${String(source.toHour).padStart(2, "0")}:00`
      const studentName = source.lesson.student_name?.trim() || "Ученик"
      const studentAvatarUrl = source.lesson.student_avatar_url || "/students/yana.png"
      const sourceWeekday = fromDate.getDay()
      const targetWeekday = new Date(`${source.toDateKey}T00:00:00`).getDay()
      const fromRecurring = `по ${WEEKDAY_RU_DATIVE_PLURAL[sourceWeekday] ?? "выбранным дням"} в ${String(fromDate.getHours()).padStart(2, "0")}:00`
      const toRecurring = `по ${WEEKDAY_RU_DATIVE_PLURAL[targetWeekday] ?? "выбранным дням"} в ${String(source.toHour).padStart(2, "0")}:00`
      pushScheduleNotification({
        audience: "student",
        audienceId: source.lesson.student_id,
        title: "Преподаватель перенёс занятие",
        message: scope === "following" ? "Изменены все последующие занятия." : "Изменено время ближайшего занятия.",
        fromLabel,
        toLabel,
        targetDateKey: source.toDateKey
      })
      setActionToast(scope === "following" ? "Перенесены все последующие занятия" : "Занятие перенесено")
      window.setTimeout(() => setActionToast(null), 2500)
      setActionResultPopup({
        tone: "success",
        title: scope === "following" ? "Перенесли все последующие" : "Занятие перенесено",
        message: scope === "following" ? `${studentName}: ${fromRecurring} -> ${toRecurring}` : `${studentName}: ${fromLabel} -> ${toLabel}`,
        studentName,
        studentAvatarUrl
      })
      await refreshCalendarData()
    } catch (error) {
      setActionToast(error instanceof Error ? error.message : "Не удалось перенести занятие")
      window.setTimeout(() => setActionToast(null), 3500)
    } finally {
      setActionSubmitting(false)
    }
  }

  const confirmCancelExternalLesson = async (scope: "single" | "following") => {
    if (!lessonDecision || lessonDecision.action !== "cancel") return
    setActionSubmitting(true)
    try {
      await postJson("/api/schedule/external-lesson", {
        action: "cancel",
        lesson: lessonDecision.lesson,
        scope,
        timezone
      })
      pushScheduleNotification({
        audience: "student",
        audienceId: lessonDecision.lesson.student_id,
        title: "Преподаватель отменил занятие",
        message: scope === "following" ? "Отменены все последующие занятия." : "Отменено одно занятие.",
        fromLabel: `${localDateKey(new Date(lessonDecision.lesson.slot_at))} ${String(new Date(lessonDecision.lesson.slot_at).getHours()).padStart(2, "0")}:00`
      })
      setLessonDecision(null)
      setActionToast(scope === "following" ? "Отменены все последующие занятия" : "Занятие отменено")
      window.setTimeout(() => setActionToast(null), 2500)
      setActionResultPopup({
        tone: "cancel",
        title: scope === "following" ? "Отменили все последующие" : "Занятие отменено",
        message: `${localDateKey(new Date(lessonDecision.lesson.slot_at))} ${String(new Date(lessonDecision.lesson.slot_at).getHours()).padStart(2, "0")}:00`,
        studentName: lessonDecision.lesson.student_name?.trim() || "Ученик",
        studentAvatarUrl: lessonDecision.lesson.student_avatar_url || "/students/yana.png"
      })
      await refreshCalendarData()
    } catch (error) {
      setActionToast(error instanceof Error ? error.message : "Не удалось отменить занятие")
      window.setTimeout(() => setActionToast(null), 3500)
    } finally {
      setActionSubmitting(false)
    }
  }

  const saveLessonStatus = async () => {
    if (!statusLesson) return
    setActionSubmitting(true)
    try {
      await postJson("/api/schedule/lesson-status", {
        lesson: statusLesson,
        status: statusValue
      })
      setLessonStatusOpen(false)
      setStatusLesson(null)
      setActionToast(statusValue === "completed" ? "Отмечено как проведено" : statusValue === "charged_absence" ? "Отмечено как поздняя отмена (засчитано)" : "Статус занятия обновлён")
      window.setTimeout(() => setActionToast(null), 2500)
      await refreshCalendarData()
    } catch (error) {
      setActionToast(error instanceof Error ? error.message : "Не удалось обновить статус")
      window.setTimeout(() => setActionToast(null), 3500)
    } finally {
      setActionSubmitting(false)
    }
  }

  const addAvailabilityInterval = (day: WeekdayKey) => {
    const current = template[day] ?? []
    if (current.length === 0) {
      setAvailabilityNotice(null)
      setTemplate((prev) => ({ ...prev, [day]: [{ start: "09:00", end: "11:00" }] }))
      return
    }
    const sorted = [...current].sort((a, b) => a.start.localeCompare(b.start))
    const last = sorted[sorted.length - 1]
    const [eh] = last.end.split(":").map((x) => Number.parseInt(x, 10))
    const startHour = Math.max(0, Math.min(23, eh + 1))
    if (startHour >= 24) {
      setAvailabilityNotice("В этом дне больше нет места для нового интервала.")
      return
    }
    const endHour = Math.min(24, startHour + 2)
    setAvailabilityNotice(null)
    setTemplate((prev) => ({
      ...prev,
      [day]: normalizeIntervals([
        ...(prev[day] ?? []),
        { start: `${String(startHour).padStart(2, "0")}:00`, end: `${String(endHour).padStart(2, "0")}:00` }
      ])
    }))
  }
  const setDayUnavailable = (day: WeekdayKey) => setTemplate((prev) => ({ ...prev, [day]: [] }))
  const copyDayAvailability = (day: WeekdayKey) => setCopiedIntervals((template[day] ?? []).map((i) => ({ ...i })))
  const pasteDayAvailability = (day: WeekdayKey) => {
    if (!copiedIntervals) return
    setTemplate((prev) => ({ ...prev, [day]: normalizeIntervals(copiedIntervals.map((i) => ({ ...i }))) }))
  }
  const copyAllDaysAvailability = (day: WeekdayKey) => {
    const src = template[day] ?? []
    setTemplate((prev) => {
      const next = { ...prev }
      WEEKDAY_KEYS_ORDER.forEach((d) => {
        next[d] = normalizeIntervals(src.map((i) => ({ ...i })))
      })
      return next
    })
  }
  const updateAvailabilityInterval = (day: WeekdayKey, idx: number, patch: Partial<AvailabilityInterval>) => {
    setTemplate((prev) => {
      const next = [...prev[day]]
      const candidate = { ...next[idx], ...patch }
      const start = toMinutes(candidate.start)
      const end = toMinutes(candidate.end)
      if (end <= start) {
        const fallbackEnd = Math.min(24 * 60, start + 60)
        candidate.end = fromMinutes(fallbackEnd)
      }
      next[idx] = candidate
      return { ...prev, [day]: normalizeIntervals(next) }
    })
  }
  const deleteAvailabilityInterval = (day: WeekdayKey, idx: number) => {
    setTemplate((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }))
  }

  return (
    <div className="h-[calc(100vh-70px)] overflow-hidden rounded-[16px] bg-[#f8f9fa] dark:bg-[#111315]">
      <div className="flex h-full flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#1a1d21]">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <TooltipIconButton tooltip="Свернуть/развернуть меню" onClick={() => setSidebarCollapsed((v) => !v)}>
              <Menu size={18} />
            </TooltipIconButton>
            <button className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10" onClick={() => setAnchorDate(new Date())}>
              Сегодня
            </button>
            <div className="flex items-center">
              <TooltipIconButton tooltip="Предыдущий период" onClick={() => setAnchorDate((d) => addDays(d, viewMode === "week" ? -7 : -1))}>
                <ChevronLeft size={18} />
              </TooltipIconButton>
              <TooltipIconButton tooltip="Следующий период" onClick={() => setAnchorDate((d) => addDays(d, viewMode === "week" ? 7 : 1))}>
                <ChevronRight size={18} />
              </TooltipIconButton>
            </div>
            <h1 className="truncate text-[20px] font-normal capitalize text-[#3c4043] dark:text-white sm:text-[22px]">{monthTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-[#f1f3f4] p-0.5 dark:border-white/15 dark:bg-[#252a31]">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "day"
                    ? "bg-white text-[#3c4043] shadow-sm dark:bg-[#323944] dark:text-white dark:shadow-md dark:shadow-black/40"
                    : "bg-transparent text-[#5f6368] hover:bg-black/[0.04] hover:text-[#202124] dark:text-[#b0b6c0] dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
                onClick={() => setViewMode("day")}
              >
                День
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "week"
                    ? "bg-white text-[#3c4043] shadow-sm dark:bg-[#323944] dark:text-white dark:shadow-md dark:shadow-black/40"
                    : "bg-transparent text-[#5f6368] hover:bg-black/[0.04] hover:text-[#202124] dark:text-[#b0b6c0] dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
                onClick={() => setViewMode("week")}
              >
                Неделя
              </button>
            </div>
            <TooltipIconButton tooltip="Создать занятие" onClick={() => setCreateOpen(true)}>
              <Plus size={18} />
            </TooltipIconButton>
            <TooltipIconButton tooltip="Поиск встреч и учеников" onClick={() => setSearchOpen(true)}>
              <Search size={18} />
            </TooltipIconButton>
            <TooltipIconButton tooltip="Настройки календаря" onClick={() => setSettingsOpen(true)}>
              <Settings size={18} />
            </TooltipIconButton>
            <div className="relative">
              <TooltipIconButton tooltip="Уведомления" onClick={() => setNotificationsOpen((v) => !v)}>
                <Bell size={18} />
              </TooltipIconButton>
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d93025]" />
              ) : null}
              {notificationsOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[320px] rounded-xl border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#23272d]">
                  <div className="px-2 py-1 text-sm font-semibold text-[#202124] dark:text-white">Уведомления</div>
                  <div className="mt-1 max-h-72 space-y-1 overflow-auto">
                    {scheduleNotifications.length === 0 ? (
                      <div className="rounded-md px-2 py-2 text-xs text-[#5f6368] dark:text-[#b0b6c0]">Новых уведомлений нет</div>
                    ) : (
                      scheduleNotifications.slice(0, 8).map((notice) => (
                        <button
                          key={notice.id}
                          type="button"
                          className="w-full rounded-md bg-[#f8f9fa] px-2 py-2 text-left hover:bg-[#edf0f2] dark:bg-[#2a2f36] dark:hover:bg-[#323944]"
                          onClick={() => {
                            setNotificationDetails(notice)
                            setNotificationsOpen(false)
                          }}
                        >
                          <div className="text-xs font-semibold text-[#202124] dark:text-white">{notice.title}</div>
                          {notice.studentName ? (
                            <div className="mt-0.5 text-xs text-[#5f6368] dark:text-[#b0b6c0]">Ученик: {notice.studentName}</div>
                          ) : null}
                          {notice.fromLabel ? (
                            <div className="text-xs text-[#5f6368] dark:text-[#b0b6c0]">Было: {notice.fromLabel}</div>
                          ) : null}
                          {notice.toLabel ? (
                            <div className="text-xs text-[#5f6368] dark:text-[#b0b6c0]">Стало: {notice.toLabel}</div>
                          ) : null}
                          <div className="mt-0.5 text-xs text-[#5f6368] dark:text-[#b0b6c0]">{notice.message}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              className="rounded-lg border border-black/10 bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-black/85 disabled:opacity-60 dark:border-[#b8d97a]/40 dark:bg-[var(--ds-sage-strong)] dark:text-[#121212] dark:hover:bg-[var(--ds-sage-hover)] dark:hover:text-[#0f0f0f]"
              disabled={!ready || saving}
              onClick={() => void saveChanges()}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-0 p-0">
          <aside className={`hidden rounded-[14px] bg-transparent px-3 py-4 transition-all dark:bg-transparent md:block ${sidebarCollapsed ? "w-16" : "w-72 lg:w-80"}`}>
            <button
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#f1f3f4] px-3 py-2 text-sm text-[#202124] hover:bg-[#e8eaed] dark:bg-[#23272d] dark:text-[#e8eaed] dark:hover:bg-[#2d333b]"
              onClick={() => setAvailabilityOpen(true)}
            >
              <Settings size={16} />
              {!sidebarCollapsed ? "Указать доступность" : null}
            </button>
            <button
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#f1f3f4] px-3 py-2 text-sm text-[#202124] hover:bg-[#e8eaed] dark:bg-[#23272d] dark:text-[#e8eaed] dark:hover:bg-[#2d333b]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} />
              {!sidebarCollapsed ? "Создать занятие" : null}
            </button>
            {!sidebarCollapsed ? (
              <>
                <div className="mb-4 rounded-[var(--ds-radius-xl)] border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#23272d]">
                  <div className="mb-3">
                    <span className="text-[17px] font-semibold capitalize leading-none text-ds-ink dark:text-[#e8eaed]">
                      {anchorDate.toLocaleDateString("ru-RU", { month: "long" })}{" "}
                    </span>
                    <span className="text-[17px] font-normal leading-none text-ds-ink dark:text-[#e8eaed]">
                      {anchorDate.toLocaleDateString("ru-RU", { year: "numeric" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center sm:gap-1">
                    {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map((d) => (
                      <div key={d} className="pb-1 text-center text-[11px] text-[#888] dark:text-[#9aa0a6]">
                        {d}
                      </div>
                    ))}
                    {miniCalendarDays.map((d) => {
                      const active = d.toDateString() === anchorDate.toDateString()
                      const inMonth = d.getMonth() === anchorDate.getMonth()
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          className={`mx-auto flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] text-center text-[13px] no-underline transition-colors ${
                            active
                              ? "bg-ds-sage text-ds-ink dark:bg-[var(--ds-sage-strong)] dark:text-[#121212]"
                              : inMonth
                                ? "text-ds-ink hover:bg-ds-surface-hover dark:text-[#e8eaed] dark:hover:bg-white/10"
                                : "text-[#9aa0a6] dark:text-[#6b7280]"
                          }`}
                          onClick={() => setAnchorDate(d)}
                        >
                          {d.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </aside>

          <main className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[14px] border border-black/10 bg-white dark:border-white/10 dark:bg-[#1a1d21]">
            <div
              ref={headerScrollRef}
              className="ds-hide-scrollbar sticky top-0 z-20 overflow-x-auto border-b border-black/10 bg-white px-1 pt-1 dark:border-white/10 dark:bg-[#1a1d21]"
              onScroll={(e) => {
                if (!bodyScrollRef.current) return
                bodyScrollRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft
              }}
            >
              <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `64px repeat(${dayColumnCount}, minmax(132px, 1fr))` }}>
                <div className="m-1 rounded-lg bg-transparent dark:bg-transparent" />
                {visibleDays.map((day) => (
                  <div key={day.toISOString()} className="m-1 rounded-lg border border-black/10 bg-transparent py-2 text-center dark:border-white/10 dark:bg-transparent">
                    <div className="text-[11px] uppercase text-[#5f6368] dark:text-[#b0b6c0]">{getWeekdayLabelInTimeZone(day, timezone)}</div>
                    <div className="text-[20px] text-[#3c4043] dark:text-white sm:text-[24px]">{getDayOfMonthInTimeZone(day, timezone)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              ref={bodyScrollRef}
              className="relative h-[calc(100%-64px)] overflow-auto p-1 pb-3"
              onPointerUp={() => setDrag(null)}
              onScroll={(e) => {
                if (!headerScrollRef.current) return
                headerScrollRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft
              }}
            >
              {calendarRangeLoading ? (
                <div
                  className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-[#1a1d21]/55"
                  aria-busy
                  aria-live="polite"
                >
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-black/10 bg-white/95 px-4 py-3 shadow-lg dark:border-white/10 dark:bg-[#23272d]/95">
                    <Loader2 className="h-7 w-7 animate-spin text-[#1a73e8] dark:text-[#8ab4f8]" aria-hidden />
                    <span className="text-xs text-[#5f6368] dark:text-[#b0b6c0]">Загрузка расписания…</span>
                  </div>
                </div>
              ) : null}
              <div className="relative grid min-w-[760px]" style={{ gridTemplateColumns: `64px repeat(${dayColumnCount}, minmax(132px, 1fr))` }}>
                <div>
                  {HOURS.map((hour) => (
                    <div key={`time-${hour}`} className="mr-1 flex h-[34px] items-center justify-center bg-transparent text-center text-[10px] text-[#70757a] dark:text-[#b0b6c0]">
                      {`${String(hour).padStart(2, "0")}:00`}
                    </div>
                  ))}
                  <div className="mr-1 h-1.5" />
                </div>

                {visibleDays.map((day, dayIdx) => (
                  <div key={day.toISOString()} className="relative mx-[1px] overflow-hidden rounded-lg border border-black/10 bg-[#fdfdfd] dark:border-white/10 dark:bg-[#1a1e24]">
                    {HOURS.map((hour) => {
                      const status = getHourStatus(day, hour)
                      const dateKeyCol = getDateKeyInTimeZone(day, timezone)
                      const bookedPulse =
                        scheduleSearchPulse?.kind === "booked" &&
                        scheduleSearchPulse.dateKey === dateKeyCol &&
                        hour >= scheduleSearchPulse.startHour &&
                        hour < scheduleSearchPulse.endHourExclusive
                      const bookedPulseAnchor =
                        bookedPulse && hour === scheduleSearchPulse.startHour && status === "booked"
                      const bgClass =
                        status === "free"
                          ? "bg-[#e6f4ea] dark:bg-[#1e2a22]"
                          : "bg-[#eef1f4] dark:bg-[#252a32]"
                      const isDraggingCell =
                        drag &&
                        drag.dayIdx === dayIdx &&
                        hour >= Math.min(drag.startHour, drag.endHour) &&
                        hour <= Math.max(drag.startHour, drag.endHour)

                      const isDropTarget = dragTarget?.dayIdx === dayIdx && dragTarget?.hour === hour
                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          data-booked-pulse-anchor={bookedPulseAnchor ? `${dateKeyCol}-${hour}` : undefined}
                          className={`${hour === HOURS.length - 1 ? "mb-0" : "mb-[2px]"} mx-[2px] h-[32px] cursor-pointer rounded-[6px] ${bgClass} ${bookedPulse ? "schedule-lesson-search-pulse" : ""} ${isDraggingCell || isDropTarget ? "bg-[#d2e3fc] ring-1 ring-[#1a73e8]/40 dark:bg-[#2a3f5c] dark:ring-[#8ab4f8]/50" : ""} hover:bg-[#eef3fd] dark:hover:bg-[#2f3642]`}
                          onPointerDown={(e) => {
                            if (status === "booked") return
                            setPopover(null)
                            setDrag({ dayIdx, startHour: hour, endHour: hour })
                            ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                          }}
                          onPointerEnter={() => {
                            if (!drag || drag.dayIdx !== dayIdx) return
                            setDrag({ ...drag, endHour: hour })
                          }}
                          onClick={(e) => {
                            if (status === "booked") return
                            setPopover({ x: e.clientX, y: e.clientY, dayIdx, fromHour: hour, toHour: hour })
                          }}
                          onDragOver={(e) => {
                            if (!draggedLesson) return
                            e.preventDefault()
                            setDragTarget({ dayIdx, hour })
                          }}
                          onDragLeave={() => {
                            if (!draggedLesson) return
                            setDragTarget((prev) => (prev?.dayIdx === dayIdx && prev.hour === hour ? null : prev))
                          }}
                          onDrop={(e) => {
                            if (!draggedLesson) return
                            e.preventDefault()
                            const targetDay = visibleDays[dayIdx]
                            setLessonDecision({
                              action: "reschedule",
                              lesson: draggedLesson,
                              toDateKey: getDateKeyInTimeZone(targetDay, timezone),
                              toHour: hour
                            })
                            setDraggedLesson(null)
                            setDragTarget(null)
                          }}
                        />
                      )
                    })}
                    <div className="h-1.5 bg-transparent" />

                    <div className="pointer-events-none absolute inset-0 z-20">
                      {(externalBlocks[dayIdx] ?? []).map((b, i) => {
                        const lesson = b.lesson
                        const externalPulse =
                          scheduleSearchPulse?.kind === "external" && scheduleSearchPulse.slotAt === lesson.slot_at
                        const activeClass =
                          lesson.type === "charged_absence"
                            ? "pointer-events-auto absolute left-[2px] right-[2px] rounded-[6px] p-1.5 pl-7 text-left text-[11px] transition hover:ring-2 bg-[#f6c7c3] text-[#7f1d1d] hover:bg-[#f0b4ae] hover:ring-[#b3261e]/20 dark:bg-[#4a2528] dark:text-[#fecaca] dark:hover:bg-[#5c2e32] dark:hover:ring-[#f87171]/25"
                            : "pointer-events-auto absolute left-[2px] right-[2px] rounded-[6px] p-1.5 pl-7 text-left text-[11px] transition hover:ring-2 bg-[#81c995]/70 text-[#0d652d] hover:bg-[#81c995] hover:ring-[#0d652d]/20 dark:bg-[#1e3d2e]/95 dark:text-[#b9f6ca] dark:hover:bg-[#255238] dark:hover:ring-[#81c995]/30"
                        const pastClass = `pointer-events-none absolute left-[2px] right-[2px] rounded-[6px] border border-black/10 bg-ds-neutral-row p-1.5 pl-7 text-left text-[11px] text-ds-text-muted opacity-70 dark:border-white/10 ${externalPulse ? "schedule-lesson-search-pulse" : ""}`
                        const cardClass = b.isPast ? pastClass : `${activeClass} ${externalPulse ? "schedule-lesson-search-pulse" : ""}`
                        const cardInner = (
                          <>
                            <span className="absolute left-1.5 top-1.5 h-4 w-4 overflow-hidden rounded-[4px] bg-white/80 dark:bg-white/10">
                              <img
                                src={lesson.student_avatar_url || "/students/yana.png"}
                                alt={lesson.student_name || "Ученик"}
                                className="h-full w-full object-cover"
                              />
                            </span>
                            {lesson.type === "completed" ? (
                              <CheckCircle2
                                size={12}
                                className={`absolute right-1 top-1 ${b.isPast ? "text-ds-text-muted" : "text-[#0d652d] dark:text-[#b9f6ca]"}`}
                              />
                            ) : null}
                            {lesson.type === "charged_absence" && !b.isPast ? (
                              <span className="absolute right-1 top-1 rounded bg-[#b3261e] px-1 text-[9px] text-white">late</span>
                            ) : null}
                            <div className="truncate leading-tight">{b.label}</div>
                          </>
                        )
                        return b.isPast ? (
                          <div
                            key={`${dayIdx}-external-${i}`}
                            data-external-slot-at={lesson.slot_at}
                            className={cardClass}
                            style={{ top: b.top + 1, height: SLOT_HEIGHT }}
                            role="note"
                            aria-label={`Прошедший урок ${b.label}`}
                          >
                            {cardInner}
                          </div>
                        ) : (
                          <button
                            key={`${dayIdx}-external-${i}`}
                            type="button"
                            data-external-slot-at={lesson.slot_at}
                            className={cardClass}
                            style={{ top: b.top + 1, height: SLOT_HEIGHT }}
                            draggable
                            onDragStart={() => {
                              setDraggedLesson(lesson)
                              setDragTarget(null)
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setLessonActions({ x: e.clientX, y: e.clientY, lesson })
                            }}
                          >
                            {cardInner}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {nowLine ? (
                  <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: nowLine.top }}>
                    <div className="grid" style={{ gridTemplateColumns: `64px repeat(${dayColumnCount}, minmax(132px, 1fr))` }}>
                      <div className="relative">
                        <div className="absolute right-[-4px] top-[-4px] h-2 w-2 rounded-full bg-[#d93025]" />
                      </div>
                      {visibleDays.map((_, idx) => (
                        <div key={`line-${idx}`} className={`${idx === nowLine.dayIdx ? "border-t-2 border-[#d93025]" : ""}`} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </div>

      {drag ? (
        <div
          className="fixed inset-0 z-40"
          onPointerUp={(e) => {
            setPopover({
              x: e.clientX,
              y: e.clientY,
              dayIdx: drag.dayIdx,
              fromHour: Math.min(drag.startHour, drag.endHour),
              toHour: Math.max(drag.startHour, drag.endHour)
            })
            setDrag(null)
          }}
        />
      ) : null}

      {popover ? (
        <div className="fixed z-50 w-52 rounded-lg border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#23272d]" style={{ left: popover.x + 8, top: popover.y + 8 }}>
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              className="rounded-md p-1 text-[#5f6368] hover:bg-black/5 dark:text-[#b0b6c0] dark:hover:bg-white/10"
              onClick={() => setPopover(null)}
              aria-label="Закрыть меню слота"
            >
              <X size={14} />
            </button>
          </div>
          <button
            className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5"
            onClick={() => {
              {
                const colDateKey = getDateKeyInTimeZone(visibleDays[popover.dayIdx], timezone)
                const [y, mo, d] = colDateKey.split("-").map(Number)
                setCreateWeekdays([new Date(y, mo - 1, d).getDay()])
                setCreateStartDateKey(colDateKey)
              }
              setCreateHour(popover.fromHour)
              setCreateWeeks(1)
              setCreateOpen(true)
              setPopover(null)
            }}
          >
            Создать занятие
          </button>
          <button className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5" onClick={() => applySelection("free")}>
            Открыть слот
          </button>
          <button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5" onClick={() => applySelection("busy")}>
            Закрыть слот
          </button>
        </div>
      ) : null}

      {lessonActions ? (
        <div className="fixed z-[70] w-52 rounded-xl border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#23272d]" style={{ left: lessonActions.x + 8, top: lessonActions.y + 8 }}>
          {(() => {
            const lessonDate = lessonActions.lesson.date_key
              ? new Date(`${lessonActions.lesson.date_key}T${lessonActions.lesson.time ?? "00:00"}:00`)
              : new Date(lessonActions.lesson.slot_at)
            const canMarkStatus = lessonDate.getTime() <= Date.now()
            return (
              <>
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              className="rounded-md p-1 text-[#5f6368] hover:bg-black/5 dark:text-[#b0b6c0] dark:hover:bg-white/10"
              onClick={() => setLessonActions(null)}
              aria-label="Закрыть меню урока"
            >
              <X size={14} />
            </button>
          </div>
          <button
            className="mb-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5"
            onClick={() => {
              if (isRecurringLesson(lessonActions.lesson)) {
                setLessonDecision({ action: "reschedule", lesson: lessonActions.lesson })
                setLessonActions(null)
                return
              }
              openRescheduleModal(lessonActions.lesson, "single")
            }}
          >
            Перенести
          </button>
          <button
            className="mb-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5"
            onClick={() => {
              if (!canMarkStatus) {
                setActionToast("Нельзя отметить занятие как проведенное до его фактического времени")
                window.setTimeout(() => setActionToast(null), 2500)
                return
              }
              setStatusLesson(lessonActions.lesson)
              setStatusValue((lessonActions.lesson.type as "lesson" | "completed" | "charged_absence") || "lesson")
              setLessonStatusOpen(true)
              setLessonActions(null)
            }}
          >
            Отметить статус
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#b3261e] transition-colors hover:bg-[#fce8e6] dark:text-[#f87171] dark:hover:bg-[#b3261e]/18"
            onClick={() => void cancelExternalLesson(lessonActions.lesson)}
          >
            Отменить
          </button>
              </>
            )
          })()}
        </div>
      ) : null}

      {lessonDecision ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#1a1d21]">
            <h4 className="text-lg font-semibold text-[#202124] dark:text-white">
              {lessonDecision.action === "cancel" ? "Отмена занятия" : "Перенос занятия"}
            </h4>
            <p className="mt-2 text-sm text-[#5f6368] dark:text-[#b0b6c0]">
              Это регулярное занятие. Применить действие только к этому занятию или ко всем последующим?
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-[#202124] transition-colors hover:bg-black/[0.06] active:bg-black/10 dark:text-[#e8eaed] dark:hover:bg-white/[0.1] dark:active:bg-white/[0.14]"
                disabled={actionSubmitting}
                onClick={() => setLessonDecision(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#202124] transition-colors hover:bg-black/[0.06] dark:border-white/15 dark:text-[#e8eaed] dark:hover:bg-white/[0.1] dark:active:bg-white/[0.14]"
                disabled={actionSubmitting}
                onClick={() =>
                  lessonDecision.action === "cancel"
                    ? void confirmCancelExternalLesson("single")
                    : lessonDecision.toDateKey
                      ? void rescheduleExternalLesson("single")
                      : openRescheduleModal(lessonDecision.lesson, "single")
                }
              >
                {actionSubmitting ? <Loader2 className="mx-auto size-4 animate-spin" aria-hidden /> : "Только это"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-black/10 bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 active:bg-black/90 dark:border-[#b8d97a]/40 dark:bg-[var(--ds-sage-strong)] dark:text-[#121212] dark:hover:bg-[var(--ds-sage-hover)] dark:active:opacity-95"
                disabled={actionSubmitting}
                onClick={() =>
                  lessonDecision.action === "cancel"
                    ? void confirmCancelExternalLesson("following")
                    : lessonDecision.toDateKey
                      ? void rescheduleExternalLesson("following")
                      : openRescheduleModal(lessonDecision.lesson, "following")
                }
              >
                {actionSubmitting ? <Loader2 className="mx-auto size-4 animate-spin" aria-hidden /> : "Все последующие"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rescheduleOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#1a1d21]">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#202124] dark:text-white">Перенести занятие</h4>
              <TooltipIconButton tooltip="Закрыть" onClick={() => setRescheduleOpen(false)}>
                <X size={16} />
              </TooltipIconButton>
            </div>
            <div className="mb-3 text-sm text-[#5f6368] dark:text-[#b0b6c0]">
              <span className="block">Дата</span>
              <div className="mt-1">
                <DateMiniSelect
                  value={rescheduleSlot.date}
                  onChange={(next) => setRescheduleSlot((prev) => ({ ...prev, date: next }))}
                  minDateKey={localDateKey(getAppNow())}
                />
              </div>
            </div>
            <div className="text-sm text-[#5f6368] dark:text-[#b0b6c0]">
              <span className="block">Время</span>
              <div className="mt-1">
                <TimeSelect
                  value={`${String(Number(rescheduleSlot.hour)).padStart(2, "0")}:00`}
                  options={HOUR_OPTIONS}
                  disabledOptions={rescheduleDisabledTimes}
                  onChange={(value) => setRescheduleSlot((prev) => ({ ...prev, hour: String(Number(value.slice(0, 2))) }))}
                  fullWidth
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg px-4 py-2 text-sm text-[#202124] hover:bg-black/5 dark:text-[#e8eaed] dark:hover:bg-white/10"
                disabled={actionSubmitting}
                onClick={() => setRescheduleOpen(false)}
              >
                Отмена
              </button>
              <button
                className="rounded-lg border border-black/10 bg-black px-5 py-2 text-sm text-white hover:bg-black/85 dark:border-[#b8d97a]/40 dark:bg-[var(--ds-sage-strong)] dark:text-[#121212] dark:hover:bg-[var(--ds-sage-hover)]"
                disabled={actionSubmitting}
                onClick={() => {
                  if (!rescheduleContext) return
                  const toHour = Number.parseInt(rescheduleSlot.hour, 10)
                  if (!rescheduleSlot.date || Number.isNaN(toHour)) return
                  void rescheduleExternalLesson(rescheduleContext.scope, {
                    lesson: rescheduleContext.lesson,
                    toDateKey: rescheduleSlot.date,
                    toHour
                  })
                }}
              >
                {actionSubmitting ? <Loader2 className="mx-auto size-4 animate-spin" aria-hidden /> : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lessonStatusOpen && statusLesson ? (
        <div className="fixed inset-0 z-[76] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#1a1d21]">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#202124] dark:text-white">Статус занятия</h4>
              <TooltipIconButton tooltip="Закрыть" onClick={() => setLessonStatusOpen(false)}>
                <X size={16} />
              </TooltipIconButton>
            </div>
            <div className="mb-3 text-sm text-[#5f6368] dark:text-[#b0b6c0]">
              {statusLesson.student_name} · {formatYmdLabel(localDateKey(new Date(statusLesson.slot_at)))} {String(new Date(statusLesson.slot_at).getHours()).padStart(2, "0")}:00
            </div>
            <div className="space-y-2">
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  statusValue === "lesson"
                    ? "border-[#1a73e8] bg-[#e8f0fe] text-[#174ea6] dark:border-[#8ab4f8] dark:bg-[#1a2f4a] dark:text-[#d2e3fc]"
                    : "border-black/10 bg-white text-[#202124] hover:bg-black/[0.06] dark:border-white/15 dark:bg-[#252a32] dark:text-[#e8eaed] dark:hover:bg-white/[0.08]"
                }`}
                onClick={() => setStatusValue("lesson")}
              >
                Запланировано / обычный статус
              </button>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  statusValue === "completed"
                    ? "border-[#0d652d] bg-[#e6f4ea] text-[#0d652d] dark:border-[#81c995] dark:bg-[#1e3d2e] dark:text-[#b9f6ca]"
                    : "border-black/10 bg-white text-[#202124] hover:bg-black/[0.06] dark:border-white/15 dark:bg-[#252a32] dark:text-[#e8eaed] dark:hover:bg-white/[0.08]"
                }`}
                onClick={() => setStatusValue("completed")}
              >
                Проведено
              </button>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  statusValue === "charged_absence"
                    ? "border-[#b3261e] bg-[#fce8e6] text-[#7f1d1d] dark:border-[#f87171] dark:bg-[#3d2226] dark:text-[#fecaca]"
                    : "border-black/10 bg-white text-[#202124] hover:bg-black/[0.06] dark:border-white/15 dark:bg-[#252a32] dark:text-[#e8eaed] dark:hover:bg-white/[0.08]"
                }`}
                onClick={() => setStatusValue("charged_absence")}
              >
                Поздняя отмена (засчитать занятие)
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-[#202124] transition-colors hover:bg-black/[0.06] active:bg-black/10 dark:text-[#e8eaed] dark:hover:bg-white/[0.1] dark:active:bg-white/[0.14]"
                disabled={actionSubmitting}
                onClick={() => setLessonStatusOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded-lg border border-black/10 bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 active:bg-black/90 dark:border-[#b8d97a]/40 dark:bg-[var(--ds-sage-strong)] dark:text-[#121212] dark:hover:bg-[var(--ds-sage-hover)] dark:active:opacity-95"
                disabled={actionSubmitting}
                onClick={() => void saveLessonStatus()}
              >
                {actionSubmitting ? <Loader2 className="mx-auto size-4 animate-spin" aria-hidden /> : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {availabilityOpen ? (
        <div className="fixed inset-0 z-[60] flex justify-start bg-black/25">
          <div className="h-full w-full max-w-[540px] overflow-auto rounded-r-[16px] border-r border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#1a1d21]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-[#202124] dark:text-white">Стандартный период времени для встреч</h3>
              <TooltipIconButton tooltip="Закрыть" onClick={() => setAvailabilityOpen(false)}>
                <X size={18} />
              </TooltipIconButton>
            </div>
            <div className="mb-4 rounded-lg bg-[#f1f3f4] px-3 py-2 text-sm text-[#5f6368] dark:bg-[#23272d] dark:text-[#b0b6c0]">
              {copiedIntervals ? `Скопировано интервалов: ${copiedIntervals.length}` : "Скопируйте день и вставьте его расписание в другой день"}
            </div>
            {availabilityNotice ? (
              <div className="mb-4 rounded-lg bg-[#fce8e6] px-3 py-2 text-sm text-[#b3261e] dark:bg-[#3a2224] dark:text-[#ffb4ab]">
                {availabilityNotice}
              </div>
            ) : null}
            <div className="space-y-4">
              {WEEKDAY_KEYS_ORDER.map((dayKey, idx) => (
                <div key={dayKey} className="rounded-lg bg-[#f1f3f4] p-4 dark:bg-[#23272d]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xl font-semibold text-[#202124] dark:text-[#e8eaed]">{WEEKDAY_RU[idx]}</div>
                    <div className="flex items-center gap-1">
                      <TooltipIconButton tooltip="Добавить ещё один период для этого дня" onClick={() => addAvailabilityInterval(dayKey)}>
                        <Plus size={18} />
                      </TooltipIconButton>
                      <TooltipIconButton tooltip="Нет свободного времени в этот день" onClick={() => setDayUnavailable(dayKey)}>
                        <Ban size={18} />
                      </TooltipIconButton>
                      <TooltipIconButton tooltip="Скопировать в буфер" onClick={() => copyDayAvailability(dayKey)}>
                        <Copy size={18} />
                      </TooltipIconButton>
                      <TooltipIconButton tooltip="Вставить из буфера в этот день" onClick={() => pasteDayAvailability(dayKey)} disabled={!copiedIntervals}>
                        <ClipboardPaste size={18} />
                      </TooltipIconButton>
                      <TooltipIconButton tooltip="Копировать этот шаблон во все дни" onClick={() => copyAllDaysAvailability(dayKey)}>
                        <Clipboard size={18} />
                      </TooltipIconButton>
                    </div>
                  </div>
                  {(template[dayKey] ?? []).length === 0 ? (
                    <div className="rounded-lg bg-[#e8eaed] px-4 py-3 text-base text-[#5f6368] dark:bg-[#2b3038] dark:text-[#b0b6c0]">
                      Нельзя запланировать
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(template[dayKey] ?? []).map((interval, i) => (
                        <div key={`${dayKey}-${i}`} className="flex items-center gap-2">
                          {(() => {
                            const startOpts = HOUR_OPTIONS.filter((opt) => toMinutes(opt) < toMinutes(interval.end))
                            const endOpts = END_HOUR_OPTIONS.filter((opt) => toMinutes(opt) > toMinutes(interval.start))
                            return (
                              <>
                          <TimeSelect
                            value={interval.start}
                            options={startOpts.length > 0 ? startOpts : HOUR_OPTIONS}
                            onChange={(value) => updateAvailabilityInterval(dayKey, i, { start: value })}
                          />
                          <span className="text-[#5f6368] dark:text-[#b0b6c0]">-</span>
                          <TimeSelect
                            value={interval.end}
                            options={endOpts.length > 0 ? endOpts : END_HOUR_OPTIONS}
                            onChange={(value) => updateAvailabilityInterval(dayKey, i, { end: value })}
                          />
                              </>
                            )
                          })()}
                          <TooltipIconButton tooltip="Удалить интервал" onClick={() => deleteAvailabilityInterval(dayKey, i)}>
                            <Trash2 size={16} />
                          </TooltipIconButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-black/10 bg-black px-6 py-2.5 text-base font-medium text-white transition-colors hover:bg-black/85 active:bg-black/90 dark:border-[#b8d97a]/40 dark:bg-[var(--ds-sage-strong)] dark:text-[#121212] dark:hover:bg-[var(--ds-sage-hover)] dark:active:opacity-95"
                onClick={() => void saveChanges()}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1a1d21]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <h2 className="text-2xl font-semibold text-[#202124] dark:text-white">Создать занятие</h2>
                <div
                  className="mt-3 flex w-full max-w-md gap-2 rounded-[12px] bg-[#f1f3f4] p-1.5 dark:bg-[#2a2d31]"
                  role="tablist"
                  aria-label="Тип занятия"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={createScheduleKind === "recurring"}
                    className={`flex-1 rounded-[10px] py-2.5 text-sm font-medium transition-all duration-150 ${
                      createScheduleKind === "recurring"
                        ? "border border-black/[0.08] bg-white text-[#202124] shadow-sm dark:border-white/10 dark:bg-[#1a1d21] dark:text-white"
                        : "border border-transparent bg-transparent text-[#5f6368] hover:bg-black/[0.04] hover:text-[#202124] dark:text-[#b0b6c0] dark:hover:bg-white/[0.06] dark:hover:text-white"
                    }`}
                    onClick={() => {
                      if (createScheduleKind === "recurring") return
                      setCreateWeekdays(
                        createWeekdaysBackupRef.current.length > 0 ? [...createWeekdaysBackupRef.current] : [1, 4]
                      )
                      setCreateScheduleKind("recurring")
                    }}
                  >
                    Регулярное
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={createScheduleKind === "single"}
                    className={`flex-1 rounded-[10px] py-2.5 text-sm font-medium transition-all duration-150 ${
                      createScheduleKind === "single"
                        ? "border border-black/[0.08] bg-white text-[#202124] shadow-sm dark:border-white/10 dark:bg-[#1a1d21] dark:text-white"
                        : "border border-transparent bg-transparent text-[#5f6368] hover:bg-black/[0.04] hover:text-[#202124] dark:text-[#b0b6c0] dark:hover:bg-white/[0.06] dark:hover:text-white"
                    }`}
                    onClick={() => {
                      if (createScheduleKind === "single") return
                      createWeekdaysBackupRef.current =
                        createWeekdays.length > 0 ? [...createWeekdays] : createWeekdaysBackupRef.current
                      setCreateScheduleKind("single")
                    }}
                  >
                    Разовое
                  </button>
                </div>
              </div>
              <TooltipIconButton
                tooltip="Закрыть"
                onClick={() => {
                  setCreateOpen(false)
                  setCreateFeedback(null)
                }}
              >
                <X size={18} />
              </TooltipIconButton>
            </div>
            <div className="space-y-4">
              {createScheduleKind === "recurring" ? (
                <div>
                  <div className="mb-2 text-sm font-medium text-[#5f6368] dark:text-[#b0b6c0]">Дни недели</div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_RU.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        className={`rounded-lg px-4 py-2 text-sm transition-colors ${createWeekdays.includes(idx) ? "bg-[#d2e3fc] text-[#174ea6] hover:bg-[#c5daf8]" : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e3e7eb] dark:bg-[#2a2d31] dark:text-[#b0b6c0] dark:hover:bg-[#3a3f46]"}`}
                        onClick={() =>
                          setCreateWeekdays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]))
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#5f6368] dark:text-[#b0b6c0]">
                  Одна дата и время — занятие появится только в выбранный день.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-sm text-[#5f6368] dark:text-[#b0b6c0]">
                  <span className="block">{createScheduleKind === "single" ? "Дата занятия" : "Начиная с даты"}</span>
                  <div className="mt-2">
                    <DateMiniSelect
                      value={createStartDateKey}
                      onChange={setCreateStartDateKey}
                    />
                  </div>
                </div>
                <div className="text-sm text-[#5f6368] dark:text-[#b0b6c0]">
                  <span className="block">Время</span>
                  <div className="mt-2">
                    <TimeSelect
                      value={`${String(createHour).padStart(2, "0")}:00`}
                      options={HOUR_OPTIONS}
                      onChange={(value) => setCreateHour(Number(value.slice(0, 2)))}
                      fullWidth
                    />
                  </div>
                </div>
                {createScheduleKind === "recurring" ? (
                  <label className="text-sm text-[#5f6368] dark:text-[#b0b6c0]">
                    Горизонт (недель)
                    <div className="mt-2 flex h-11 w-full items-stretch overflow-hidden rounded-lg border border-black/10 bg-[#f8f9fa] dark:border-white/10 dark:bg-[#23272d]">
                      <input
                        type="number"
                        min={1}
                        max={26}
                        value={createWeeks}
                        onChange={(e) => setCreateWeeks(Math.min(26, Math.max(1, Number(e.target.value) || 1)))}
                        className="h-11 w-full bg-transparent px-3 py-2 text-[#202124] outline-none [appearance:textfield] dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <div className="flex flex-col border-l border-black/10 dark:border-white/10">
                        <button
                          type="button"
                          className="flex h-5 w-10 items-center justify-center text-[#5f6368] hover:bg-black/5 dark:text-[#b0b6c0] dark:hover:bg-white/10"
                          onClick={() => setCreateWeeks((prev) => Math.min(26, prev + 1))}
                          aria-label="Увеличить горизонт недель"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="flex h-5 w-10 items-center justify-center text-[#5f6368] hover:bg-black/5 dark:text-[#b0b6c0] dark:hover:bg-white/10"
                          onClick={() => setCreateWeeks((prev) => Math.max(1, prev - 1))}
                          aria-label="Уменьшить горизонт недель"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    </div>
                  </label>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="col-span-2 text-sm text-[#5f6368]">
                  Название занятия
                  <input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    className="mt-2 h-11 w-full rounded-md bg-[#f8f9fa] px-3 py-2 text-[#202124] dark:bg-[#23272d] dark:text-white"
                    placeholder="Например: Занятие с Ириной"
                  />
                </label>
                <div className="text-sm text-[#5f6368]">
                  <span className="block">Тип</span>
                  <div className="mt-2">
                    <CustomSelect
                      value={createMode}
                      options={[
                        { value: "booked", label: "Занято учеником" },
                        { value: "busy", label: "Просто занято" }
                      ]}
                      onChange={(value) => setCreateMode(value as "busy" | "booked")}
                    />
                  </div>
                </div>
                <div className="text-sm text-[#5f6368]">
                  <span className="block">Ученик</span>
                  <div className="mt-2">
                    <CustomSelect
                      value={createStudentId}
                      options={[{ value: "", label: "Выбрать ученика" }, ...students.map((s) => ({ value: s.id, label: s.name }))]}
                      onChange={setCreateStudentId}
                      disabled={createMode !== "booked"}
                    />
                  </div>
                </div>
              </div>
            </div>
            {createPastSlotHint.firstInPast ? (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
                <p className="font-medium">
                  В часовом поясе календаря выбранное время на ближайшую дату из шаблона уже прошло — такое занятие создать нельзя.
                </p>
                {createPastSlotHint.suggestedStart ? (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-amber-950/90 dark:text-amber-100/90">
                      Следующее доступное занятие в этом же расписании:{" "}
                      <span className="font-semibold">
                        {formatDateKeyLongRuForHint(createPastSlotHint.suggestedStart)},{" "}
                        {String(createHour).padStart(2, "0")}:00
                      </span>
                    </p>
                    <button
                      type="button"
                      className="shrink-0 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black/85 active:scale-[0.99] dark:bg-black dark:text-white dark:hover:bg-black/85"
                      onClick={() => setCreateStartDateKey(createPastSlotHint.suggestedStart!)}
                    >
                      {createScheduleKind === "single" ? "Установить эту дату" : "Начать с этой даты"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs opacity-90">
                    {createScheduleKind === "single"
                      ? "Сдвиньте дату «Дата занятия» или выберите другое время."
                      : "Сдвиньте дату «Начиная с даты», выберите другие дни недели или другое время."}
                  </p>
                )}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={createSaving}
                className="rounded-lg px-4 py-2 text-sm text-[#202124] transition-colors hover:bg-black/5 active:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:bg-white/10 dark:active:bg-white/[0.14]"
                onClick={() => {
                  setCreateOpen(false)
                  setCreateFeedback(null)
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="inline-flex min-w-[116px] items-center justify-center gap-2 rounded-lg border border-black/10 bg-black px-5 py-2 text-sm font-medium text-white shadow-sm transition-[transform,box-shadow,background-color] duration-150 hover:bg-[#2d2d2d] hover:shadow-md active:scale-[0.98] active:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 dark:border-white/15 dark:bg-white dark:text-black dark:hover:bg-[#f0f0f0] dark:hover:shadow-md dark:active:bg-[#e8e8e8] dark:focus-visible:ring-white/50"
                disabled={
                  createSaving ||
                  createPastSlotHint.firstInPast ||
                  (createScheduleKind === "recurring" && createWeekdays.length === 0) ||
                  (createMode === "booked" && !createStudentId)
                }
                aria-busy={createSaving}
                onClick={() => void createRecurringEvent()}
              >
                {createSaving ? (
                  <>
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    Сохранение…
                  </>
                ) : (
                  "Сохранить"
                )}
              </button>
            </div>
            {createFeedback ? (
              <div className="mt-3 rounded-lg border border-[#b3261e]/25 bg-[#fce8e6] px-3 py-2 text-sm text-[#7f1d1d]">{createFeedback}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {createSuccessOpen && createSuccessPayload ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6"
          role="alertdialog"
          aria-labelledby="create-recurring-success-title"
          aria-live="polite"
        >
          <div className="w-full max-w-lg rounded-[28px] bg-[var(--ds-sage)] px-6 py-10 text-center shadow-2xl">
            <p id="create-recurring-success-title" className="text-2xl font-bold leading-snug text-black">
              {createSuccessPayload.scheduleKind === "single"
                ? `Создано разовое занятие «${createSuccessPayload.lessonTitle}»`
                : `Создано занятие «${createSuccessPayload.lessonTitle}» на регулярной основе`}
            </p>
            <CreateRecurringSuccessDetails payload={createSuccessPayload} />
            {createSuccessPayload.warning ? (
              <p className="mt-3 text-sm font-semibold text-black/80">{createSuccessPayload.warning}</p>
            ) : null}
            <button
              type="button"
              className="mt-8 rounded-xl bg-black px-8 py-3 text-base font-semibold text-white hover:bg-black/85"
              onClick={() => {
                setCreateSuccessOpen(false)
                setCreateSuccessPayload(null)
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/25 p-8 dark:bg-black/45">
          <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#1a1d21]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#202124] dark:text-white">Поиск встреч и учеников</h3>
              <TooltipIconButton tooltip="Закрыть" onClick={() => setSearchOpen(false)}>
                <X size={18} />
              </TooltipIconButton>
            </div>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Введите имя ученика или название встречи"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-base text-[#202124] placeholder:text-[#9aa0a6] outline-none focus:border-[#1a73e8]/50 focus:ring-2 focus:ring-[#1a73e8]/20 dark:border-white/15 dark:bg-[#23272d] dark:text-white dark:placeholder:text-[#9aa0a6] dark:focus:border-[#8ab4f8]/50 dark:focus:ring-[#8ab4f8]/20"
            />
            <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-black/10 bg-[#fafafa] dark:border-white/10 dark:bg-[#23272d]">
              {searchResults.length === 0 ? (
                <div className="p-4 text-sm text-[#5f6368] dark:text-[#b0b6c0]">Ничего не найдено</div>
              ) : (
                searchResults.map((r, idx) => (
                  <button
                    key={`${r.label}-${idx}`}
                    type="button"
                    className="flex w-full items-center justify-between border-b border-black/5 px-4 py-3 text-left transition-colors hover:bg-[#f8f9fa] last:border-b-0 dark:border-white/10 dark:hover:bg-[#2a2f36]"
                    onClick={() => {
                      setAnchorDate(new Date(r.day))
                      setSearchOpen(false)
                      setScheduleSearchPulse(r.pulse)
                    }}
                  >
                    <span className="text-sm font-medium text-[#202124] dark:text-[#e8eaed]">{r.label}</span>
                    <span className="text-xs text-[#5f6368] dark:text-[#b0b6c0]">{r.time}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 dark:bg-black/45">
          <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a1d21]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#202124] dark:text-white">Настройки календаря</h3>
              <TooltipIconButton tooltip="Закрыть" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
              </TooltipIconButton>
            </div>
            <label className="mb-3 block text-sm text-[#5f6368] dark:text-[#b0b6c0]">
              Часовой пояс
              <div className="mt-1">
                <CustomSelect
                  value={timezone}
                  options={TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: formatTimeZoneOption(tz) }))}
                  onChange={setTimezone}
                />
              </div>
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#f8f9fa] px-3 py-2 text-sm text-[#202124] dark:bg-[#23272d] dark:text-[#e8eaed]">
              Показывать выходные в виде недели
              <input
                type="checkbox"
                checked={showWeekends}
                onChange={(e) => setShowWeekends(e.target.checked)}
                className="size-4 shrink-0 rounded border-black/20 text-[#1a73e8] accent-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/30 dark:border-white/30 dark:accent-[#8ab4f8] dark:focus:ring-[#8ab4f8]/30"
              />
            </label>
          </div>
        </div>
      ) : null}

      {actionToast ? (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-[#202124] px-3 py-2 text-sm text-white shadow-lg">
          {actionToast}
        </div>
      ) : null}

      {actionResultPopup ? (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/35 p-4" onClick={() => setActionResultPopup(null)}>
          <div
            className={`w-full max-w-md rounded-2xl p-6 text-center shadow-2xl ${
              actionResultPopup.tone === "success"
                ? "bg-[var(--ds-sage)] text-black"
                : "bg-[#f6dede] text-black dark:bg-[#f2caca]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-2xl font-semibold">{actionResultPopup.title}</p>
            {actionResultPopup.studentName ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="h-8 w-8 overflow-hidden rounded-full bg-black/10">
                  <img
                    src={actionResultPopup.studentAvatarUrl || "/students/yana.png"}
                    alt={actionResultPopup.studentName}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="text-sm font-medium opacity-90">Ученик: {actionResultPopup.studentName}</span>
              </div>
            ) : null}
            <p className="mt-2 text-sm opacity-80">{actionResultPopup.message}</p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85"
                onClick={() => setActionResultPopup(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notificationDetails ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#1a1d21]">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#202124] dark:text-white">{notificationDetails.title}</h4>
              <TooltipIconButton tooltip="Закрыть" onClick={() => setNotificationDetails(null)}>
                <X size={16} />
              </TooltipIconButton>
            </div>
            <div className="space-y-2 text-sm text-[#5f6368] dark:text-[#b0b6c0]">
              <p><span className="font-medium text-[#202124] dark:text-white">Ученик:</span> {notificationDetails.studentName ?? "не указан"}</p>
              <p><span className="font-medium text-[#202124] dark:text-white">Было:</span> {notificationDetails.fromLabel ?? "нет данных"}</p>
              <p><span className="font-medium text-[#202124] dark:text-white">Стало:</span> {notificationDetails.toLabel ?? "нет данных"}</p>
              <p>{notificationDetails.message}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg px-3 py-2 text-sm hover:bg-black/5" onClick={() => setNotificationDetails(null)}>Закрыть</button>
              <button
                className="rounded-lg border border-black/10 bg-black px-3 py-2 text-sm text-white hover:bg-black/85 dark:bg-white dark:text-black"
                onClick={() => {
                  if (notificationDetails.targetDateKey) {
                    const d = parseYmd(notificationDetails.targetDateKey)
                    if (d) setAnchorDate(d)
                  }
                  setNotificationDetails(null)
                }}
              >
                Перейти в календарь
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TooltipIconButton({
  tooltip,
  onClick,
  disabled,
  children
}: {
  tooltip: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const tooltipRef = useRef<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const btn = buttonRef.current
      const tip = tooltipRef.current
      if (!btn || !tip) return
      const rect = btn.getBoundingClientRect()
      const tipRect = tip.getBoundingClientRect()
      const pad = 8
      const centerX = rect.left + rect.width / 2
      const minCenter = pad + tipRect.width / 2
      const maxCenter = window.innerWidth - pad - tipRect.width / 2
      const left = Math.max(minCenter, Math.min(maxCenter, centerX))
      const belowTop = rect.bottom + 6
      const aboveTop = rect.top - tipRect.height - 6
      const top = belowTop + tipRect.height <= window.innerHeight - pad ? belowTop : Math.max(pad, aboveTop)
      setPosition({ left, top })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, tooltip])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={disabled ? undefined : onClick}
        onMouseEnter={() => !disabled && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-disabled={disabled}
        className={`relative rounded-lg p-2.5 text-[#3c4043] hover:bg-black/5 dark:text-[#e8eaed] dark:hover:bg-white/10 ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      >
        {children}
      </button>
      {open ? (
        <span
          ref={tooltipRef}
          className="pointer-events-none fixed z-[120] max-w-[220px] -translate-x-1/2 rounded-[6px] bg-[#202124] px-2 py-1 text-center text-[11px] leading-snug text-white shadow-md"
          style={{ left: position.left, top: position.top }}
        >
          {tooltip}
        </span>
      ) : null}
    </>
  )
}

function TimeSelect({
  value,
  options,
  onChange,
  fullWidth,
  disabledOptions
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
  fullWidth?: boolean
  disabledOptions?: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onDocPointerDown, true)
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? "w-full" : "w-36"}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2 text-base text-[#202124] dark:border-white/10 dark:bg-[#1a1d21] dark:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{value}</span>
        <ChevronDown size={16} className="text-[#5f6368] dark:text-[#b0b6c0]" />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-[95] flex max-h-56 w-full flex-col gap-1 overflow-auto rounded-lg border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#23272d]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              disabled={Boolean(disabledOptions?.has(opt))}
              className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                disabledOptions?.has(opt)
                  ? "cursor-not-allowed text-[#a0a6ad] dark:text-[#6b7280]"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              } ${opt === value ? "bg-[#f1f3f4] dark:bg-[#2f3540]" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                if (disabledOptions?.has(opt)) return
                onChange(opt)
                setOpen(false)
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CustomSelect({
  value,
  options,
  onChange,
  disabled
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const active = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? ""

  useEffect(() => {
    if (!open || disabled) return
    const onDocPointerDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onDocPointerDown, true)
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true)
  }, [open, disabled])

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-md bg-[#f8f9fa] px-3 py-2 text-left text-[#202124] dark:bg-[#23272d] dark:text-white disabled:opacity-50"
      >
        <span className="truncate">{active}</span>
        <ChevronDown size={16} className="text-[#5f6368] dark:text-[#b0b6c0]" />
      </button>
      {open && !disabled ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-[95] flex max-h-56 w-full flex-col gap-1 overflow-auto rounded-md bg-white p-1.5 shadow-xl dark:bg-[#23272d]"
          role="listbox"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value || opt.label}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`w-full rounded-md px-2 py-2 text-left text-sm text-[#202124] hover:bg-black/5 dark:text-[#e8eaed] dark:hover:bg-white/10 ${opt.value === value ? "bg-[#f1f3f4] dark:bg-[#2f3540]" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function toMinutes(v: string): number {
  const [h, m] = v.split(":").map((x) => Number.parseInt(x, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

function getDateTimePartsInTimeZone(date: Date, timeZone: string): {
  dateKey: string
  hour: string
  minute: string
  day: number
  month: number
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date)
  const year = parts.find((p) => p.type === "year")?.value ?? "1970"
  const month = parts.find((p) => p.type === "month")?.value ?? "01"
  const day = parts.find((p) => p.type === "day")?.value ?? "01"
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
    day: Number(day),
    month: Number(month)
  }
}

function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  return getDateTimePartsInTimeZone(date, timeZone).dateKey
}

function weekdayFromDateKey(dateKey: string): WeekdayKey {
  const d = new Date(`${dateKey}T12:00:00`)
  return weekdayFromDate(d)
}

function getDayOfMonthInTimeZone(date: Date, timeZone: string): number {
  return getDateTimePartsInTimeZone(date, timeZone).day
}

function getWeekdayLabelInTimeZone(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("ru-RU", { timeZone, weekday: "short" }).format(date)
  return label.replace(".", "").slice(0, 2).toUpperCase()
}

function formatTimeZoneOption(tz: string): string {
  const city = tz.includes("/") ? tz.split("/").at(-1)?.replace(/_/g, " ") ?? tz : tz
  const offset = getUtcOffsetLabel(tz)
  return `${tz} (${city}, ${offset})`
}

function getUtcOffsetLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit"
    }).formatToParts(new Date())
    const zonePart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0"
    return zonePart.replace("GMT", "UTC")
  } catch {
    return "UTC+0"
  }
}

type CreateRecurringSuccessPayload = {
  lessonTitle: string
  mode: "busy" | "booked"
  warning: string | null
  startDateKey: string
  weekdays: number[]
  hour: number
  weeks: number
  timeZoneId: string
  scheduleKind: "recurring" | "single"
}

function formatDateKeyLongRuUtc(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return dateKey
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(dt)
}

function weeksPhraseRu(n: number): string {
  const k = Math.max(1, Math.floor(n))
  const mod10 = k % 10
  const mod100 = k % 100
  let noun: string
  if (mod100 >= 11 && mod100 <= 14) noun = "недель"
  else if (mod10 === 1) noun = "неделя"
  else if (mod10 >= 2 && mod10 <= 4) noun = "недели"
  else noun = "недель"
  return `${k} ${noun}`
}

function formatWeekdaysDativeListRu(weekdays: number[]): string {
  const uniq = [...new Set(weekdays.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
  const parts = uniq.map((d) => WEEKDAY_RU_DATIVE_PLURAL[d])
  if (parts.length === 0) return ""
  const list = new Intl.ListFormat("ru", { style: "long", type: "conjunction" }).format(parts)
  return `По ${list}`
}

function CreateRecurringSuccessDetails({ payload }: { payload: CreateRecurringSuccessPayload }) {
  const firstKey =
    firstRecurringSlotDateKey(payload.startDateKey, payload.weekdays, payload.weeks) ?? payload.startDateKey
  const dateLong = formatDateKeyLongRuUtc(firstKey)
  const timeStr = `${String(payload.hour).padStart(2, "0")}:00`
  const tzLabel = formatTimeZoneOption(payload.timeZoneId)
  const repeatLine = `${formatWeekdaysDativeListRu(payload.weekdays)}, ${weeksPhraseRu(payload.weeks)} подряд.`

  return (
    <div className="mt-4 space-y-3 text-center text-base font-semibold text-black">
      <p>
        <span className="block text-sm font-normal text-black/70">
          {payload.scheduleKind === "single" ? "Дата занятия" : "Ближайшая дата занятия"}
        </span>
        {dateLong}
      </p>
      <p>
        <span className="block text-sm font-normal text-black/70">Время</span>
        {timeStr}
      </p>
      <p>
        <span className="block text-sm font-normal text-black/70">Часовой пояс этого времени</span>
        {tzLabel}
      </p>
      {payload.scheduleKind === "recurring" ? (
        <p className="pt-1 text-sm font-normal text-black/85">{repeatLine}</p>
      ) : (
        <p className="pt-1 text-sm font-normal text-black/85">Одно занятие в календаре.</p>
      )}
    </div>
  )
}

function fromMinutes(v: number): string {
  const mins = Math.max(0, Math.min(24 * 60, v))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function DateMiniSelect({
  value,
  onChange,
  minDateKey
}: {
  value: string
  onChange: (value: string) => void
  minDateKey?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = parseYmd(value) ?? new Date()
  const [monthAnchor, setMonthAnchor] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))

  const monthStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1)
  const offset = monthStart.getDay()
  const gridStart = addDays(monthStart, -offset)
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onDocPointerDown, true)
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex h-11 w-full items-center justify-between rounded-md bg-[#f8f9fa] px-3 py-2 text-left text-[#202124] dark:bg-[#23272d] dark:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{formatYmdLabel(value)}</span>
        <CalendarDays size={16} />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[95] w-[320px] rounded-lg bg-white p-3 shadow-xl dark:bg-[#23272d]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold capitalize text-[#202124] dark:text-white">
              {monthAnchor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map((d) => (
              <div key={d} className="pb-1 text-[11px] text-[#888] dark:text-[#b0b6c0]">
                {d}
              </div>
            ))}
            {gridDays.map((d) => {
              const inMonth = d.getMonth() === monthAnchor.getMonth()
              const active = d.toDateString() === selected.toDateString()
              const ymd = toYmd(d)
              const disabled = Boolean(minDateKey && ymd < minDateKey)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] text-sm transition-colors ${
                    active
                      ? "bg-ds-sage text-ds-ink dark:bg-[var(--ds-sage-strong)] dark:text-[#121212]"
                      : disabled
                        ? "cursor-not-allowed text-[#c2c7cc] dark:text-[#59606a]"
                      : inMonth
                        ? "text-ds-ink hover:bg-ds-surface-hover dark:text-[#e8eaed] dark:hover:bg-white/10"
                        : "text-[#9aa0a6] dark:text-[#6b7280]"
                  }`}
                  disabled={disabled}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (disabled) return
                    onChange(ymd)
                    setOpen(false)
                  }}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatYmdLabel(value: string): string {
  const d = parseYmd(value)
  if (!d) return value
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
