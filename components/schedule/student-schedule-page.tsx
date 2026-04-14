"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookOpenCheck, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Ellipsis, MessageSquare, Repeat, Star, UserRound, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getAppNow, getAppTodayStart } from "@/lib/app-time"
import { SCHEDULE_WALL_CLOCK_TIMEZONE } from "@/lib/schedule-display-tz"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { addOneDayYmd } from "@/lib/schedule/date-ymd"
import { normalizeScheduleSlotTime, wallClockSlotAtIso } from "@/lib/schedule/slot-time"
import {
  canRescheduleLesson,
  dateKeyFromDate,
  isValidRescheduleTargetSlot,
  isValidStudentBookingTargetSlot,
  parseLessonStart,
  type ScheduledLesson
} from "@/lib/schedule-lessons"
import {
  markScheduleNotificationsRead,
  readScheduleNotifications,
  subscribeScheduleNotifications,
  type ScheduleNotificationItem
} from "@/lib/schedule-notifications"

type FlowStep = "menu" | "type" | "date" | "time" | "success"
type FlowType = "single" | "following"

type DateSlots = Record<string, string[]>
const STUDENT_RESCHEDULE_DAYS_AHEAD = 7
/** Сколько ближайших занятий показывать в списках «Предстоящие» (не календарная сетка). */
const SCHEDULE_UPCOMING_LIST_MAX = 2
type CancelSuccessInfo = { lesson: ScheduledLesson; scope: "single" | "following" }

function lessonStartMs(dateKey: string, time: string): number {
  const slotAt = wallClockSlotAtIso(dateKey, normalizeScheduleSlotTime(time), SCHEDULE_WALL_CLOCK_TIMEZONE)
  return new Date(slotAt).getTime()
}

