"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react"

import type { TeacherCourseModule, TeacherLesson } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const UNCATEGORIZED = "__uncategorized__"

/** «Урок N», где N — минимальный свободный номер среди заголовков вида «Урок <число>» по курсу. */
function nextLessonCatalogTitle(lessons: TeacherLesson[]): string {
  const used = new Set<number>()
  for (const l of lessons) {
    const m = l.title.trim().match(/^Урок\s+(\d+)$/iu)
    if (!m) continue
    const n = Number.parseInt(m[1]!, 10)
    if (Number.isFinite(n) && n > 0) used.add(n)
  }
  let n = 1
  while (used.has(n)) n += 1
  return `Урок ${n}`
}

function nextOrderInModule(lessons: TeacherLesson[], moduleKey: string | null): number {
  const mid = moduleKey ?? null
  let max = -1
  for (const l of lessons) {
    if ((l.module_id ?? null) !== mid) continue
    if (l.order > max) max = l.order
  }
  return max + 1
}

function findLessonContainer(items: Record<string, string[]>, lessonId: string) {
  return Object.keys(items).find((k) => items[k]?.includes(lessonId)) ?? null
}

function computeLessonDragResult(
  prev: Record<string, string[]>,
  activeId: string,
  overId: string,
  overRect: { top: number; height: number } | null | undefined,
  activeTranslatedTop: number | null | undefined
): Record<string, string[]> {
  const activeContainer = findLessonContainer(prev, activeId)
  if (!activeContainer) return prev

  if (activeId === overId) return prev

  const overAsBucket = overId in prev

  if (overAsBucket) {
    const overContainer = overId
    const fromIdx = prev[activeContainer].indexOf(activeId)
    if (fromIdx < 0) return prev
    const moved = prev[activeContainer][fromIdx]
    if (activeContainer === overContainer) return prev
    return {
      ...prev,
      [activeContainer]: prev[activeContainer].filter((x) => x !== moved),
      [overContainer]: [...prev[overContainer], moved]
    }
  }

  const overContainer = findLessonContainer(prev, overId)
  if (!overContainer) return prev

  if (activeContainer === overContainer) {
    const ai = prev[activeContainer].indexOf(activeId)
    const oi = prev[activeContainer].indexOf(overId)
    if (ai < 0 || oi < 0 || ai === oi) return prev
    return { ...prev, [activeContainer]: arrayMove(prev[activeContainer], ai, oi) }
  }

  const fromIdx = prev[activeContainer].indexOf(activeId)
  if (fromIdx < 0) return prev
  const moved = prev[activeContainer][fromIdx]
  let insertAt = prev[overContainer].indexOf(overId)
  if (overRect && activeTranslatedTop != null) {
    const isBelow = activeTranslatedTop > overRect.top + overRect.height / 2
    if (isBelow) insertAt += 1
  }
  insertAt = Math.max(0, Math.min(insertAt, prev[overContainer].length))

  return {
    ...prev,
    [activeContainer]: prev[activeContainer].filter((x) => x !== moved),
    [overContainer]: [
      ...prev[overContainer].slice(0, insertAt),
      moved,
      ...prev[overContainer].slice(insertAt)
    ]
  }
}

function buildItemsAndOrder(
  modules: TeacherCourseModule[],
  lessons: TeacherLesson[]
): { orderedModuleIds: string[]; items: Record<string, string[]> } {
  const sortedMods = [...modules].sort((a, b) => a.order - b.order)
  const orderedModuleIds = sortedMods.map((m) => m.id)
  const valid = new Set(orderedModuleIds)
  const items: Record<string, string[]> = { [UNCATEGORIZED]: [] }
  for (const id of orderedModuleIds) items[id] = []

  const byBucket: Record<string, TeacherLesson[]> = {}
  for (const id of [UNCATEGORIZED, ...orderedModuleIds]) byBucket[id] = []

  for (const l of lessons) {
    const key = l.module_id && valid.has(l.module_id) ? l.module_id : UNCATEGORIZED
    byBucket[key]?.push(l)
  }
  for (const key of [UNCATEGORIZED, ...orderedModuleIds]) {
    items[key] = (byBucket[key] ?? [])
      .sort((a, b) => a.order - b.order)
      .map((l) => l.id)
  }
  return { orderedModuleIds, items }
}

function lessonPlacementsFromState(
  orderedModuleIds: string[],
  items: Record<string, string[]>
): { id: string; moduleId: string | null; order: number }[] {
  const order = [UNCATEGORIZED, ...orderedModuleIds]
  const out: { id: string; moduleId: string | null; order: number }[] = []
  for (const cid of order) {
    const ids = items[cid] ?? []
    const moduleId = cid === UNCATEGORIZED ? null : cid
    ids.forEach((id, i) => out.push({ id, moduleId, order: i }))
  }
  return out
}

