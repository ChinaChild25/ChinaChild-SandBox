"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookOpenCheck, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Ellipsis, MessageSquare, Repeat, Star, UserRound, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  canRescheduleLesson,
  isValidRescheduleTargetSlot,
  parseLessonStart,
  type ScheduledLesson
} from "@/lib/schedule-lessons"

type FlowStep = "menu" | "type" | "date" | "time" | "success"
type FlowType = "single" | "following"

type DateSlots = Record<string, string[]>

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
  const cancelSuccessTimerRef = useRef<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [planType, setPlanType] = useState<FlowType>("single")
  const [planStep, setPlanStep] = useState<"type" | "date" | "time">("type")
  const [planDateKey, setPlanDateKey] = useState("")
  const [planLoadingSlots, setPlanLoadingSlots] = useState(false)
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
    return () => {
      if (cancelSuccessTimerRef.current !== null) window.clearTimeout(cancelSuccessTimerRef.current)
    }
  }, [])

  const sortedLessons = useMemo(
    () =>
      [...lessons].sort((a, b) => {
        const ta = parseLessonStart(a.dateKey, a.time).getTime()
        const tb = parseLessonStart(b.dateKey, b.time).getTime()
        return ta - tb
      }),
    [lessons]
  )

  const nowTs = Date.now()
  const upcoming = sortedLessons.filter((l) => parseLessonStart(l.dateKey, l.time).getTime() > nowTs)
  const past = [...sortedLessons.filter((l) => parseLessonStart(l.dateKey, l.time).getTime() <= nowTs)].reverse()

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

  const desktopDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(desktopAnchorDate, i)), [desktopAnchorDate])
  const desktopDayKeys = useMemo(() => desktopDays.map((d) => toDateKey(d)), [desktopDays])
  const weekStartTs = desktopDays[0]?.getTime() ?? 0
  const weekEndTs = (desktopDays[6]?.getTime() ?? 0) + 24 * 60 * 60 * 1000
  const desktopLessons = useMemo(
    () =>
      sortedLessons.filter((l) => {
        const ts = parseLessonStart(l.dateKey, l.time).getTime()
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
  const teacherCards = useMemo(() => {
    const byTeacher = new Map<string, { name: string; avatarUrl?: string; upcoming: number; past: number }>()
    for (const lesson of sortedLessons) {
      const name = lesson.teacher?.trim() || "Преподаватель"
      const prev = byTeacher.get(name) ?? { name, avatarUrl: lesson.teacherAvatarUrl, upcoming: 0, past: 0 }
      const ts = parseLessonStart(lesson.dateKey, lesson.time).getTime()
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

  const openLesson = async (lesson: ScheduledLesson) => {
    setSelectedLesson(lesson)
    setFlowStep("menu")
    setFlowType("single")
    setSelectedDateKey("")
    setDateSlots({})
    const now = new Date()
    const to = new Date(now)
    to.setDate(to.getDate() + 21)
    const teacherParam = lesson.teacherId ? `&teacher_id=${encodeURIComponent(lesson.teacherId)}` : ""
    const res = await fetch(
      `/api/schedule?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}${teacherParam}`
    )
    const payload = (await res.json()) as { slots?: Array<{ slot_at: string }> }
    const byDate: DateSlots = {}
    for (const s of payload.slots ?? []) {
      const d = new Date(s.slot_at)
      const dateKey = toDateKey(d)
      const time = `${String(d.getHours()).padStart(2, "0")}:00`
      if (!isValidRescheduleTargetSlot(dateKey, time)) continue
      byDate[dateKey] = [...(byDate[dateKey] ?? []), time]
    }
    setDateSlots(byDate)
  }
  const loadDateSlots = async () => {
    setPlanLoadingSlots(true)
    const now = new Date()
    const to = new Date(now)
    to.setDate(to.getDate() + 21)
    const teacherId = selectedLesson?.teacherId || upcoming[0]?.teacherId || lessons[0]?.teacherId
    const teacherParam = teacherId ? `&teacher_id=${encodeURIComponent(teacherId)}` : ""
    const res = await fetch(
      `/api/schedule?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}${teacherParam}`
    )
    const payload = (await res.json()) as { slots?: Array<{ slot_at: string }> }
    const byDate: DateSlots = {}
    for (const s of payload.slots ?? []) {
      const d = new Date(s.slot_at)
      const dateKey = toDateKey(d)
      const time = `${String(d.getHours()).padStart(2, "0")}:00`
      if (!isValidRescheduleTargetSlot(dateKey, time)) continue
      byDate[dateKey] = [...(byDate[dateKey] ?? []), time]
    }
    setDateSlots(byDate)
    setPlanLoadingSlots(false)
    return byDate
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
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setActionError(payload.error ?? "Не удалось запланировать урок")
      return
    }
    setPlanOpen(false)
    await refreshLessons()
  }

  const closeFlow = () => {
    setSelectedLesson(null)
    setFlowStep("menu")
    setSelectedDateKey("")
  }

  const cancelLesson = async (lesson: ScheduledLesson, scope: "single" | "following" = "single") => {
    setActionError(null)
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
    if (cancelSuccessTimerRef.current !== null) {
      window.clearTimeout(cancelSuccessTimerRef.current)
    }
    setCancelSuccessOpen(true)
    cancelSuccessTimerRef.current = window.setTimeout(() => {
      setCancelSuccessOpen(false)
      cancelSuccessTimerRef.current = null
    }, 2800)
    return true
  }

  const openCancelConfirmation = (lesson: ScheduledLesson) => {
    setActionError(null)
    queueMicrotask(() => setCancelConfirmLesson(lesson))
  }

  const doCancel = () => {
    if (!selectedLesson) return
    openCancelConfirmation(selectedLesson)
  }

  const doReschedule = async (toTime: string) => {
    if (!selectedLesson || !selectedDateKey) return
    await fetch("/api/schedule/student-action", {
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
    setSuccessText(`${selectedDateKey} · ${toTime}`)
    setFlowStep("success")
    await refreshLessons()
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-4 sm:px-6 md:px-8">
      <h1 className="mb-5 text-center text-3xl font-semibold text-[#202124]">Расписание</h1>
      <div className="mb-4 flex justify-center md:hidden">
        <button className="rounded-lg bg-[var(--ds-sage)] px-4 py-2 text-sm font-medium text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => void openPlanLesson()}>
          + Запланировать урок
        </button>
      </div>

      <div className="mb-5 hidden items-center justify-between md:flex">
        <h2 className="text-4xl font-semibold text-[#202124]">Мои уроки</h2>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-[var(--ds-sage)] px-4 py-2 text-sm font-medium text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => void openPlanLesson()}>+ Запланировать урок</button>
        </div>
      </div>
      <div className="mb-5 hidden items-center gap-6 border-b border-black/10 pb-3 md:flex">
        <TooltipHint text="Открыть список уроков">
        <button
          className={`inline-flex items-center gap-2 pb-2 text-sm ${desktopTab === "lessons" ? "border-b-2 border-[var(--ds-sage-strong)] font-semibold text-[#202124]" : "text-[#5f6368]"}`}
          onClick={() => setDesktopTab("lessons")}
        >
          <Clock3 size={16} strokeWidth={2.4} />
          Уроки
        </button>
        </TooltipHint>
        <TooltipHint text="Открыть календарную сетку">
        <button
          className={`inline-flex items-center gap-2 pb-2 text-sm ${desktopTab === "calendar" ? "border-b-2 border-[var(--ds-sage-strong)] font-semibold text-[#202124]" : "text-[#5f6368]"}`}
          onClick={() => setDesktopTab("calendar")}
        >
          <CalendarDays size={16} strokeWidth={2.4} />
          Календарь
        </button>
        </TooltipHint>
        <TooltipHint text="Открыть вкладку преподавателей">
        <button
          className={`inline-flex items-center gap-2 pb-2 text-sm ${desktopTab === "teachers" ? "border-b-2 border-[var(--ds-sage-strong)] font-semibold text-[#202124]" : "text-[#5f6368]"}`}
          onClick={() => setDesktopTab("teachers")}
        >
          <BookOpenCheck size={16} strokeWidth={2.4} />
          Преподаватели
        </button>
        </TooltipHint>
      </div>

      <div className={`mb-4 hidden items-center justify-between md:flex ${desktopTab === "calendar" ? "" : "hidden"}`}>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-black/10 px-3 py-2 text-sm hover:bg-[#f8f9fa]" onClick={() => setDesktopAnchorDate(startOfWeekMonday(new Date()))}>
            Сегодня
          </button>
          <button className="rounded-md border border-black/10 p-2 hover:bg-[#f8f9fa]" onClick={() => setDesktopAnchorDate((d) => addDays(d, -7))}><ChevronLeft size={16} /></button>
          <button className="rounded-md border border-black/10 p-2 hover:bg-[#f8f9fa]" onClick={() => setDesktopAnchorDate((d) => addDays(d, 7))}><ChevronRight size={16} /></button>
          <div className="ml-2 text-2xl font-semibold text-[#202124]">{formatWeekRange(desktopDays[0], desktopDays[6])}</div>
        </div>
        <div className="flex items-center gap-5 text-sm font-semibold text-[#4f4b5f]">
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

      <div className={`relative mb-8 overflow-hidden rounded-xl border border-black/10 bg-white ${desktopTab === "calendar" ? "hidden md:block" : "hidden"}`}>
        <div className="grid border-b border-black/10" style={{ gridTemplateColumns: `70px repeat(7, minmax(110px, 1fr))` }}>
          <div className="border-r border-black/10 px-2 py-2 text-[11px] text-[#5f6368]">GMT</div>
          {desktopDays.map((d, i) => (
            <div key={`hd-${i}`} className="border-r border-black/10 px-3 py-2 text-center last:border-r-0">
              <div className="text-[12px] text-[#5f6368]">{d.toLocaleDateString("ru-RU", { weekday: "short" })}</div>
              <div className="text-sm font-semibold text-[#202124]">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div
          ref={desktopCalendarScrollRef}
          className="max-h-[calc(56px*12)] overflow-y-auto overflow-x-hidden ds-hide-scrollbar"
        >
        <div className="grid" style={{ gridTemplateColumns: `70px repeat(7, minmax(110px, 1fr))` }}>
          <div className="border-r border-black/10">
            {desktopHours.map((h) => (
              <div key={`th-${h}`} className="h-14 border-b border-black/10 px-2 py-1 text-xs text-[#5f6368]">{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {desktopDayKeys.map((k) => {
            const dayLessons = desktopLessons.filter((l) => l.dateKey === k)
            return (
              <div key={k} className="relative border-r border-black/10 last:border-r-0">
                {desktopHours.map((h) => (
                  <div key={`${k}-${h}`} className="h-14 border-b border-black/10" />
                ))}
                {dayLessons.map((l) => {
                  const hour = Number(l.time.slice(0, 2))
                  const top = (hour - desktopHours[0]) * 56 + 4
                  const weekday = parseLessonStart(l.dateKey, l.time).getDay()
                  const recurrenceKey = `${weekday}-${l.time}`
                  const isRecurring = recurringKeys.has(recurrenceKey)
                  return (
                    <button
                      key={`desk-${l.id}-${l.time}`}
                      type="button"
                      className="absolute left-1 right-1 z-10 rounded-lg border border-[var(--ds-sage-strong)] bg-[color-mix(in_srgb,var(--ds-sage)_68%,#ffffff)] px-2 py-1 pl-10 pr-7 text-left shadow-sm hover:bg-[color-mix(in_srgb,var(--ds-sage)_78%,#ffffff)]"
                      style={{ top }}
                      onClick={(e) => setDesktopMenu({ x: e.clientX, y: e.clientY, lesson: l })}
                    >
                      <span className="absolute left-1.5 top-1.5 h-5 w-5 overflow-hidden rounded-[5px] bg-white/80">
                        <img
                          src={l.teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                          alt={l.teacher ?? "Преподаватель"}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <TooltipHint text={isRecurring ? "Еженедельный урок" : "Разовый урок"} className="absolute right-1.5 top-1.5 text-[#4f4b5f]">
                        {isRecurring ? (
                          <Repeat size={14} strokeWidth={2.6} />
                        ) : (
                          <CalendarCheck2 size={14} strokeWidth={2.6} />
                        )}
                      </TooltipHint>
                      <div className="text-xs font-medium text-[#202124]">{l.time}</div>
                      <div className="truncate text-xs text-[#202124]">{l.teacher ?? "Преподаватель"}</div>
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
          {upcoming.map((l) => (
            <div key={`up-${l.id}`} className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-4">
              <button type="button" className="flex flex-1 items-center gap-3 text-left" onClick={() => void openLesson(l)}>
                <div className="h-12 w-12 overflow-hidden rounded-md bg-[#dfe3e9]">
                  <img
                    src={l.teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                    alt={l.teacher ?? "Преподаватель"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xl font-medium text-[#202124]">{capitalize(parseLessonStart(l.dateKey, l.time).toLocaleDateString("ru-RU", { weekday: "long" }))}, {l.time}</div>
                  <div className="text-sm text-[#5f6368]">{l.teacher ?? "Преподаватель"}, {l.title}</div>
                </div>
              </button>
              <button type="button" className="rounded-md p-1 hover:bg-[#f1f3f4]" onClick={(e) => setDesktopMenu({ x: e.clientX, y: e.clientY, lesson: l })}>
                <Ellipsis size={20} />
              </button>
            </div>
          ))}
        </Section>

        <Section title="Еженедельные уроки">
          {weeklyGroups.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white px-4 py-4 text-sm text-[#5f6368]">Нет регулярных занятий</div>
          ) : (
            weeklyGroups.map((g, idx) => (
              <div key={`wg-${idx}`} className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-md bg-[#dfe3e9]">
                    <img
                      src={teacherAvatarByName.get(g.teacher) || "/placeholders/teacher-avatar.svg"}
                      alt={g.teacher}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xl font-medium text-[#202124]">Каждый {g.weekday} {g.time}</div>
                    <div className="text-sm text-[#5f6368]">{g.teacher}, {upcoming[0]?.title ?? "Урок"}</div>
                  </div>
                </div>
                <button className="rounded-md p-1 hover:bg-[#f1f3f4]"><Ellipsis size={20} /></button>
              </div>
            ))
          )}
        </Section>

        <Section title="Прошедшие уроки">
          {past.map((l) => (
            <div key={`past-desktop-${l.id}`} className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-md bg-[#dfe3e9]">
                  <img
                    src={l.teacherAvatarUrl || "/placeholders/teacher-avatar.svg"}
                    alt={l.teacher ?? "Преподаватель"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-lg font-medium text-[#202124]">{capitalize(parseLessonStart(l.dateKey, l.time).toLocaleDateString("ru-RU", { weekday: "long" }))}, {l.time}</div>
                  <div className="text-sm text-[#5f6368]">{l.teacher ?? "Преподаватель"}, {l.title}</div>
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-[#f8f9fa]"><Star size={14} /> Оценить</button>
            </div>
          ))}
        </Section>
      </div>

      <div className={`${desktopTab === "teachers" ? "hidden md:block" : "hidden"}`}>
        <Section title="Мои преподаватели">
          {teacherCards.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white px-4 py-4 text-sm text-[#5f6368]">
              Пока нет преподавателей с запланированными уроками
            </div>
          ) : (
            teacherCards.map((teacher) => (
              <div
                key={teacher.name}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white px-4 py-4"
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
                    <div className="truncate text-xl font-semibold text-[#202124]">{teacher.name}</div>
                    <div className="text-base text-[#5f6368]">
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
        <section className="mb-6 rounded-xl border border-black/10 bg-white px-4 py-4">
          <div className="mb-2 text-sm font-medium text-[#5f6368]">Ближайший урок</div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-3xl font-semibold leading-tight text-[#202124]">
                {upcoming[0].title}
              </div>
              <div className="mt-2 text-lg text-[#5f6368]">
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
        {upcoming.map((l) => (
          <LessonCard key={l.id} lesson={l} onClick={() => void openLesson(l)} />
        ))}
      </Section>

      <Section title="Регулярные занятия">
        {weeklyGroups.length === 0 ? (
          <div className="rounded-xl border border-black/10 bg-white px-4 py-4 text-sm text-[#5f6368]">Нет регулярных занятий</div>
        ) : (
          weeklyGroups.map((g, idx) => (
            <div key={`${g.weekday}-${idx}`} className="rounded-xl border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-[#202124]"><Repeat size={16} /> Каждый {g.weekday} в {g.time}</div>
              <div className="mt-1 text-sm text-[#5f6368]">{g.teacher}</div>
            </div>
          ))
        )}
      </Section>

      <Section title="Прошедшие">
        {past.map((l) => (
          <div key={`past-${l.id}`} className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-4 opacity-80">
            <div>
              <div className="font-medium text-[#202124]">Подтверждено</div>
              <div className="text-sm text-[#5f6368]">{formatLessonSubtitle(l)}</div>
            </div>
            <button className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium">Оценить</button>
          </div>
        ))}
      </Section>
      </div>

      {desktopMenu ? (
        <div className="fixed inset-0 z-[125]" onClick={() => setDesktopMenu(null)}>
          <div
            className="fixed z-[126] w-[244px] rounded-xl border border-black/10 bg-white p-1.5 shadow-xl"
            style={desktopMenuStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-medium text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]"
              onClick={() => {
                setSelectedLesson(desktopMenu.lesson)
                setFlowStep("type")
                setDesktopMenu(null)
              }}
            >
              <CalendarDays size={16} /> Перенести
            </button>
            <Link href="/messages" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-medium text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]">
              <MessageSquare size={16} /> Написать преподавателю
            </Link>
            <Link href="/mentors/zhao-li" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-medium text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]">
              <UserRound size={16} /> Профиль преподавателя
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-medium text-[#b3261e] hover:bg-[#fce8e6]"
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
            <StepMenu lesson={selectedLesson} onCancel={doCancel} onReschedule={() => setFlowStep("type")} />
          ) : null}
          {flowStep === "type" ? (
            <StepType
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
                lesson={selectedLesson}
                weeklySlotsByWeekday={weeklySlotsByWeekday}
                onBack={() => setFlowStep("type")}
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
                dateSlots={dateSlots}
                onBack={() => setFlowStep("type")}
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
              onBack={() => setFlowStep("date")}
              onPick={(time) => void doReschedule(time)}
            />
          ) : null}
          {flowStep === "success" ? <StepSuccess value={successText} onClose={closeFlow} /> : null}
        </LessonModal>
      ) : null}

      {cancelConfirmLesson ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4" onClick={() => setCancelConfirmLesson(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold text-[#202124]">Отменить урок</h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              Выберите, что отменить: только это занятие или всю регулярную цепочку начиная с этого урока.
            </p>
            {actionError ? <div className="mt-3 rounded-lg bg-[#fce8e6] px-3 py-2 text-sm text-[#b3261e]">{actionError}</div> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm hover:bg-black/5" onClick={() => setCancelConfirmLesson(null)}>Закрыть</button>
              <button
                type="button"
                className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-[#f8f9fa]"
                onClick={() => void cancelLesson(cancelConfirmLesson, "single")}
              >
                Только этот
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#b3261e]/20 bg-[#fce8e6] px-3 py-2 text-sm text-[#b3261e] hover:bg-[#f8d8d3]"
                onClick={() => void cancelLesson(cancelConfirmLesson, "following")}
              >
                Все последующие
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelSuccessOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-6"
          role="alertdialog"
          aria-live="assertive"
          aria-labelledby="student-cancel-success-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#b3261e] px-8 py-10 text-center shadow-2xl">
            <p id="student-cancel-success-title" className="text-2xl font-semibold text-black">
              Отменили урок
            </p>
            <p className="mt-2 text-sm font-medium text-black/80">Слот освобождён в вашем расписании и у преподавателя.</p>
          </div>
        </div>
      ) : null}

      {planOpen ? (
        <LessonModal onClose={() => setPlanOpen(false)}>
          {planStep === "type" ? (
            <div>
              <h3 className="mb-4 text-3xl font-semibold text-[#202124]">Как запланировать занятие?</h3>
              <button className="mb-2 flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => { setPlanType("single"); setPlanStep("date") }}>
                <div className="text-lg font-medium">Разовое занятие</div><ChevronRight size={18} />
              </button>
              <button className="flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => { setPlanType("following"); setPlanStep("date") }}>
                <div className="text-lg font-medium">Еженедельная основа</div><ChevronRight size={18} />
              </button>
              {actionError ? <div className="mt-3 rounded-lg bg-[#fce8e6] px-3 py-2 text-sm text-[#b3261e]">{actionError}</div> : null}
            </div>
          ) : null}
          {planStep === "date" ? (
            planLoadingSlots ? (
              <div>
                <button className="mb-3 rounded-lg px-2 py-1 text-sm text-[#5f6368] hover:bg-[var(--ds-neutral-row-hover)] hover:text-[#202124]" onClick={() => setPlanStep("type")}>Назад</button>
                <h3 className="mb-2 text-3xl font-semibold text-[#202124]">Загружаем доступные слоты...</h3>
                <p className="text-sm text-[#5f6368]">Подождите пару секунд, собираем актуальную доступность преподавателя.</p>
              </div>
            ) : (
            planType === "following" ? (
              <StepWeekday
                lesson={{ id: "plan", dateKey: toDateKey(new Date()), time: "10:00", title: "Занятие", type: "lesson" }}
                weeklySlotsByWeekday={weeklySlotsByWeekday}
                onBack={() => setPlanStep("type")}
                onPick={(weekday) => {
                  const candidate = Object.keys(dateSlots).filter((k) => parseLessonStart(k, "00:00").getDay() === weekday && (dateSlots[k] ?? []).length > 0).sort()[0]
                  if (candidate) setPlanDateKey(candidate)
                  setPlanStep("time")
                }}
              />
            ) : (
              <StepDate
                lesson={{ id: "plan", dateKey: toDateKey(new Date()), time: "10:00", title: "Занятие", type: "lesson" }}
                dateSlots={dateSlots}
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
                <button className="mb-3 rounded-lg px-2 py-1 text-sm text-[#5f6368] hover:bg-[var(--ds-neutral-row-hover)] hover:text-[#202124]" onClick={() => setPlanStep("date")}>Назад</button>
                <h3 className="mb-2 text-3xl font-semibold text-[#202124]">Загружаем доступные слоты...</h3>
                <p className="text-sm text-[#5f6368]">Подождите пару секунд, собираем актуальную доступность преподавателя.</p>
              </div>
            ) : (
            <StepTime
              lesson={{ id: "plan", dateKey: toDateKey(new Date()), time: "10:00", title: "Занятие", type: "lesson" }}
              flowType={planType}
              dateKey={planDateKey}
              slots={dateSlots[planDateKey] ?? []}
              onBack={() => setPlanStep("date")}
              onPick={(time) => void planLesson(time)}
            />
            )
          ) : null}
        </LessonModal>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-2xl font-semibold text-[#202124]">{title}</h2>
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
      className="flex w-full items-center gap-4 rounded-xl bg-[var(--ds-neutral-row)] px-4 py-4 text-left hover:bg-[var(--ds-neutral-row-hover)]"
    >
      <div className="w-14 text-center">
        <div className="text-xs font-semibold text-[#5f6368]">{month}</div>
        <div className="text-3xl font-semibold text-[#202124]">{day}</div>
      </div>
      <div className="flex-1">
        <div className="text-xl font-semibold text-[#202124]">{capitalize(weekday)} в {lesson.time}</div>
        <div className="text-sm text-[#5f6368]">{lesson.teacher ?? "Преподаватель"}, {lesson.title}</div>
      </div>
      <ChevronRight size={18} className="text-[#5f6368]" />
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
        className={`fixed inset-x-0 bottom-0 max-h-[86vh] overflow-auto rounded-t-[28px] p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl ${
          successTone ? "bg-[var(--ds-sage)]" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button className="rounded-lg p-1 hover:bg-black/5" onClick={onClose}><X size={20} /></button>
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
      <div className="mb-2 text-sm text-[#5f6368]">{dayLabel}</div>
      <h3 className="text-3xl font-semibold leading-tight text-[#202124]">{formatLessonHeader(lesson)}</h3>
      <p className="mt-2 text-lg text-[#5f6368]">{lesson.title}</p>
      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-lg font-medium text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]"
        onClick={onReschedule}
      >
        Перенести
      </button>
      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-lg font-medium text-[#202124] hover:bg-[#fce8e6] hover:text-[#b3261e]"
        onClick={onCancel}
      >
        Отменить урок
      </button>
    </div>
  )
}

function StepType({ onBack, onPick }: { onBack: () => void; onPick: (v: FlowType) => void }) {
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-[#5f6368] hover:bg-[var(--ds-neutral-row-hover)] hover:text-[#202124]" onClick={onBack}>Назад</button>
      <h3 className="mb-4 text-4xl font-semibold text-[#202124]">Что вы хотите перенести?</h3>
      <button className="mb-2 flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => onPick("single")}>
        <div><div className="text-lg font-medium">Только этот урок</div></div><ChevronRight size={18} />
      </button>
      <button className="flex w-full items-center justify-between rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-left hover:bg-[var(--ds-neutral-row-hover)]" onClick={() => onPick("following")}>
        <div><div className="text-lg font-medium">Все регулярные занятия</div></div><ChevronRight size={18} />
      </button>
    </div>
  )
}

function StepDate({
  lesson,
  dateSlots,
  onBack,
  onPick
}: {
  lesson: ScheduledLesson
  dateSlots: DateSlots
  onBack: () => void
  onPick: (dateKey: string) => void
}) {
  const days = nextDays(14)
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-[#5f6368] hover:bg-[var(--ds-neutral-row-hover)] hover:text-[#202124]" onClick={onBack}>Назад</button>
      <h3 className="mb-3 text-3xl font-semibold text-[#202124]">Выберите день</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.map((dateKey) => {
          const available = (dateSlots[dateKey] ?? []).length > 0
          return (
            <button
              key={dateKey}
              disabled={!available}
              className={`rounded-xl border px-3 py-3 text-left ${available ? "border-black/10 bg-white hover:bg-[#f8f9fa]" : "border-black/5 bg-[#f5f5f5] text-[#9aa0a6]"}`}
              onClick={() => onPick(dateKey)}
            >
              <div className="text-sm">{formatDateLabel(dateKey)}</div>
              <div className="text-xs">{available ? "доступно" : "Нет доступных слотов"}</div>
            </button>
          )
        })}
      </div>
      {!canRescheduleLesson(lesson.dateKey, lesson.time) ? (
        <p className="mt-3 text-sm text-[#b3261e]">Перенос недоступен: до начала урока осталось менее 24 часов.</p>
      ) : null}
    </div>
  )
}

function StepWeekday({
  lesson,
  weeklySlotsByWeekday,
  onBack,
  onPick
}: {
  lesson: ScheduledLesson
  weeklySlotsByWeekday: Record<number, string[]>
  onBack: () => void
  onPick: (weekday: number) => void
}) {
  const baseWeekday = parseLessonStart(lesson.dateKey, lesson.time).getDay()
  const weekdays = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-[#5f6368] hover:bg-[var(--ds-neutral-row-hover)] hover:text-[#202124]" onClick={onBack}>Назад</button>
      <h3 className="mb-2 text-3xl font-semibold text-[#202124]">Выберите день недели</h3>
      <p className="mb-3 text-sm text-[#5f6368]">
        Для регулярного переноса выбирается шаблон недели, а не конкретная дата.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {weekdays.map((weekday) => {
          const availableCount = (weeklySlotsByWeekday[weekday] ?? []).length
          const isCurrent = weekday === baseWeekday
          const label = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][weekday]
          return (
            <button
              key={`weekday-${weekday}`}
              disabled={availableCount === 0}
              className={`rounded-xl border px-3 py-3 text-left ${
                availableCount > 0
                  ? isCurrent
                    ? "border-[var(--ds-sage-strong)] bg-[var(--ds-sage)] hover:bg-[var(--ds-sage-hover)]"
                    : "border-black/10 bg-white hover:bg-[#f8f9fa]"
                  : "border-black/5 bg-[#f5f5f5] text-[#9aa0a6]"
              }`}
              onClick={() => onPick(weekday)}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs">{availableCount > 0 ? `слотов: ${availableCount}` : "Нет доступных слотов"}</div>
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
  onBack,
  onPick
}: {
  lesson: ScheduledLesson
  flowType: FlowType
  dateKey: string
  slots: string[]
  onBack: () => void
  onPick: (time: string) => void
}) {
  const lessonWeekday = parseLessonStart(lesson.dateKey, lesson.time).getDay()
  const targetWeekday = parseLessonStart(dateKey, "00:00").getDay()
  const regular = slots.filter((t) => targetWeekday === lessonWeekday && isValidRescheduleTargetSlot(dateKey, t))
  const single = slots.filter((t) => (targetWeekday !== lessonWeekday || !regular.includes(t)) && isValidRescheduleTargetSlot(dateKey, t))
  const weeklyOptions = slots.filter((t) => isValidRescheduleTargetSlot(dateKey, t))
  return (
    <div>
      <button className="mb-3 rounded-lg px-2 py-1 text-sm text-[#5f6368] hover:bg-[var(--ds-neutral-row-hover)] hover:text-[#202124]" onClick={onBack}>Назад</button>
      <h3 className="mb-3 text-3xl font-semibold text-[#202124]">{formatDateLabel(dateKey)}</h3>
      {flowType === "following" ? (
        <>
          <div className="mb-2 text-lg font-medium text-[#202124]">Слоты для регулярного переноса</div>
          <SlotsGrid slots={weeklyOptions} onPick={onPick} />
        </>
      ) : (
        <>
          <div className="mb-2 text-lg font-medium text-[#202124]">Регулярные слоты</div>
          <SlotsGrid slots={regular} onPick={onPick} />
          <div className="mb-2 mt-4 text-lg font-medium text-[#202124]">Разовые слоты</div>
          <SlotsGrid slots={single} onPick={onPick} />
        </>
      )}
    </div>
  )
}

function SlotsGrid({ slots, onPick }: { slots: string[]; onPick: (time: string) => void }) {
  if (slots.length === 0) return <div className="rounded-xl bg-[#f5f5f5] px-4 py-3 text-sm text-[#5f6368]">Нет доступных слотов</div>
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {slots.map((time) => (
        <button
          key={time}
          className="rounded-xl bg-[var(--ds-neutral-row)] px-3 py-2 text-center text-base text-[#202124] hover:bg-[var(--ds-neutral-row-hover)]"
          onClick={() => onPick(time)}
        >
          {time}
        </button>
      ))}
    </div>
  )
}

function StepSuccess({ value, onClose }: { value: string; onClose: () => void }) {
  return (
    <div className="min-h-[56vh] text-[#121212]">
      <h3 className="mt-20 text-6xl font-semibold leading-tight">Мы перенесли ваш урок.</h3>
      <p className="mt-5 text-2xl">Новое время: {value}</p>
      <button className="mt-20 w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-lg font-medium text-white hover:bg-black/85" onClick={onClose}>
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

function nextDays(count: number) {
  const arr: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    arr.push(toDateKey(x))
  }
  return arr
}

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`)
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" })
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
  const now = new Date()
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
          className="pointer-events-none fixed z-[140] max-w-[220px] -translate-x-1/2 rounded-[6px] bg-[#202124] px-2 py-1 text-center text-[11px] leading-snug text-white shadow-md"
          style={{ left: position.left, top: position.top }}
        >
          {text}
        </span>
      ) : null}
    </>
  )
}