function dayDiffByDateKey(aDateKey: string, bDateKey: string): number {
  const a = new Date(`${aDateKey}T12:00:00Z`).getTime()
  const b = new Date(`${bDateKey}T12:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((a - b) / (24 * 60 * 60 * 1000))
}

export function StudentSchedulePage() {
  const { user } = useAuth()
  const [lessons, setLessons] = useState<ScheduledLesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<ScheduledLesson | null>(null)
  const [flowStep, setFlowStep] = useState<FlowStep>("menu")
  const [flowType, setFlowType] = useState<FlowType>("single")
  const [dateSlots, setDateSlots] = useState<DateSlots>({})
  const [selectedDateKey, setSelectedDateKey] = useState("")
  const [successText, setSuccessText] = useState("")
  const [desktopAnchorDate, setDesktopAnchorDate] = useState(() => startOfWeekMonday(new Date()))
  const [desktopMenu, setDesktopMenu] = useState<{ x: number; y: number; lesson: ScheduledLesson } | null>(null)
  const [desktopTab, setDesktopTab] = useState<"lessons" | "calendar" | "teachers">("lessons")
  const [cancelConfirmLesson, setCancelConfirmLesson] = useState<ScheduledLesson | null>(null)
  const [cancelSuccessOpen, setCancelSuccessOpen] = useState(false)
  const [cancelSuccessInfo, setCancelSuccessInfo] = useState<CancelSuccessInfo | null>(null)
  const [studentScheduleNotice, setStudentScheduleNotice] = useState<ScheduleNotificationItem | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [planSubmitting, setPlanSubmitting] = useState(false)
  const [cancelSubmittingScope, setCancelSubmittingScope] = useState<"single" | "following" | null>(null)
  const [scheduleSlotsError, setScheduleSlotsError] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [planType, setPlanType] = useState<FlowType>("single")
  const [planStep, setPlanStep] = useState<"type" | "date" | "time">("type")
  const [planDateKey, setPlanDateKey] = useState("")
  const [planLoadingSlots, setPlanLoadingSlots] = useState(false)
  const [planSuccessText, setPlanSuccessText] = useState<string | null>(null)
  const desktopCalendarScrollRef = useRef<HTMLDivElement | null>(null)

  const refreshLessons = useCallback(async () => {
    const res = await fetch("/api/schedule/student-lessons")
    const payload = (await res.json()) as { lessons?: ScheduledLesson[] }
    setLessons(payload.lessons ?? [])
  }, [])

  useEffect(() => {
    if (user?.role !== "student") return
    void refreshLessons()
    const timer = window.setInterval(() => void refreshLessons(), 30000)
    return () => window.clearInterval(timer)
  }, [user, refreshLessons])

  useEffect(() => {
    if (user?.role !== "student") return
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshLessons()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [user, refreshLessons])

  useEffect(() => {
    return () => undefined
  }, [])

  useEffect(() => {
    if (user?.role !== "student") return
    const sync = () => {
      const notices = readScheduleNotifications("student", user.id)
      const firstUnread = notices.find((n) => !n.read) ?? null
      setStudentScheduleNotice(firstUnread)
      // Teacher-side changes should appear immediately in student's lesson lists.
      if (firstUnread) void refreshLessons()
    }
    sync()
    return subscribeScheduleNotifications(sync)
  }, [user, refreshLessons])

  const closeStudentNotice = useCallback(() => {
    if (user?.role === "student") {
      markScheduleNotificationsRead("student", user.id)
    }
    setStudentScheduleNotice(null)
  }, [user])

  const sortedLessons = useMemo(
    () =>
      [...lessons].sort((a, b) => {
        const ta = lessonStartMs(a.dateKey, a.time)
        const tb = lessonStartMs(b.dateKey, b.time)
        return ta - tb
      }),
    [lessons]
  )

  const nowTs = Date.now()
  const upcoming = sortedLessons.filter((l) => lessonStartMs(l.dateKey, l.time) > nowTs)
  const upcomingListPreview = useMemo(
    () => upcoming.slice(0, SCHEDULE_UPCOMING_LIST_MAX),
    [upcoming]
  )
  const past = [...sortedLessons.filter((l) => lessonStartMs(l.dateKey, l.time) <= nowTs)].reverse()

  const weeklyGroups = useMemo(() => {
    const map = new Map<string, { weekday: string; time: string; teacher: string; count: number }>()
    for (const l of upcoming) {
      const dt = parseLessonStart(l.dateKey, l.time)
      const key = `${dt.getDay()}-${l.time}`
      const weekday = dt.toLocaleDateString("ru-RU", { weekday: "long" })
      const prev = map.get(key)
      map.set(key, {
        weekday,
        time: l.time,
        teacher: l.teacher ?? "Преподаватель",
        count: (prev?.count ?? 0) + 1
      })
    }
    return Array.from(map.values()).filter((x) => x.count > 1)
  }, [upcoming])
  const teacherAvatarByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const lesson of sortedLessons) {
      const name = (lesson.teacher ?? "").trim()
      const avatar = lesson.teacherAvatarUrl?.trim()
      if (!name || !avatar) continue
      if (!map.has(name)) map.set(name, avatar)
    }
    return map
  }, [sortedLessons])
  const recurringKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const lesson of sortedLessons) {
      const dt = parseLessonStart(lesson.dateKey, lesson.time)
      const key = `${dt.getDay()}-${lesson.time}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key))
  }, [sortedLessons])
  const teacherVisual = useMemo(() => {
    const source =
      selectedLesson ??
      cancelSuccessInfo?.lesson ??
      sortedLessons.find((l) => Boolean(l.teacher || l.teacherAvatarUrl)) ??
      sortedLessons[0] ??
      null
    return {
      name: source?.teacher ?? "Преподаватель",
      avatar: source?.teacherAvatarUrl || "/staff/zhao-li.png"
    }
  }, [cancelSuccessInfo?.lesson, selectedLesson, sortedLessons])
  const isRecurringLesson = useCallback(
    (lesson: ScheduledLesson) => {
      const targetWeekday = parseLessonStart(lesson.dateKey, lesson.time).getDay()
      const targetTime = normalizeScheduleSlotTime(lesson.time)
      const targetTeacher = (lesson.teacherId ?? lesson.teacher ?? "").trim()
      const siblings = sortedLessons.filter((candidate) => {
        if (candidate.id === lesson.id) return false
        if (normalizeScheduleSlotTime(candidate.time) !== targetTime) return false
        if (parseLessonStart(candidate.dateKey, candidate.time).getDay() !== targetWeekday) return false
        const teacher = (candidate.teacherId ?? candidate.teacher ?? "").trim()
        if (targetTeacher && teacher && teacher !== targetTeacher) return false
        return true
      })
      return siblings.some((candidate) => {
        const diff = Math.abs(dayDiffByDateKey(candidate.dateKey, lesson.dateKey))
        return diff >= 7 && diff % 7 === 0
      })
    },
    [sortedLessons]
  )

  const desktopDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(desktopAnchorDate, i)), [desktopAnchorDate])
  const desktopDayKeys = useMemo(() => desktopDays.map((d) => toDateKey(d)), [desktopDays])
  const weekStartTs = desktopDays[0]?.getTime() ?? 0
  const weekEndTs = (desktopDays[6]?.getTime() ?? 0) + 24 * 60 * 60 * 1000
  const desktopLessons = useMemo(
    () =>
      sortedLessons.filter((l) => {
        const ts = lessonStartMs(l.dateKey, l.time)
        return ts >= weekStartTs && ts < weekEndTs
      }),
    [sortedLessons, weekEndTs, weekStartTs]
  )
  const desktopHours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const weeklySlotsByWeekday = useMemo(() => {
    const map: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    for (const [dateKey, slots] of Object.entries(dateSlots)) {
      const weekday = parseLessonStart(dateKey, "00:00").getDay()
      for (const slot of slots) {
        if (!map[weekday].includes(slot)) map[weekday].push(slot)
      }
    }
    for (const weekday of Object.keys(map)) {
      map[Number(weekday)].sort()
    }
    return map
  }, [dateSlots])
  const strictRescheduleDateSlots = useMemo(() => {
    const byDate: DateSlots = {}
    for (const [dateKey, slots] of Object.entries(dateSlots)) {
      const filtered = slots.filter((time) => isValidRescheduleTargetSlot(dateKey, time))
      if (filtered.length > 0) byDate[dateKey] = filtered
    }
    return byDate
  }, [dateSlots])
  const teacherCards = useMemo(() => {
    const byTeacher = new Map<string, { name: string; avatarUrl?: string; upcoming: number; past: number }>()
    for (const lesson of sortedLessons) {
      const name = lesson.teacher?.trim() || "Преподаватель"
      const prev = byTeacher.get(name) ?? { name, avatarUrl: lesson.teacherAvatarUrl, upcoming: 0, past: 0 }
      const ts = lessonStartMs(lesson.dateKey, lesson.time)
      if (ts > nowTs) prev.upcoming += 1
      else prev.past += 1
      if (!prev.avatarUrl && lesson.teacherAvatarUrl) prev.avatarUrl = lesson.teacherAvatarUrl
      byTeacher.set(name, prev)
    }
    return Array.from(byTeacher.values())
      .map((x) => ({
        ...x,
        moduleRemaining: Math.max(0, 16 - x.past)
      }))
      .sort((a, b) => b.upcoming - a.upcoming)
  }, [nowTs, sortedLessons])
  const desktopMenuStyle = useMemo(() => {
    if (!desktopMenu) return undefined
    const MENU_WIDTH = 320
    const GAP = 8
    if (typeof window === "undefined") {
      return { left: desktopMenu.x + GAP, top: desktopMenu.y + GAP }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxLeft = Math.max(GAP, vw - MENU_WIDTH - GAP)
    const left = Math.min(Math.max(GAP, desktopMenu.x + GAP), maxLeft)
    // Keep some bottom safe space so menu does not clip vertically.
    const top = Math.min(Math.max(GAP, desktopMenu.y + GAP), Math.max(GAP, vh - 260))
    return { left, top }
  }, [desktopMenu])

  useEffect(() => {
    if (desktopTab !== "calendar") return
    const el = desktopCalendarScrollRef.current
    if (!el) return
    // Open at 08:00 by default; user can scroll earlier/later.
    el.scrollTop = 8 * 56
  }, [desktopTab, desktopAnchorDate])

  /** Общая загрузка слотов для переноса (и из карточки урока, и из меню «⋯» на десктопе). */
  const loadRescheduleSlotsForLesson = useCallback(async (lesson: ScheduledLesson) => {
    setDateSlots({})
    setScheduleSlotsError(null)
    setSlotsLoading(true)
    try {
      const now = getAppNow()
      const to = new Date(now)
      to.setDate(to.getDate() + STUDENT_RESCHEDULE_DAYS_AHEAD)
      const teacherParam = lesson.teacherId ? `&teacher_id=${encodeURIComponent(lesson.teacherId)}` : ""
      const res = await fetch(
        `/api/schedule?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}${teacherParam}`
      )
      const payload = (await res.json()) as { slots?: Array<{ slot_at: string }>; error?: string }
      if (!res.ok) {
        setScheduleSlotsError(payload.error ?? "Не удалось загрузить свободные слоты")
        setDateSlots({})
        return
      }
      const byDate: DateSlots = {}
      for (const s of payload.slots ?? []) {
        const { dateKey, time } = wallClockFromSlotAt(s.slot_at)
        const timeNorm = normalizeScheduleSlotTime(time)
        if (!isValidStudentBookingTargetSlot(dateKey, timeNorm)) continue
        const prev = byDate[dateKey] ?? []
        if (!prev.includes(timeNorm)) byDate[dateKey] = [...prev, timeNorm]
      }
      setDateSlots(byDate)
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  const openLesson = async (lesson: ScheduledLesson) => {
    setSelectedLesson(lesson)
    setFlowStep("menu")
    setFlowType("single")
    setSelectedDateKey("")
    await loadRescheduleSlotsForLesson(lesson)
  }
  const loadDateSlots = async () => {
    setPlanLoadingSlots(true)
    setScheduleSlotsError(null)
    try {
      const now = getAppNow()
      const to = new Date(now)
      to.setDate(to.getDate() + STUDENT_RESCHEDULE_DAYS_AHEAD)
      const teacherId = selectedLesson?.teacherId || upcoming[0]?.teacherId || lessons[0]?.teacherId
      const teacherParam = teacherId ? `&teacher_id=${encodeURIComponent(teacherId)}` : ""
      const res = await fetch(
        `/api/schedule?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}${teacherParam}`
      )
      const payload = (await res.json()) as { slots?: Array<{ slot_at: string }>; error?: string }
      if (!res.ok) {
        setScheduleSlotsError(payload.error ?? "Не удалось загрузить свободные слоты")
        setDateSlots({})
        return {}
      }
      const byDate: DateSlots = {}
      for (const s of payload.slots ?? []) {
        const { dateKey, time } = wallClockFromSlotAt(s.slot_at)
        const timeNorm = normalizeScheduleSlotTime(time)
        if (!isValidStudentBookingTargetSlot(dateKey, timeNorm)) continue
        const prev = byDate[dateKey] ?? []
        if (!prev.includes(timeNorm)) byDate[dateKey] = [...prev, timeNorm]
      }
      setDateSlots(byDate)
      return byDate
    } finally {
      setPlanLoadingSlots(false)
    }
  }
  const openPlanLesson = async () => {
    setPlanOpen(true)
    setPlanType("single")
    setPlanStep("type")
    setPlanDateKey("")
    setActionError(null)
    void loadDateSlots()
  }
  const planLesson = async (time: string) => {
    if (!planDateKey) return
    setActionError(null)
    setPlanSubmitting(true)
    try {
      const res = await fetch("/api/schedule/student-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book",
          teacher_id: selectedLesson?.teacherId || upcoming[0]?.teacherId || lessons[0]?.teacherId,
          scope: planType,
          to_date_key: planDateKey,
          to_hour: Number(time.slice(0, 2))
        })
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; booked?: number }
      if (!res.ok) {
        setActionError(payload.error ?? "Не удалось запланировать урок")
        return
      }
      if (planType === "following" && Number(payload.booked ?? 0) <= 0) {
        setActionError("Не удалось запланировать еженедельные занятия: подходящих слотов не найдено")
        return
      }
      if (planType === "single" && payload.ok !== true) {
        setActionError("Не удалось запланировать занятие")
        return
      }
      if (planType === "following") {
        const weekday = parseLessonStart(planDateKey, "00:00").getDay()
        setPlanSuccessText(`Назначили регулярные занятия по ${formatRecurringWeekdayLabel(weekday)} в ${time}`)
      } else {
        setPlanSuccessText(`Назначили занятие на ${formatDateLabel(planDateKey)} в ${time}`)
      }
      setPlanOpen(false)
      await refreshLessons()
    } catch {
      setActionError("Не удалось запланировать урок из-за сетевой ошибки. Попробуйте ещё раз.")
    } finally {
      setPlanSubmitting(false)
    }
  }

  const closeFlow = () => {
    setSelectedLesson(null)
    setFlowStep("menu")
    setSelectedDateKey("")
  }

  const cancelLesson = async (lesson: ScheduledLesson, scope: "single" | "following" = "single") => {
    setActionError(null)
    setCancelSubmittingScope(scope)
    try {
      const res = await fetch("/api/schedule/student-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          teacher_id: lesson.teacherId,
          scope,
          lesson: { slot_at: `${lesson.dateKey}T${lesson.time}:00`, date_key: lesson.dateKey, time: lesson.time }
        })
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        setActionError(payload.error ?? "Не удалось отменить урок. Попробуйте ещё раз.")
        return false
      }
      closeFlow()
      setCancelConfirmLesson(null)
      await refreshLessons()
      setCancelSuccessInfo({ lesson, scope })
      setCancelSuccessOpen(true)
      return true
    } finally {
      setCancelSubmittingScope(null)
    }
  }

  const openCancelConfirmation = (lesson: ScheduledLesson) => {
    setActionError(null)
    queueMicrotask(() => setCancelConfirmLesson(lesson))
  }

  const doCancel = () => {
    if (!selectedLesson) return
    if (!isRecurringLesson(selectedLesson)) {
      void cancelLesson(selectedLesson, "single")
      return
    }
    openCancelConfirmation(selectedLesson)
  }

  const doReschedule = async (toTime: string) => {
    if (!selectedLesson || !selectedDateKey) return
    setActionError(null)
    setRescheduleSubmitting(true)
    try {
      const res = await fetch("/api/schedule/student-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          teacher_id: selectedLesson.teacherId,
          scope: flowType,
          to_date_key: selectedDateKey,
          to_hour: Number(toTime.slice(0, 2)),
          lesson: { slot_at: `${selectedLesson.dateKey}T${selectedLesson.time}:00`, date_key: selectedLesson.dateKey, time: selectedLesson.time }
        })
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        setActionError(payload.error ?? "Не удалось перенести урок")
        return
      }
      setSuccessText(`${selectedDateKey} · ${toTime}`)
      setFlowStep("success")
      await refreshLessons()
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-4 sm:px-6 md:px-8">
      <h1 className="mb-5 text-center text-3xl font-semibold text-ds-text-primary">Расписание</h1>
      <div className="mb-4 flex justify-center md:hidden">
        <button className="rounded-lg bg-[var(--ds-sage)] px-4 py-2 text-sm font-medium text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => void openPlanLesson()}>
          + Запланировать урок
        </button>
      </div>

      <div className="mb-5 hidden items-center justify-between md:flex">
        <h2 className="text-4xl font-semibold text-ds-text-primary">Мои уроки</h2>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-[var(--ds-sage)] px-4 py-2 text-sm font-medium text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => void openPlanLesson()}>+ Запланировать урок</button>
        </div>
      </div>
      <div className="mb-5 hidden items-center gap-6 border-b border-black/10 dark:border-white/10 pb-3 md:flex">
        <TooltipHint text="Открыть список уроков">
        <button
          className={`inline-flex items-center gap-2 pb-2 text-sm ${desktopTab === "lessons" ? "border-b-2 border-[var(--ds-sage-strong)] font-semibold text-ds-text-primary" : "text-ds-text-muted"}`}
          onClick={() => setDesktopTab("lessons")}
        >
          <Clock3 size={16} strokeWidth={2.4} />
          Уроки
        </button>
        </TooltipHint>
        <TooltipHint text="Открыть календарную сетку">
        <button
          className={`inline-flex items-center gap-2 pb-2 text-sm ${desktopTab === "calendar" ? "border-b-2 border-[var(--ds-sage-strong)] font-semibold text-ds-text-primary" : "text-ds-text-muted"}`}
          onClick={() => setDesktopTab("calendar")}
        >
          <CalendarDays size={16} strokeWidth={2.4} />
          Календарь
        </button>
        </TooltipHint>
        <TooltipHint text="Открыть вкладку преподавателей">
        <button
          className={`inline-flex items-center gap-2 pb-2 text-sm ${desktopTab === "teachers" ? "border-b-2 border-[var(--ds-sage-strong)] font-semibold text-ds-text-primary" : "text-ds-text-muted"}`}
          onClick={() => setDesktopTab("teachers")}
        >
          <BookOpenCheck size={16} strokeWidth={2.4} />
          Преподаватели
        </button>
        </TooltipHint>
      </div>

      <div className={`mb-4 hidden items-center justify-between md:flex ${desktopTab === "calendar" ? "" : "hidden"}`}>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-ds-surface-hover" onClick={() => setDesktopAnchorDate(startOfWeekMonday(new Date()))}>
            Сегодня
          </button>
          <button className="rounded-md border border-black/10 dark:border-white/10 p-2 hover:bg-ds-surface-hover" onClick={() => setDesktopAnchorDate((d) => addDays(d, -7))}><ChevronLeft size={16} /></button>
          <button className="rounded-md border border-black/10 dark:border-white/10 p-2 hover:bg-ds-surface-hover" onClick={() => setDesktopAnchorDate((d) => addDays(d, 7))}><ChevronRight size={16} /></button>
          <div className="ml-2 text-2xl font-semibold text-ds-text-primary">{formatWeekRange(desktopDays[0], desktopDays[6])}</div>
        </div>
        <div className="flex items-center gap-5 text-sm font-semibold text-[#4f4b5f] dark:text-[#c4bdd6]">
          <TooltipHint text="Подтвержденные уроки в календаре">
          <span className="inline-flex items-center gap-1.5">
            <Check size={17} strokeWidth={2.6} />
            Подтверждено
          </span>
          </TooltipHint>
          <TooltipHint text="Регулярный еженедельный слот">
          <span className="inline-flex items-center gap-1.5">
            <Repeat size={17} strokeWidth={2.6} />
            Еженедельно
          </span>
          </TooltipHint>
          <TooltipHint text="Разовый урок в конкретную дату">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={17} strokeWidth={2.6} />
            Разово
          </span>
          </TooltipHint>
        </div>
      </div>

      <div className={`relative mb-8 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface ${desktopTab === "calendar" ? "hidden md:block" : "hidden"}`}>
        <div className="grid border-b border-black/10 dark:border-white/10" style={{ gridTemplateColumns: `70px repeat(7, minmax(110px, 1fr))` }}>
          <div className="border-r border-black/10 dark:border-white/10 px-2 py-2 text-[11px] text-ds-text-muted">GMT</div>
          {desktopDays.map((d, i) => (
            <div key={`hd-${i}`} className="border-r border-black/10 dark:border-white/10 px-3 py-2 text-center last:border-r-0">
              <div className="text-[12px] text-ds-text-muted">{d.toLocaleDateString("ru-RU", { weekday: "short" })}</div>
              <div className="text-sm font-semibold text-ds-text-primary">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div
          ref={desktopCalendarScrollRef}
          className="max-h-[calc(56px*12)] overflow-y-auto overflow-x-hidden ds-hide-scrollbar"
        >
        <div className="grid" style={{ gridTemplateColumns: `70px repeat(7, minmax(110px, 1fr))` }}>
          <div className="border-r border-black/10 dark:border-white/10">
            {desktopHours.map((h) => (
              <div key={`th-${h}`} className="h-14 border-b border-black/10 dark:border-white/10 px-2 py-1 text-xs text-ds-text-muted">{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {desktopDayKeys.map((k) => {
            const dayLessons = desktopLessons.filter((l) => l.dateKey === k)
            return (
              <div key={k} className="relative border-r border-black/10 dark:border-white/10 last:border-r-0">
                {desktopHours.map((h) => (
                  <div key={`${k}-${h}`} className="h-14 border-b border-black/10 dark:border-white/10" />
                ))}
                {dayLessons.map((l) => {
                  const hour = Number(l.time.slice(0, 2))
                  const top = (hour - desktopHours[0]) * 56 + 4
                  const lessonTs = lessonStartMs(l.dateKey, l.time)
                  const isPastLesson = lessonTs <= nowTs
                  const weekday = parseLessonStart(l.dateKey, l.time).getDay()
                  const recurrenceKey = `${weekday}-${l.time}`
                  const isRecurring = recurringKeys.has(recurrenceKey)
                  const cardClass = `absolute left-1 right-1 z-10 rounded-lg border px-2 py-1 pl-10 pr-7 text-left shadow-sm ${
                    isPastLesson
                      ? "cursor-default border-black/10 bg-ds-neutral-row text-ds-text-muted opacity-70 dark:border-white/10"
                      : "border-[var(--ds-sage-strong)] bg-[color-mix(in_srgb,var(--ds-sage)_68%,#ffffff)] hover:bg-[color-mix(in_srgb,var(--ds-sage)_78%,#ffffff)]"
                  }`
                  const cardInner = (
                    <>
                      <span className="absolute left-1.5 top-1.5 h-5 w-5 overflow-hidden rounded-[5px] bg-ds-surface/80">
                        <img
                          src={l.teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                          alt={l.teacher ?? "Преподаватель"}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <TooltipHint text={isRecurring ? "Еженедельный урок" : "Разовый урок"} className="absolute right-1.5 top-1.5 text-[#4f4b5f] dark:text-[#c4bdd6]">
                        {isRecurring ? (
                          <Repeat size={14} strokeWidth={2.6} />
                        ) : (
                          <CalendarCheck2 size={14} strokeWidth={2.6} />
                        )}
                      </TooltipHint>
                      <div className={`text-xs font-medium ${isPastLesson ? "text-ds-text-muted" : "text-ds-text-primary"}`}>{l.time}</div>
                      <div className={`truncate text-xs ${isPastLesson ? "text-ds-text-muted" : "text-ds-text-primary"}`}>{l.teacher ?? "Преподаватель"}</div>
                    </>
                  )
                  return isPastLesson ? (
                    <div
                      key={`desk-${l.id}-${l.time}`}
                      className={cardClass}
                      style={{ top }}
                      role="note"
                      aria-label={`Прошедший урок ${l.time}, ${l.teacher ?? "Преподаватель"}`}
                    >
                      {cardInner}
                    </div>
                  ) : (
                    <button
                      key={`desk-${l.id}-${l.time}`}
                      type="button"
                      className={cardClass}
                      style={{ top }}
                      onClick={(e) => setDesktopMenu({ x: e.clientX, y: e.clientY, lesson: l })}
                    >
                      {cardInner}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        </div>
      </div>

      <div className={`${desktopTab === "lessons" ? "hidden md:block" : "hidden"}`}>
        <Section title="Предстоящие уроки">
          {upcomingListPreview.map((l) => (
            <div key={`up-${l.id}`} className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4">
              <button type="button" className="flex flex-1 items-center gap-3 text-left" onClick={() => void openLesson(l)}>
                <div className="h-12 w-12 overflow-hidden rounded-md bg-[#dfe3e9]">
                  <img
                    src={l.teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                    alt={l.teacher ?? "Преподаватель"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xl font-medium text-ds-text-primary">{capitalize(parseLessonStart(l.dateKey, l.time).toLocaleDateString("ru-RU", { weekday: "long" }))}, {l.time}</div>
                  <div className="text-sm text-ds-text-muted">{l.teacher ?? "Преподаватель"}, {l.title}</div>
                </div>
              </button>
              <button
                type="button"
                className="rounded-md p-1 text-ds-text-primary hover:bg-ds-surface-hover dark:hover:bg-white/10"
                aria-label="Меню урока"
                onClick={(e) => setDesktopMenu({ x: e.clientX, y: e.clientY, lesson: l })}
              >
                <Ellipsis size={20} />
              </button>
            </div>
          ))}
        </Section>

        <Section title="Еженедельные уроки">
          {weeklyGroups.length === 0 ? (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4 text-sm text-ds-text-muted">Нет регулярных занятий</div>
          ) : (
            weeklyGroups.map((g, idx) => (
              <div key={`wg-${idx}`} className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-md bg-[#dfe3e9]">
                    <img
                      src={teacherAvatarByName.get(g.teacher) || "/placeholders/teacher-avatar.svg"}
                      alt={g.teacher}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xl font-medium text-ds-text-primary">Каждый {g.weekday} {g.time}</div>
                    <div className="text-sm text-ds-text-muted">{g.teacher}, {upcoming[0]?.title ?? "Урок"}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1 text-ds-text-primary hover:bg-ds-surface-hover dark:hover:bg-white/10"
                  aria-label="Меню урока"
                  onClick={(e) => {
                    const representativeLesson = upcoming.find((lesson) => {
                      const teacherName = lesson.teacher?.trim() || "Преподаватель"
                      return lesson.time === g.time && teacherName === g.teacher
                    })
                    if (representativeLesson) {
                      setDesktopMenu({ x: e.clientX, y: e.clientY, lesson: representativeLesson })
                      return
                    }
                    // Fallback: open plan flow for recurring lessons if exact lesson wasn't found.
                    setPlanOpen(true)
                    setPlanType("following")
                    setPlanStep("date")
                  }}
                >
                  <Ellipsis size={20} />
                </button>
              </div>
            ))
          )}
        </Section>

        <Section title="Прошедшие уроки">
          {past.map((l) => (
            <div key={`past-desktop-${l.id}`} className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-md bg-[#dfe3e9]">
                  <img
                    src={l.teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                    alt={l.teacher ?? "Преподаватель"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-lg font-medium text-ds-text-primary">{capitalize(parseLessonStart(l.dateKey, l.time).toLocaleDateString("ru-RU", { weekday: "long" }))}, {l.time}</div>
                  <div className="text-sm text-ds-text-muted">{l.teacher ?? "Преподаватель"}, {l.title}</div>
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg border border-black/15 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-ds-surface-hover"><Star size={14} /> Оценить</button>
            </div>
          ))}
        </Section>
      </div>

      <div className={`${desktopTab === "teachers" ? "hidden md:block" : "hidden"}`}>
        <Section title="Мои преподаватели">
          {teacherCards.length === 0 ? (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4 text-sm text-ds-text-muted">
              Пока нет преподавателей с запланированными уроками
            </div>
          ) : (
            teacherCards.map((teacher) => (
              <div
                key={teacher.name}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--ds-sage)]">
                    <img
                      src={teacher.avatarUrl || "/placeholders/teacher-avatar.svg"}
                      alt={teacher.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xl font-semibold text-ds-text-primary">{teacher.name}</div>
                    <div className="text-base text-ds-text-muted">
                      Запланировано: {teacher.upcoming} · До конца модуля: {teacher.moduleRemaining}
                    </div>
                  </div>
                </div>
                <Link
                  href={getTeacherProfileHref(teacher.name)}
                  className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
                >
                  Перейти в профиль
                </Link>
              </div>
            ))
          )}
        </Section>
      </div>

      <div className="md:hidden">
      {upcoming[0] ? (
        <section className="mb-6 rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4">
          <div className="mb-2 text-sm font-medium text-ds-text-muted">Ближайший урок</div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-3xl font-semibold leading-tight text-ds-text-primary">
                {upcoming[0].title}
              </div>
              <div className="mt-2 text-lg text-ds-text-muted">
                {capitalize(parseLessonStart(upcoming[0].dateKey, upcoming[0].time).toLocaleDateString("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "short"
                }).replace(".", ""))} · {upcoming[0].time}
              </div>
            </div>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#e3e6ea]">
              <img
                src={upcoming[0].teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                alt={upcoming[0].teacher ?? "Преподаватель"}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>
      ) : null}
      <Section title="Предстоящие">
        {upcomingListPreview.map((l) => (
          <LessonCard key={l.id} lesson={l} onClick={() => void openLesson(l)} />
        ))}
      </Section>

      <Section title="Регулярные занятия">
        {weeklyGroups.length === 0 ? (
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4 text-sm text-ds-text-muted">Нет регулярных занятий</div>
        ) : (
          weeklyGroups.map((g, idx) => (
            <div key={`${g.weekday}-${idx}`} className="rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4">
              <div className="flex items-center gap-2 text-ds-text-primary"><Repeat size={16} /> Каждый {g.weekday} в {g.time}</div>
              <div className="mt-1 text-sm text-ds-text-muted">{g.teacher}</div>
            </div>
          ))
        )}
      </Section>

      <Section title="Прошедшие">
        {past.map((l) => (
          <div key={`past-${l.id}`} className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface px-4 py-4 opacity-80">
            <div>
              <div className="font-medium text-ds-text-primary">Подтверждено</div>
              <div className="text-sm text-ds-text-muted">{formatLessonSubtitle(l)}</div>
            </div>
            <button className="rounded-lg border border-black/15 dark:border-white/15 px-4 py-2 text-sm font-medium">Оценить</button>
          </div>
        ))}
      </Section>
      </div>

      {desktopMenu ? (
        <div className="fixed inset-0 z-[125]" onClick={() => setDesktopMenu(null)}>
          <div
            className="fixed z-[126] w-[244px] rounded-xl border border-black/10 dark:border-white/10 bg-ds-surface p-1.5 shadow-xl"
            style={desktopMenuStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-medium text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]"
              onClick={() => {
                const lesson = desktopMenu.lesson
                setDesktopMenu(null)
                setSelectedLesson(lesson)
                setFlowType("single")
                setSelectedDateKey("")
                setFlowStep(isRecurringLesson(lesson) ? "type" : "date")
                void loadRescheduleSlotsForLesson(lesson)
              }}
            >
              <CalendarDays size={16} /> Перенести
            </button>
            <Link href="/messages" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-medium text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]">
              <MessageSquare size={16} /> Написать преподавателю
            </Link>
            <Link href="/mentors/zhao-li" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-medium text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]">
              <UserRound size={16} /> Профиль преподавателя
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-medium text-red-700 hover:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-950/40"
              onClick={() => {
                const lesson = desktopMenu.lesson
                setDesktopMenu(null)
                openCancelConfirmation(lesson)
              }}
            >
              <X size={16} /> Отменить урок
            </button>
          </div>
        </div>
      ) : null}

      {selectedLesson ? (
        <LessonModal onClose={closeFlow} successTone={flowStep === "success"}>
          {flowStep === "menu" ? (
            <StepMenu
              lesson={selectedLesson}
              onCancel={doCancel}
              onReschedule={() => setFlowStep(isRecurringLesson(selectedLesson) ? "type" : "date")}
            />
          ) : null}
          {flowStep === "type" ? (
            <StepType
              allowFollowing={isRecurringLesson(selectedLesson)}
              onBack={() => setFlowStep("menu")}
              onPick={(value) => {
                setFlowType(value)
                setFlowStep("date")
              }}
            />
          ) : null}
          {flowStep === "date" ? (
            flowType === "following" ? (
              <StepWeekday
                originWeekday={parseLessonStart(selectedLesson.dateKey, selectedLesson.time).getDay()}
                weeklySlotsByWeekday={weeklySlotsByWeekday}
                onBack={() => setFlowStep(isRecurringLesson(selectedLesson) ? "type" : "menu")}
                onPick={(targetWeekday) => {
                  const candidate = Object.keys(dateSlots)
                    .filter((k) => parseLessonStart(k, "00:00").getDay() === targetWeekday && (dateSlots[k] ?? []).length > 0)
                    .sort()[0]
                  if (candidate) {
                    setSelectedDateKey(candidate)
                  } else {
                    const base = parseLessonStart(selectedLesson.dateKey, "00:00")
                    const baseWeekday = base.getDay()
                    const delta = (targetWeekday - baseWeekday + 7) % 7
                    const target = addDays(base, delta)
                    setSelectedDateKey(toDateKey(target))
                  }
                  setFlowStep("time")
                }}
              />
            ) : (
              <StepDate
                lesson={selectedLesson}
                dateSlots={strictRescheduleDateSlots}
                slotsLoading={slotsLoading}
                slotsError={scheduleSlotsError}
                onBack={() => setFlowStep(isRecurringLesson(selectedLesson) ? "type" : "menu")}
                onPick={(dateKey) => {
                  setSelectedDateKey(dateKey)
                  setFlowStep("time")
                }}
              />
            )
          ) : null}
          {flowStep === "time" ? (
            <StepTime
              lesson={selectedLesson}
              flowType={flowType}
              dateKey={selectedDateKey}
              slots={dateSlots[selectedDateKey] ?? []}
              errorMessage={actionError}
              isSubmitting={rescheduleSubmitting}
              onBack={() => setFlowStep("date")}
              onPick={(time) => void doReschedule(time)}
            />
          ) : null}
          {flowStep === "success" ? (
            <StepSuccess
              value={successText}
              onClose={closeFlow}
              teacherName={teacherVisual.name}
              teacherAvatarUrl={teacherVisual.avatar}
            />
          ) : null}
        </LessonModal>
      ) : null}

      {cancelConfirmLesson ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4" onClick={() => setCancelConfirmLesson(null)}>
          <div className="w-full max-w-md rounded-2xl bg-ds-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold text-ds-text-primary">Отменить урок</h3>
            {isRecurringLesson(cancelConfirmLesson) ? (
              <p className="mt-2 text-sm text-ds-text-muted">
                Выберите, что отменить: только это занятие или всю регулярную цепочку начиная с этого урока.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ds-text-muted">Это разовое занятие. Будет отменен только выбранный урок.</p>
            )}
            {actionError ? (
              <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:bg-red-950/45 dark:text-red-200">{actionError}</div>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-ds-text-primary hover:bg-black/5 dark:hover:bg-white/10"
                disabled={cancelSubmittingScope !== null}
                onClick={() => setCancelConfirmLesson(null)}
              >
                Закрыть
              </button>
              <button
                type="button"
                disabled={cancelSubmittingScope !== null}
                className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-ds-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void cancelLesson(cancelConfirmLesson, "single")}
              >
                {cancelSubmittingScope === "single" ? "Отменяем..." : "Отменить"}
              </button>
              {isRecurringLesson(cancelConfirmLesson) ? (
                <button
                  type="button"
                  disabled={cancelSubmittingScope !== null}
                  className="rounded-lg border border-red-600/25 bg-red-500/10 px-3 py-2 text-sm text-red-800 hover:bg-red-500/15 dark:border-red-500/35 dark:bg-red-950/45 dark:text-red-200 dark:hover:bg-red-950/55 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void cancelLesson(cancelConfirmLesson, "following")}
                >
                  {cancelSubmittingScope === "following" ? "Отменяем..." : "Все последующие"}
                </button>
              ) : null}
            </div>
            {cancelSubmittingScope !== null ? (
              <p className="mt-3 text-xs text-ds-text-muted">Применяем изменения в расписании, это может занять пару секунд.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {cancelSuccessOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 p-6"
          role="alertdialog"
          aria-live="assertive"
          aria-labelledby="student-cancel-success-title"
          onClick={() => {
            setCancelSuccessOpen(false)
            setCancelSuccessInfo(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-black/10 bg-[#ead7d9] px-8 py-8 text-center text-[#161616] shadow-2xl dark:border-white/10 dark:bg-[#3a2b2e] dark:text-[#f5f1f1]"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="student-cancel-success-title" className="text-2xl font-semibold">
              {cancelSuccessInfo?.scope === "following" ? "Отменили все последующие" : "Отменили урок"}
            </p>
            <p className="mt-2 text-sm opacity-80">Слот освобожден в вашем расписании и у преподавателя.</p>
            {cancelSuccessInfo ? (
              <div className="mt-4 rounded-xl bg-black/5 px-4 py-3 text-left text-sm dark:bg-white/10">
                <p className="font-medium">
                  {cancelSuccessInfo.scope === "following"
                    ? formatRecurringCancellationLabel(cancelSuccessInfo.lesson)
                    : formatLessonHeader(cancelSuccessInfo.lesson)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-8 w-8 overflow-hidden rounded-full bg-black/10">
                    <img
                      src={cancelSuccessInfo.lesson.teacherAvatarUrl || teacherVisual.avatar}
                      alt={cancelSuccessInfo.lesson.teacher ?? teacherVisual.name}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <p className="text-xs opacity-90">Преподаватель: {cancelSuccessInfo.lesson.teacher ?? teacherVisual.name}</p>
                </div>
                <p className="mt-1 text-xs opacity-80">
                  {cancelSuccessInfo.scope === "single"
                    ? "Отменили только это занятие"
                    : "Отменили регулярные занятия по этому расписанию"}
                </p>
              </div>
            ) : null}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85"
                onClick={() => {
                  setCancelSuccessOpen(false)
                  setCancelSuccessInfo(null)
                }}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {studentScheduleNotice ? (
        <div className="fixed inset-0 z-[141] flex items-center justify-center bg-black/35 p-6" onClick={closeStudentNotice}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--ds-sage)] px-7 py-7 text-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-2xl font-semibold">{studentScheduleNotice.title}</p>
            <p className="mt-2 text-sm opacity-85">{studentScheduleNotice.message}</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/45 px-4 py-2 text-left text-sm">
              <span className="h-8 w-8 overflow-hidden rounded-full bg-black/10">
                <img src={teacherVisual.avatar} alt={teacherVisual.name} className="h-full w-full object-cover" />
              </span>
              <span className="font-medium">Преподаватель: {teacherVisual.name}</span>
            </div>
            {studentScheduleNotice.fromLabel || studentScheduleNotice.toLabel ? (
              <div className="mt-3 rounded-xl bg-white/45 px-4 py-3 text-left text-sm">
                {studentScheduleNotice.fromLabel ? <p><span className="font-semibold">Было:</span> {studentScheduleNotice.fromLabel}</p> : null}
                {studentScheduleNotice.toLabel ? <p className="mt-1"><span className="font-semibold">Стало:</span> {studentScheduleNotice.toLabel}</p> : null}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85"
                onClick={closeStudentNotice}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {planOpen ? (
        <LessonModal onClose={() => setPlanOpen(false)}>
          {planStep === "type" ? (
            <div>
              <h3 className="mb-4 text-3xl font-semibold text-ds-text-primary">Как запланировать занятие?</h3>
              <button
                type="button"
                disabled={planSubmitting}
                className="mb-2 flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setPlanType("single")
                  setPlanStep("date")
                }}
              >
                <div className="text-lg font-medium">Разовое занятие</div>
                <ChevronRight size={18} className="shrink-0 text-ds-text-muted" />
              </button>
              <button
                type="button"
                disabled={planSubmitting}
                className="flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setPlanType("following")
                  setPlanStep("date")
                }}
              >
                <div className="text-lg font-medium">Еженедельная основа</div>
                <ChevronRight size={18} className="shrink-0 text-ds-text-muted" />
              </button>
              {actionError ? (
                <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:bg-red-950/45 dark:text-red-200">
                  {actionError}
                </div>
              ) : null}
            </div>
          ) : null}
          {planStep === "date" ? (
            planLoadingSlots ? (
              <div>
                <button className="mb-3 rounded-lg px-2 py-1 text-sm text-ds-text-muted hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-text-primary" onClick={() => setPlanStep("type")}>Назад</button>
                <h3 className="mb-2 text-3xl font-semibold text-ds-text-primary">Загружаем доступные слоты...</h3>
                <p className="text-sm text-ds-text-muted">Подождите пару секунд, собираем актуальную доступность преподавателя.</p>
              </div>
            ) : (
            planType === "following" ? (
              <StepWeekday
                weeklySlotsByWeekday={weeklySlotsByWeekday}
                onBack={() => setPlanStep("type")}
                onPick={(weekday) => {
                  const candidate = Object.keys(dateSlots)
                    .filter((k) => parseLessonStart(k, "00:00").getDay() === weekday && (dateSlots[k] ?? []).length > 0)
                    .sort()[0]
                  if (!candidate) {
                    setActionError("На выбранный день недели нет доступных будущих слотов.")
                    return
                  }
                  setActionError(null)
                  setPlanDateKey(candidate)
                  setPlanStep("time")
                }}
              />
            ) : (
              <StepDate
                lesson={{ id: "plan", dateKey: toDateKey(getAppTodayStart()), time: "10:00", title: "Занятие", type: "lesson" }}
                dateSlots={dateSlots}
                slotsLoading={false}
                slotsError={scheduleSlotsError}
                showRescheduleHint={false}
                onBack={() => setPlanStep("type")}
                onPick={(dateKey) => {
                  setPlanDateKey(dateKey)
                  setPlanStep("time")
                }}
              />
            )
            )
          ) : null}
          {planStep === "time" ? (
            planLoadingSlots ? (
              <div>
                <button className="mb-3 rounded-lg px-2 py-1 text-sm text-ds-text-muted hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-text-primary" onClick={() => setPlanStep("date")}>Назад</button>
                <h3 className="mb-2 text-3xl font-semibold text-ds-text-primary">Загружаем доступные слоты...</h3>
                <p className="text-sm text-ds-text-muted">Подождите пару секунд, собираем актуальную доступность преподавателя.</p>
              </div>
            ) : (
            <StepTime
              lesson={{ id: "plan", dateKey: toDateKey(getAppTodayStart()), time: "10:00", title: "Занятие", type: "lesson" }}
              flowType={planType}
              dateKey={planDateKey}
              slots={dateSlots[planDateKey] ?? []}
              mode="plan"
              errorMessage={actionError}
              isSubmitting={planSubmitting}
              onBack={() => setPlanStep("date")}
              onPick={(time) => void planLesson(time)}
            />
            )
          ) : null}
        </LessonModal>
      ) : null}

      {planSuccessText ? (
        <div
          className="fixed inset-0 z-[142] flex items-center justify-center bg-black/35 p-6"
          role="status"
          aria-live="polite"
          onClick={() => setPlanSuccessText(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--ds-sage)] px-7 py-7 text-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-2xl font-semibold">Урок запланирован</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/45 px-4 py-2 text-left text-sm">
              <span className="h-8 w-8 overflow-hidden rounded-full bg-black/10">
                <img src={teacherVisual.avatar} alt={teacherVisual.name} className="h-full w-full object-cover" />
              </span>
              <span className="font-medium">Преподаватель: {teacherVisual.name}</span>
            </div>
            <p className="mt-2 text-sm opacity-90">{planSuccessText}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85"
                onClick={() => setPlanSuccessText(null)}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-2xl font-semibold text-ds-text-primary">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function LessonCard({ lesson, onClick }: { lesson: ScheduledLesson; onClick: () => void }) {
  const d = parseLessonStart(lesson.dateKey, lesson.time)
  const month = d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "").toUpperCase()
  const day = d.getDate()
  const weekday = d.toLocaleDateString("ru-RU", { weekday: "long" })
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl bg-[var(--ds-neutral-row)] px-4 py-4 text-left text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]"
    >
      <div className="w-14 text-center">
        <div className="text-xs font-semibold text-ds-text-muted">{month}</div>
        <div className="text-3xl font-semibold text-ds-text-primary">{day}</div>
      </div>
      <div className="flex-1">
        <div className="text-xl font-semibold text-ds-text-primary">{capitalize(weekday)} в {lesson.time}</div>
        <div className="text-sm text-ds-text-muted">{lesson.teacher ?? "Преподаватель"}, {lesson.title}</div>
      </div>
      <ChevronRight size={18} className="text-ds-text-muted" />
    </button>
  )
}

function LessonModal({
  children,
  onClose,
  successTone = false
}: {
  children: React.ReactNode
  onClose: () => void
  successTone?: boolean
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[120] bg-black/35" onClick={onClose}>
      <div
        className={`fixed inset-x-0 bottom-0 max-h-[86vh] overflow-auto rounded-t-[28px] p-5 text-ds-text-primary shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl ${
          successTone ? "bg-[var(--ds-sage)]" : "bg-ds-surface"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="rounded-lg p-1 text-ds-text-primary hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StepMenu({
  lesson,
  onReschedule,
  onCancel
}: {
  lesson: ScheduledLesson
  onReschedule: () => void
  onCancel: () => void
}) {
  const dayLabel = getLessonDayLabel(lesson.dateKey, lesson.time)
  return (
    <div>
      <div className="mb-2 text-sm text-ds-text-muted">{dayLabel}</div>
      <h3 className="text-3xl font-semibold leading-tight text-ds-text-primary">{formatLessonHeader(lesson)}</h3>
      <p className="mt-2 text-lg text-ds-text-muted">{lesson.title}</p>
      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-lg font-medium text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]"
        onClick={onReschedule}
      >
        Перенести
      </button>
      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-lg font-medium text-ds-text-primary hover:bg-red-500/10 hover:text-red-800 dark:hover:bg-red-950/45 dark:hover:text-red-200"
        onClick={onCancel}
      >
        Отменить урок
      </button>
    </div>
  )
}

function StepType({ allowFollowing, onBack, onPick }: { allowFollowing: boolean; onBack: () => void; onPick: (v: FlowType) => void }) {
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-ds-text-muted hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-text-primary" onClick={onBack}>Назад</button>
      <h3 className="mb-4 text-4xl font-semibold text-ds-text-primary">
        {allowFollowing ? "Что вы хотите перенести?" : "Перенести урок"}
      </h3>
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]"
        onClick={() => onPick("single")}
      >
        <div>
          <div className="text-lg font-medium">Только этот урок</div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ds-text-muted" />
      </button>
      {allowFollowing ? (
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)]"
          onClick={() => onPick("following")}
        >
          <div>
            <div className="text-lg font-medium">Все регулярные занятия</div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-ds-text-muted" />
        </button>
      ) : null}
    </div>
  )
}

function StepDate({
  lesson,
  dateSlots,
  slotsLoading,
  slotsError,
  showRescheduleHint = true,
  onBack,
  onPick
}: {
  lesson: ScheduledLesson
  dateSlots: DateSlots
  slotsLoading?: boolean
  slotsError?: string | null
  showRescheduleHint?: boolean
  onBack: () => void
  onPick: (dateKey: string) => void
}) {
  const days = nextDaysFromAppNow(STUDENT_RESCHEDULE_DAYS_AHEAD)
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-ds-text-muted hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-text-primary" onClick={onBack}>Назад</button>
      <h3 className="mb-3 text-3xl font-semibold text-ds-text-primary">Выберите день</h3>
      {slotsError ? (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:bg-red-950/45 dark:text-red-200">{slotsError}</div>
      ) : null}
      {slotsLoading ? (
        <div className="mb-3 text-sm text-ds-text-muted">Загружаем доступные слоты…</div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.map((dateKey) => {
          const available = (dateSlots[dateKey] ?? []).length > 0
          return (
            <button
              key={dateKey}
              disabled={!available}
              className={`rounded-xl border px-3 py-3 text-left ${available ? "border-black/10 bg-ds-surface text-ds-text-primary hover:bg-ds-surface-hover dark:border-white/10" : "border-black/5 bg-ds-neutral-row text-ds-text-tertiary dark:border-white/10"}`}
              onClick={() => onPick(dateKey)}
            >
              <div className="text-sm">{formatDateLabel(dateKey)}</div>
              <div className="text-xs">{available ? "доступно" : "Нет доступных слотов"}</div>
            </button>
          )
        })}
      </div>
      {showRescheduleHint && !canRescheduleLesson(lesson.dateKey, lesson.time) ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">Перенос недоступен: до начала урока осталось менее 24 часов.</p>
      ) : null}
    </div>
  )
}

function StepWeekday({
  originWeekday,
  weeklySlotsByWeekday,
  onBack,
  onPick
}: {
  originWeekday?: number
  weeklySlotsByWeekday: Record<number, string[]>
  onBack: () => void
  onPick: (weekday: number) => void
}) {
  const weekdays = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-ds-text-muted hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-text-primary" onClick={onBack}>Назад</button>
      <h3 className="mb-2 text-3xl font-semibold text-ds-text-primary">Выберите день недели</h3>
      <p className="mb-3 text-sm text-ds-text-muted">
        Для регулярного переноса выбирается шаблон недели, а не конкретная дата.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {weekdays.map((weekday) => {
          const availableCount = (weeklySlotsByWeekday[weekday] ?? []).length
          const isCurrent = originWeekday !== undefined && weekday === originWeekday
          const label = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][weekday]
          return (
            <button
              key={`weekday-${weekday}`}
              disabled={availableCount === 0}
              type="button"
              className={`rounded-xl border px-3 py-3 text-left ${
                availableCount > 0
                  ? isCurrent
                    ? "group border-[var(--ds-sage-strong)] bg-[var(--ds-sage)] text-ds-text-primary hover:bg-[var(--ds-sage-hover)]"
                    : "border-black/10 bg-ds-surface text-ds-text-primary hover:bg-ds-surface-hover dark:border-white/10"
                  : "border-black/5 bg-ds-neutral-row text-ds-text-tertiary dark:border-white/10"
              }`}
              onClick={() => onPick(weekday)}
            >
              <div
                className={`text-sm font-medium${
                  availableCount > 0 && isCurrent ? " group-hover:text-black dark:group-hover:text-black" : ""
                }`}
              >
                {label}
              </div>
              <div
                className={`text-xs${
                  availableCount > 0 && isCurrent ? " group-hover:text-black/90 dark:group-hover:text-black/90" : ""
                }`}
              >
                {availableCount > 0 ? `слотов: ${availableCount}` : "Нет доступных слотов"}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepTime({
  lesson,
  flowType,
  dateKey,
  slots,
  mode = "reschedule",
  errorMessage,
  isSubmitting,
  onBack,
  onPick
}: {
  lesson: ScheduledLesson
  flowType: FlowType
  dateKey: string
  slots: string[]
  mode?: "reschedule" | "plan"
  errorMessage?: string | null
  isSubmitting?: boolean
  onBack: () => void
  onPick: (time: string) => void
}) {
  const lessonWeekday = parseLessonStart(lesson.dateKey, lesson.time).getDay()
  const targetWeekday = parseLessonStart(dateKey, "00:00").getDay()
  const regular = slots.filter((t) => targetWeekday === lessonWeekday && isValidRescheduleTargetSlot(dateKey, t))
  const single = slots.filter((t) => isValidRescheduleTargetSlot(dateKey, t))
  const weeklyOptions = slots.filter((t) => isValidStudentBookingTargetSlot(dateKey, t))
  const planOptions = slots.filter((t) => isValidStudentBookingTargetSlot(dateKey, t))
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-ds-text-muted hover:bg-[var(--ds-neutral-row-hover)] hover:text-ds-text-primary" onClick={onBack}>Назад</button>
      <h3 className="mb-3 text-3xl font-semibold text-ds-text-primary">{formatDateLabel(dateKey)}</h3>
      {mode === "plan" ? (
        <>
          <div className="mb-2 text-lg font-medium text-ds-text-primary">
            {flowType === "following" ? "Слоты для еженедельного расписания" : "Доступные слоты"}
          </div>
          <SlotsGrid slots={planOptions} onPick={onPick} disabled={Boolean(isSubmitting)} />
        </>
      ) : flowType === "following" ? (
        <>
          <div className="mb-2 text-lg font-medium text-ds-text-primary">Слоты для регулярного переноса</div>
          <SlotsGrid slots={weeklyOptions} onPick={onPick} disabled={Boolean(isSubmitting)} />
        </>
      ) : (
        <>
          <div className="mb-2 text-lg font-medium text-ds-text-primary">Разовые слоты</div>
          <SlotsGrid slots={single} onPick={onPick} disabled={Boolean(isSubmitting)} />
        </>
      )}
      {isSubmitting ? (
        <p className="mt-3 text-sm text-ds-text-muted">{mode === "plan" ? "Планируем урок..." : "Переносим урок..."}</p>
      ) : null}
      {errorMessage ? (
        <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:bg-red-950/45 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}

function SlotsGrid({ slots, onPick, disabled = false }: { slots: string[]; onPick: (time: string) => void; disabled?: boolean }) {
  if (slots.length === 0) return <div className="rounded-xl bg-ds-neutral-row px-4 py-3 text-sm text-ds-text-muted">Нет доступных слотов</div>
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {slots.map((time) => (
        <button
          key={time}
          type="button"
          disabled={disabled}
          className="rounded-xl bg-[var(--ds-neutral-row)] px-3 py-2 text-center text-base text-ds-text-primary hover:bg-[var(--ds-neutral-row-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onPick(time)}
        >
          {time}
        </button>
      ))}
    </div>
  )
}

function StepSuccess({
  value,
  onClose,
  teacherName,
  teacherAvatarUrl
}: {
  value: string
  onClose: () => void
  teacherName: string
  teacherAvatarUrl: string
}) {
  return (
    <div className="min-h-[56vh] text-ds-text-primary">
      <h3 className="mt-20 text-6xl font-semibold leading-tight">Мы перенесли ваш урок.</h3>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left">
        <span className="h-10 w-10 overflow-hidden rounded-full bg-black/10">
          <img src={teacherAvatarUrl} alt={teacherName} className="h-full w-full object-cover" />
        </span>
        <span className="text-base font-medium">Преподаватель: {teacherName}</span>
      </div>
      <p className="mt-5 text-2xl">Новое время: {value}</p>
      <button
        type="button"
        className="mt-20 w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-lg font-medium text-white hover:bg-black/85 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        onClick={onClose}
      >
        Продолжить
      </button>
    </div>
  )
}

function formatLessonSubtitle(l: ScheduledLesson) {
  return `${l.teacher ?? "Преподаватель"}, ${l.title}`
}

function formatLessonHeader(l: ScheduledLesson) {
  const d = parseLessonStart(l.dateKey, l.time)
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
  return `${date} · ${l.time}`
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Дни для шага «Выберите день» — календарные Y-M-D в часовом поясе школы, как у слотов из API. */
function nextDaysFromAppNow(count: number) {
  // Только от полуночи «сегодня» по логике приложения — без вчера и без смешения с wall-clock TZ.
  const start = dateKeyFromDate(getAppTodayStart())
  const arr: string[] = []
  let dk = start
  for (let i = 0; i < count; i++) {
    arr.push(dk)
    dk = addOneDayYmd(dk)
  }
  return arr
}

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`)
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" })
}

function formatRecurringWeekdayLabel(weekday: number): string {
  const map: Record<number, string> = {
    0: "воскресеньям",
    1: "понедельникам",
    2: "вторникам",
    3: "средам",
    4: "четвергам",
    5: "пятницам",
    6: "субботам"
  }
  return map[weekday] ?? "выбранным дням"
}

function formatRecurringCancellationLabel(lesson: ScheduledLesson): string {
  const weekday = parseLessonStart(lesson.dateKey, lesson.time).getDay()
  return `По ${formatRecurringWeekdayLabel(weekday)} в ${normalizeScheduleSlotTime(lesson.time)}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfWeekMonday(ref: Date) {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

function formatWeekRange(start: Date, end: Date) {
  if (!start || !end) return ""
  const s = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  const e = end.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
  return `${s} — ${e}`
}

function getLessonDayLabel(dateKey: string, time: string): string {
  const start = parseLessonStart(dateKey, time)
  const now = getAppNow()
  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)
  const nowDay = new Date(now)
  nowDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((startDay.getTime() - nowDay.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return "Сегодня"
  if (diffDays === 1) return "Завтра"
  if (diffDays === -1) return "Вчера"
  return capitalize(start.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "short" }).replace(".", ""))
}

function getTeacherProfileHref(teacherName: string): string {
  const normalized = teacherName.trim().toLowerCase().replace(/\s+/g, " ")
  if (normalized === "zhao li" || normalized === "чжао ли") return "/mentors/zhao-li"
  if (normalized === "eo mi ran" || normalized === "эо ми ран") return "/mentors/eo-mi-ran"
  return "/mentors/zhao-li"
}

function TooltipHint({
  text,
  children,
  className
}: {
  text: string
  children: React.ReactNode
  className?: string
}) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const tipRef = useRef<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  useEffect(() => {
    if (!open) return
    const update = () => {
      const host = hostRef.current
      const tip = tipRef.current
      if (!host || !tip) return
      const rect = host.getBoundingClientRect()
      const tipRect = tip.getBoundingClientRect()
      const pad = 8
      const center = rect.left + rect.width / 2
      const minCenter = pad + tipRect.width / 2
      const maxCenter = window.innerWidth - pad - tipRect.width / 2
      const left = Math.max(minCenter, Math.min(maxCenter, center))
      const topCandidate = rect.top - tipRect.height - 6
      const top = topCandidate >= pad ? topCandidate : rect.bottom + 6
      setPosition({ left, top })
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open])

  return (
    <>
      <span
        ref={hostRef}
        className={className ?? "inline-flex"}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open ? (
        <span
          ref={tipRef}
          className="pointer-events-none fixed z-[140] max-w-[220px] -translate-x-1/2 rounded-[6px] bg-zinc-900 px-2 py-1 text-center text-[11px] leading-snug text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
          style={{ left: position.left, top: position.top }}
        >
          {text}
        </span>
      ) : null}
    </>
  )
}
