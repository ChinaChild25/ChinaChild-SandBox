"use client"

import { useRef } from "react"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  canRescheduleLesson,
  canTeacherRescheduleLesson,
  dateKeyFromDate,
  findLessonAt,
  isLessonPastOrStarted,
  isValidRescheduleTargetSlot,
  isValidTeacherRescheduleTargetSlot,
  SCHEDULE_DEFAULT_TEACHER,
  SCHEDULE_SLOT_TIMES,
  type ScheduledLesson
} from "@/lib/schedule-lessons"

export const SCHEDULE_DRAG_MIME = "application/x-chinachild-lesson"

export type ScheduleRescheduleVariant = "student" | "teacher"

export const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const

function canMoveSource(variant: ScheduleRescheduleVariant, dateKey: string, timeStr: string): boolean {
  return variant === "teacher"
    ? canTeacherRescheduleLesson(dateKey, timeStr)
    : canRescheduleLesson(dateKey, timeStr)
}

function canMoveTarget(variant: ScheduleRescheduleVariant, dateKey: string, timeStr: string): boolean {
  return variant === "teacher"
    ? isValidTeacherRescheduleTargetSlot(dateKey, timeStr)
    : isValidRescheduleTargetSlot(dateKey, timeStr)
}

export function dragHintsActive(
  lessons: ScheduledLesson[],
  draggingLessonId: string | null,
  variant: ScheduleRescheduleVariant
): boolean {
  if (!draggingLessonId) return false
  const L = lessons.find((l) => l.id === draggingLessonId)
  return L ? canMoveSource(variant, L.dateKey, L.time) : false
}

type ScheduleLessonCardProps = {
  lesson: ScheduledLesson
  selected: boolean
  movable: boolean
  isPast: boolean
  variant: ScheduleRescheduleVariant
  onSelect: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

export function ScheduleLessonCard({
  lesson,
  selected,
  movable,
  isPast,
  variant,
  onSelect,
  onDragStart,
  onDragEnd
}: ScheduleLessonCardProps) {
  const ignoreClick = useRef(false)

  const footerPast = "Занятие уже прошло — перенос недоступен."
  const footerMovable =
    variant === "teacher"
      ? "Перетащите на другой слот или нажмите слот ниже. Можно перенести даже если до начала меньше 24 ч; новое время — в пределах 7 суток."
      : "Перетащите на другой слот или нажмите слот ниже."
  const footerBlocked = "Перенос недоступен: до начала меньше 24 часов."

  return (
    <div
      role="button"
      tabIndex={movable ? 0 : -1}
      draggable={movable}
      aria-disabled={!movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={() => {
        ignoreClick.current = true
        onDragEnd()
        window.setTimeout(() => {
          ignoreClick.current = false
        }, 0)
      }}
      onClick={(e) => {
        e.preventDefault()
        if (ignoreClick.current || !movable) return
        onSelect()
      }}
      onKeyDown={(e) => {
        if (!movable) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "ds-schedule-slot min-w-0 ds-schedule-slot--lesson",
        movable && "cursor-grab active:cursor-grabbing",
        !movable && "cursor-not-allowed opacity-[0.56] grayscale-[0.42]",
        selected && movable && "ring-2 ring-ds-sage ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] opacity-80">{isPast ? "Прошло" : "Онлайн-урок"}</div>
          <div className="text-[13px] font-semibold leading-snug sm:text-[12px]">{lesson.title}</div>
          <div className="text-[11px] opacity-80">{lesson.time}</div>
          <div className="mt-0.5 text-[11px] text-ds-text-secondary">
            {lesson.teacher ?? SCHEDULE_DEFAULT_TEACHER}
          </div>
        </div>
        {movable ? <GripVertical className="mt-0.5 h-4 w-4 shrink-0 opacity-35" aria-hidden /> : null}
      </div>
      <p className="mt-2 border-t border-black/[0.08] pt-2 text-[10px] leading-snug text-ds-text-tertiary dark:border-white/10">
        {isPast ? footerPast : movable ? footerMovable : footerBlocked}
      </p>
    </div>
  )
}

type EmptySlotProps = {
  dateKey: string
  time: string
  tapSelectActive: boolean
  dragActive: boolean
  isDragHoverTarget: boolean
  onDragHoverSlot: (dateKey: string, time: string) => void
  onDropLesson: (lessonId: string) => void
  onClickPick: () => void
}

export function ScheduleEmptySlot({
  dateKey,
  time,
  tapSelectActive,
  dragActive,
  isDragHoverTarget,
  onDragHoverSlot,
  onDropLesson,
  onClickPick
}: EmptySlotProps) {
  return (
    <button
      type="button"
      data-date-key={dateKey}
      data-time={time}
      onClick={onClickPick}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        onDragHoverSlot(dateKey, time)
      }}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData(SCHEDULE_DRAG_MIME) || e.dataTransfer.getData("text/plain")
        if (id) onDropLesson(id)
      }}
      className={cn(
        "ds-schedule-empty flex min-h-[52px] w-full flex-col items-center justify-center rounded-[var(--ds-radius-md)] px-2 text-center transition-[transform,box-shadow,border-color,background-color] duration-150",
        dragActive &&
          !isDragHoverTarget &&
          "border-2 border-dashed border-ds-sage-strong bg-ds-sage/45 dark:border-ds-sage-hover dark:bg-ds-sage/35",
        dragActive &&
          isDragHoverTarget &&
          "z-[1] scale-[1.02] border-2 border-solid border-ds-sage-strong bg-ds-sage/80 shadow-[0_0_0_3px_color-mix(in_srgb,var(--ds-sage-strong)_38%,transparent)] dark:border-ds-sage-hover dark:bg-ds-sage/55 dark:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ds-sage-hover)_42%,transparent)]",
        tapSelectActive &&
          !dragActive &&
          "border-2 border-dashed border-ds-sage-strong bg-ds-sage/25 dark:bg-ds-sage/15"
      )}
    >
      <span
        className={cn(
          "text-[11px] font-medium",
          isDragHoverTarget && dragActive ? "text-ds-ink dark:text-white" : "text-ds-text-tertiary"
        )}
      >
        {time}
      </span>
      <span
        className={cn(
          "text-[10px]",
          isDragHoverTarget && dragActive
            ? "font-medium text-ds-ink/90 dark:text-white/90"
            : "text-ds-text-tertiary/80"
        )}
      >
        {dragActive && isDragHoverTarget ? "Сюда" : "свободно"}
      </span>
    </button>
  )
}

