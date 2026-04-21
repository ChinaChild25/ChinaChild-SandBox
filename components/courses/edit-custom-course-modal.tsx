"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { TeacherCustomCourse } from "@/lib/types"
import { CourseCoverImageDialog } from "@/components/courses/course-cover-image-dialog"
import {
  courseCoverFromCourse,
  coverStyleForCourseSave,
  normalizeCoverImagePosition,
  parseLevelForCourseForm,
  TEACHER_COURSE_COVER_PALETTE,
  TEACHER_COURSE_HSK_LEVELS
} from "@/lib/teacher-custom-course-form"
import { CourseCoverColorPicker } from "@/components/courses/course-cover-color-picker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type StudentOption = { id: string; name: string }

export function EditCustomCourseModal({
  open,
  onOpenChange,
  courseId,
  course,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  course: TeacherCustomCourse | null
  onSaved: (course: TeacherCustomCourse) => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [level, setLevel] = useState<string>("HSK1")
  const [levelCustom, setLevelCustom] = useState("")
  const [coverColor, setCoverColor] = useState<string>(TEACHER_COURSE_COVER_PALETTE[0]!)
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [coverImagePosition, setCoverImagePosition] = useState("50% 50%")
  const [coverImageOpen, setCoverImageOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [students, setStudents] = useState<StudentOption[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())

  const loadStudentsAndAssignments = useCallback(async () => {
    setStudentsLoading(true)
    setStudentsError(null)
    try {
      const [stRes, asRes] = await Promise.all([
        fetch("/api/schedule/students", { cache: "no-store" }),
        fetch(`/api/teacher/courses/${courseId}/assignments`, { cache: "no-store" })
      ])
      const stJson = (await stRes.json().catch(() => null)) as { students?: StudentOption[]; error?: string } | null
      const asJson = (await asRes.json().catch(() => null)) as { studentIds?: string[]; error?: string } | null

      if (stRes.ok) {
        setStudents(stJson?.students ?? [])
      } else {
        setStudents([])
        setStudentsError(stJson?.error ?? "Не удалось загрузить список учеников")
      }

      if (asRes.ok && Array.isArray(asJson?.studentIds)) {
        setSelectedStudentIds(new Set(asJson.studentIds))
      } else {
        setSelectedStudentIds(new Set())
        if (asRes.ok === false && stRes.ok) {
          setStudentsError(asJson?.error ?? "Не удалось загрузить назначения")
        }
      }
    } finally {
      setStudentsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (!open || !course) return
    setTitle(course.title ?? "")
    setDescription(course.description ?? "")
    const parsed = parseLevelForCourseForm(course.level)
    setLevel(parsed.selectValue)
    setLevelCustom(parsed.levelCustom)
    setCoverColor(course.cover_color?.trim() || TEACHER_COURSE_COVER_PALETTE[0]!)
    setCoverImageUrl(course.cover_image_url?.trim() ?? "")
    setCoverImagePosition(normalizeCoverImagePosition(course.cover_image_position))
    setError(null)
    void loadStudentsAndAssignments()
  }, [open, course, loadStudentsAndAssignments])

  const submitEnabled = useMemo(() => {
    if (!title.trim()) return false
    if (title.trim().length > 20) return false
    if (level === "custom") return Boolean(levelCustom.trim())
    return true
  }, [title, level, levelCustom])

  function toggleStudent(id: string, checked: boolean) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function saveCourse() {
    if (!submitEnabled) return
    setIsSaving(true)
    setError(null)
    const res = await fetch(`/api/teacher/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        level,
        levelCustom,
        coverColor,
        coverImageUrl: coverImageUrl.trim() || null,
        coverImagePosition: normalizeCoverImagePosition(coverImagePosition),
        coverStyle: coverStyleForCourseSave({ hasPhoto: Boolean(coverImageUrl.trim()), coverColor })
      })
    })
    const json = (await res.json().catch(() => null)) as { course?: TeacherCustomCourse; error?: string } | null
    if (!res.ok || !json?.course) {
      setError(json?.error ?? "Не удалось сохранить")
      setIsSaving(false)
      return
    }

    const assignRes = await fetch(`/api/teacher/courses/${courseId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: [...selectedStudentIds] })
    })
    const assignJson = (await assignRes.json().catch(() => null)) as { error?: string } | null
    if (!assignRes.ok) {
      setError(
        assignJson?.error
          ? `Курс сохранён, но список учеников не обновлён: ${assignJson.error}`
          : "Курс сохранён, но не удалось обновить список учеников."
      )
      onSaved(json.course)
      setIsSaving(false)
      return
    }

    onSaved(json.course)
    onOpenChange(false)
    setIsSaving(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки курса</DialogTitle>
          <DialogDescription>
            Название, уровень HSK, описание и цвет обложки. Ниже — кому доступен курс: выбранные ученики увидят его в
            разделе «Мои курсы» (можно отметить несколько — как группу).
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[min(55vh,420px)] pr-3">
          <div className="space-y-4">
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Название</p>
              <Input value={title} maxLength={20} onChange={(e) => setTitle(e.target.value)} placeholder="Название курса" />
              <p className="text-xs text-muted-foreground">{title.length}/20</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Описание</p>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Уровень</p>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger dsField>
                  <SelectValue placeholder="Выберите уровень" />
                </SelectTrigger>
                <SelectContent>
                  {TEACHER_COURSE_HSK_LEVELS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Свой вариант</SelectItem>
                </SelectContent>
              </Select>
              {level === "custom" ? (
                <Input value={levelCustom} onChange={(e) => setLevelCustom(e.target.value)} placeholder="Свой уровень" />
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Цвет обложки</p>
              <CourseCoverColorPicker value={coverColor} onChange={setCoverColor} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Фото на обложке</p>
              <p className="text-xs text-muted-foreground">
                По ссылке (HTTPS) или файл с устройства — до 5 МБ. Поверх фото накладывается тёмный градиент, чтобы
                заголовок и текст оставались читаемыми.
              </p>
              <div
                className="relative aspect-[2/1] max-h-28 w-full max-w-md overflow-hidden rounded-[var(--ds-radius-md)] border border-black/[0.08] dark:border-white/10"
                style={courseCoverFromCourse({
                  cover_color: coverColor,
                  cover_image_url: coverImageUrl.trim() || null,
                  cover_image_position: coverImagePosition
                })}
              >
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] dark:bg-black/35" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setCoverImageOpen(true)}>
                Загрузить фотографию
              </Button>
            </div>

            <div className="space-y-2 border-t border-black/[0.06] pt-4 dark:border-white/10">
              <p className="text-sm font-medium">Доступ ученикам</p>
              <p className="text-xs text-muted-foreground">
                В списке только ученики, закреплённые за вами в профиле. Курс появится у них в «Мои курсы» на сайте.
              </p>
              {studentsLoading ? (
                <p className="text-sm text-muted-foreground">Загрузка списка…</p>
              ) : studentsError ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">{studentsError}</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет закреплённых учеников — назначить пока некого.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {students.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-lg border border-black/[0.06] px-3 py-2 dark:border-white/10">
                      <Checkbox
                        id={`assign-${s.id}`}
                        checked={selectedStudentIds.has(s.id)}
                        onCheckedChange={(v) => toggleStudent(s.id, v === true)}
                      />
                      <Label htmlFor={`assign-${s.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                        {s.name}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={() => void saveCourse()} disabled={!submitEnabled || isSaving}>
            {isSaving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CourseCoverImageDialog
      open={coverImageOpen}
      onOpenChange={setCoverImageOpen}
      courseId={courseId}
      initial={{ url: coverImageUrl.trim() || null, position: coverImagePosition }}
      onApply={(next) => {
        setCoverImageUrl(next.url?.trim() ?? "")
        setCoverImagePosition(normalizeCoverImagePosition(next.position))
      }}
    />
    </>
  )
}