async function patchCurriculum(
  courseId: string,
  body: { moduleOrderedIds?: string[]; lessons?: { id: string; moduleId: string | null; order: number }[] }
) {
  const res = await fetch(`/api/teacher/courses/${courseId}/curriculum`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(j?.error ?? res.statusText)
  }
}

function SortableLessonRow({
  id,
  lesson,
  onDelete,
  indexLabel
}: {
  id: UniqueIdentifier
  lesson: TeacherLesson
  onDelete: (lessonId: string) => void
  indexLabel: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative z-0 flex items-center gap-3 rounded-[var(--ds-radius-md)] p-4",
        "bg-[var(--ds-neutral-row)] dark:bg-ds-surface-pill",
        "transition-[transform,box-shadow] duration-200 ease-out",
        "hover:z-10 hover:-translate-y-0.5",
        "hover:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_36px_-4px_rgba(0,0,0,0.45)]",
        isDragging && "z-20 opacity-80 ring-2 ring-ds-sage-strong/40"
      )}
    >
      <button
        type="button"
        className="shrink-0 touch-none text-ds-text-tertiary transition-colors hover:text-ds-ink"
        aria-label="Перетащить урок"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <Link
        href={`/teacher/lessons/${lesson.id}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 no-underline leading-tight text-ds-ink"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-ds-text-secondary shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)] dark:bg-zinc-900/70 dark:text-ds-text-tertiary dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
          {indexLabel}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-medium text-ds-ink">{lesson.title}</p>
          <p className="mt-0.5 text-sm text-ds-text-tertiary">Открыть и редактировать урок</p>
        </div>
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-ds-text-tertiary hover:text-red-400"
          aria-label={`Удалить урок «${lesson.title}»`}
          onClick={() => onDelete(lesson.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <ChevronRight className="h-5 w-5 shrink-0 text-ds-chevron transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </div>
  )
}

function LessonBucket({
  droppableId,
  items,
  lessonsById,
  onDeleteLesson
}: {
  droppableId: string
  items: UniqueIdentifier[]
  lessonsById: Map<string, TeacherLesson>
  onDeleteLesson: (id: string) => void
}) {
  const { setNodeRef } = useDroppable({ id: droppableId })
  return (
    <div ref={setNodeRef}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[48px] flex-col gap-2">
          {items.length === 0 ? (
            <div className="rounded-[var(--ds-radius-md)] border border-dashed border-black/10 bg-[var(--ds-neutral-row)] px-5 py-5 text-center text-sm text-ds-text-tertiary dark:border-white/10 dark:bg-ds-surface-pill">
              Перетащите сюда уроки или добавьте новый урок в этот раздел
            </div>
          ) : null}
          {items.map((lid, index) => {
            const lesson = lessonsById.get(String(lid))
            if (!lesson) return null
            return (
              <SortableLessonRow
                key={lesson.id}
                id={lesson.id}
                lesson={lesson}
                onDelete={onDeleteLesson}
                indexLabel={index + 1}
              />
            )
          })}
        </div>
      </SortableContext>
    </div>
  )
}

type Props = {
  courseId: string
  modules: TeacherCourseModule[]
  lessons: TeacherLesson[]
  onReload: () => Promise<void>
  onDeleteLesson: (lessonId: string) => void
  /** Показать черновик урока до ответа сервера; `id` временный (`tmp-lesson:…`). */
  onAddLessonOptimistic?: (lesson: TeacherLesson) => void
  /** После POST: заменить черновик на реальный урок; при `lesson === null` — откат (ошибка). */
  onAddLessonSettled?: (tempId: string, lesson: TeacherLesson | null) => void
}

export function CourseCurriculumEditor({
  courseId,
  modules,
  lessons,
  onReload,
  onDeleteLesson,
  onAddLessonOptimistic,
  onAddLessonSettled
}: Props) {
  const [orderedModuleIds, setOrderedModuleIds] = useState<string[]>([])
  const [items, setItems] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orderedModuleIdsRef = useRef<string[]>([])
  const itemsRef = useRef<Record<string, string[]>>({})
  const lessonIdSetRef = useRef<Set<string>>(new Set())
  const moduleDragGhostRef = useRef<HTMLElement | null>(null)
  const addLessonInFlightRef = useRef(false)

  const lessonsById = new Map(lessons.map((l) => [l.id, l]))

  useEffect(() => {
    const next = buildItemsAndOrder(modules, lessons)
    setOrderedModuleIds(next.orderedModuleIds)
    setItems(next.items)
  }, [modules, lessons])

  useEffect(() => {
    orderedModuleIdsRef.current = orderedModuleIds
  }, [orderedModuleIds])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    lessonIdSetRef.current = new Set(lessons.map((l) => l.id))
  }, [lessons])

  useEffect(() => {
    return () => {
      moduleDragGhostRef.current?.remove()
      moduleDragGhostRef.current = null
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const persist = useCallback(
    async (nextOrder: string[], nextItems: Record<string, string[]>) => {
      setSaving(true)
      setError(null)
      try {
        await patchCurriculum(courseId, {
          moduleOrderedIds: nextOrder,
          lessons: lessonPlacementsFromState(nextOrder, nextItems)
        })
        await onReload()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка сохранения")
        await onReload()
      } finally {
        setSaving(false)
      }
    },
    [courseId, onReload]
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id)
      if (!lessonIdSetRef.current.has(activeId)) return

      const overIdRaw = event.over?.id != null ? String(event.over.id) : null
      if (overIdRaw == null) return

      const translatedTop = event.active.rect.current.translated?.top
      const overRect = event.over?.rect

      setItems((prev) => {
        const next = computeLessonDragResult(prev, activeId, overIdRaw, overRect, translatedTop ?? null)
        if (next !== prev) {
          void persist(orderedModuleIdsRef.current, next)
        }
        return next
      })
    },
    [persist]
  )

  async function addModule() {
    setError(null)
    const res = await fetch(`/api/teacher/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Новый раздел" })
    })
    const json = (await res.json().catch(() => null)) as { module?: TeacherCourseModule; error?: string } | null
    if (!res.ok || !json?.module) {
      setError(json?.error ?? "Не удалось создать раздел")
      return
    }
    await onReload()
  }

  async function addLesson(moduleKey: string | null) {
    if (addLessonInFlightRef.current) return
    addLessonInFlightRef.current = true
    setError(null)
    try {
      const title = nextLessonCatalogTitle(lessons)
      const order = nextOrderInModule(lessons, moduleKey)
      const optimistic =
        onAddLessonOptimistic && onAddLessonSettled
          ? ({
              id: `tmp-lesson:${crypto.randomUUID()}`,
              course_id: courseId,
              title,
              order,
              module_id: moduleKey,
              created_at: new Date().toISOString()
            } satisfies TeacherLesson)
          : null
      if (optimistic && onAddLessonOptimistic) onAddLessonOptimistic(optimistic)

      const res = await fetch(`/api/teacher/courses/${courseId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, moduleId: moduleKey })
      })
      const json = (await res.json().catch(() => null)) as { lesson?: TeacherLesson; error?: string } | null
      if (!res.ok || !json?.lesson) {
        setError(json?.error ?? "Не удалось создать урок")
        if (optimistic && onAddLessonSettled) onAddLessonSettled(optimistic.id, null)
        return
      }
      if (optimistic && onAddLessonSettled) {
        onAddLessonSettled(optimistic.id, json.lesson)
      } else {
        await onReload()
      }
    } finally {
      addLessonInFlightRef.current = false
    }
  }

  async function renameModule(moduleId: string, title: string) {
    const t = title.trim()
    if (!t) return
    const prev = (modules.find((m) => m.id === moduleId)?.title ?? "").trim()
    if (t === prev) return

    await fetch(`/api/teacher/courses/${courseId}/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t })
    })
    await onReload()
  }

  async function removeModule(moduleId: string) {
    if (!window.confirm("Удалить раздел? Уроки останутся без раздела.")) return
    await fetch(`/api/teacher/courses/${courseId}/modules/${moduleId}`, { method: "DELETE" })
    await onReload()
  }

  function removeModuleDragGhost() {
    moduleDragGhostRef.current?.remove()
    moduleDragGhostRef.current = null
  }

  function onModuleNativeDragEnd() {
    removeModuleDragGhost()
  }

  function onModuleNativeDragStart(e: React.DragEvent, moduleId: string) {
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/x-module-id", moduleId)

    const grip = e.currentTarget as HTMLElement
    const row = grip.closest<HTMLElement>("[data-module-header-row]")
    if (!row) return

    removeModuleDragGhost()

    const clone = row.cloneNode(true) as HTMLElement
    clone.querySelectorAll("[draggable]").forEach((el) => el.removeAttribute("draggable"))
    clone.removeAttribute("data-module-header-row")
    const r = row.getBoundingClientRect()
    clone.style.boxSizing = "border-box"
    clone.style.width = `${r.width}px`
    clone.style.maxWidth = `${r.width}px`
    clone.style.background = "var(--ds-surface, #fff)"
    clone.style.borderRadius = "var(--ds-radius-md)"
    clone.style.boxShadow = "0 8px 30px rgb(0 0 0 / 0.12)"
    clone.style.position = "fixed"
    clone.style.top = "-10000px"
    clone.style.left = "0"
    clone.style.pointerEvents = "none"
    clone.style.zIndex = "2147483647"
    clone.setAttribute("aria-hidden", "true")

    document.body.appendChild(clone)
    moduleDragGhostRef.current = clone

    const ox = e.clientX - r.left
    const oy = e.clientY - r.top
    try {
      e.dataTransfer.setDragImage(clone, ox, oy)
    } catch {
      removeModuleDragGhost()
    }
  }

  function onModuleNativeDrop(e: React.DragEvent, targetModuleId: string) {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData("text/x-module-id")
    if (!sourceId || sourceId === targetModuleId) return
    const from = orderedModuleIds.indexOf(sourceId)
    const to = orderedModuleIds.indexOf(targetModuleId)
    if (from < 0 || to < 0) return
    const next = arrayMove(orderedModuleIds, from, to)
    setOrderedModuleIds(next)
    void persist(next, itemsRef.current)
  }

  const containerOrder = [UNCATEGORIZED, ...orderedModuleIds]

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saving ? <p className="text-xs text-ds-text-tertiary">Сохранение порядка…</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[720px] text-sm text-ds-text-secondary">
          Здесь собирается структура курса: разделы можно переименовать и переставлять, а уроки свободно переносить
          между разделами и редактировать отдельно.
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void addModule()}>
              <Plus className="mr-1 h-4 w-4" />
              Добавить раздел
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Добавить раздел курса</TooltipContent>
        </Tooltip>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-7">
          {containerOrder.map((cid) => {
            const isUncat = cid === UNCATEGORIZED
            const mod = !isUncat ? modules.find((m) => m.id === cid) : null
            const bucketItems = (items[cid] ?? []).map((x) => x as UniqueIdentifier)

            return (
              <section key={cid} className="space-y-3">
                <div
                  data-module-header-row=""
                  className="flex min-w-0 max-w-full flex-nowrap items-center gap-3"
                  {...(!isUncat
                    ? {
                        onDragOver: (e: React.DragEvent) => e.preventDefault(),
                        onDrop: (e: React.DragEvent) => onModuleNativeDrop(e, cid)
                      }
                    : {})}
                >
                  {isUncat ? (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                        Без раздела
                      </p>
                      <h3 className="mt-1 min-w-0 truncate text-[26px] font-semibold tracking-[-0.02em] text-ds-ink">
                        Уроки без раздела
                      </h3>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => onModuleNativeDragStart(e, cid)}
                        onDragEnd={onModuleNativeDragEnd}
                        className="shrink-0 touch-none cursor-grab rounded-full p-2 text-ds-text-tertiary transition-colors hover:bg-[var(--ds-neutral-row)] hover:text-ds-ink active:cursor-grabbing dark:hover:bg-ds-surface-pill"
                        aria-label="Перетащить раздел"
                      >
                        <GripVertical className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">
                          Раздел
                        </p>
                        <Input
                          defaultValue={mod?.title ?? "Раздел"}
                          className="mt-1 h-auto min-w-0 max-w-xl border-0 bg-transparent px-0 py-0 !text-[26px] font-semibold tracking-[-0.02em] text-ds-ink shadow-none outline-none focus-visible:!shadow-none focus-visible:ring-0"
                          onBlur={(e) => void renameModule(cid, e.target.value)}
                        />
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-ds-text-tertiary hover:text-red-400"
                              aria-label="Удалить раздел"
                              onClick={() => void removeModule(cid)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Удалить раздел</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" size="sm" className="shrink-0" onClick={() => void addLesson(cid)}>
                              <Plus className="mr-1 h-4 w-4" />
                              Урок
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Добавить урок в этот раздел</TooltipContent>
                        </Tooltip>
                      </div>
                    </>
                  )}
                  {isUncat ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          className="ml-auto shrink-0"
                          onClick={() => void addLesson(null)}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Урок
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Добавить урок без раздела</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>

                <LessonBucket
                  droppableId={cid}
                  items={bucketItems}
                  lessonsById={lessonsById}
                  onDeleteLesson={onDeleteLesson}
                />
              </section>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}