export function ScheduleDayColumn({
  cellDate,
  weekDayIndex,
  isToday,
  lessons,
  selectedLessonId,
  draggingLessonId,
  dropHover,
  variant,
  onSelectLesson,
  onSlotDrop,
  onEmptyClick,
  onDragHoverSlot,
  onDragStart,
  onDragEnd,
  slotTimes = SCHEDULE_SLOT_TIMES
}: {
  cellDate: Date
  weekDayIndex: number
  isToday: boolean
  lessons: ScheduledLesson[]
  selectedLessonId: string | null
  draggingLessonId: string | null
  dropHover: { dateKey: string; time: string } | null
  variant: ScheduleRescheduleVariant
  onSelectLesson: (id: string) => void
  onSlotDrop: (lessonId: string, dateKey: string, time: string) => void
  onEmptyClick: (dateKey: string, time: string) => void
  onDragHoverSlot: (dateKey: string, time: string) => void
  onDragStart: (e: React.DragEvent, lesson: ScheduledLesson) => void
  onDragEnd: () => void
  slotTimes?: readonly string[]
}) {
  const dateKey = dateKeyFromDate(cellDate)
  const showDropHints = dragHintsActive(lessons, draggingLessonId, variant)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={`ds-schedule-day-head ${isToday ? "ds-schedule-day-head--today" : "ds-schedule-day-head--muted"}`}
      >
        <div className="text-[11px] uppercase">{weekDays[weekDayIndex]}</div>
        <div className={`text-[20px] ${isToday ? "font-bold" : "font-normal"}`}>{cellDate.getDate()}</div>
      </div>

      <div className="flex flex-col gap-2">
        {slotTimes.map((time) => {
          const lesson = findLessonAt(lessons, dateKey, time)
          if (lesson) {
            const movable = canMoveSource(variant, lesson.dateKey, lesson.time)
            const isPast = isLessonPastOrStarted(lesson.dateKey, lesson.time)
            return (
              <ScheduleLessonCard
                key={`${lesson.id}-${time}`}
                lesson={lesson}
                selected={selectedLessonId === lesson.id}
                movable={movable}
                isPast={isPast}
                variant={variant}
                onSelect={() => onSelectLesson(lesson.id)}
                onDragStart={(e) => {
                  if (!canMoveSource(variant, lesson.dateKey, lesson.time)) {
                    e.preventDefault()
                    return
                  }
                  onDragStart(e, lesson)
                }}
                onDragEnd={onDragEnd}
              />
            )
          }
          const draggingMovable = showDropHints
          const slotOk = canMoveTarget(variant, dateKey, time)
          return (
            <ScheduleEmptySlot
              key={`${dateKey}-${time}`}
              dateKey={dateKey}
              time={time}
              tapSelectActive={!!selectedLessonId && slotOk}
              dragActive={draggingMovable && slotOk}
              isDragHoverTarget={
                draggingMovable && slotOk && dropHover?.dateKey === dateKey && dropHover?.time === time
              }
              onDragHoverSlot={onDragHoverSlot}
              onDropLesson={(lessonId) => onSlotDrop(lessonId, dateKey, time)}
              onClickPick={() => onEmptyClick(dateKey, time)}
            />
          )
        })}
      </div>
    </div>
  )
}
