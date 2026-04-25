"use client"

import { useEffect, useMemo, useState } from "react"
import { CourseArtworkSlot } from "@/components/courses/course-artwork-slot"
import type { TeacherCustomCourse } from "@/lib/types"
import { CourseCoverImageDialog } from "@/components/courses/course-cover-image-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  courseAccentFromCourse,
  courseBannerPalette,
  courseCoverFromCourse,
  coverStyleForCourseSave,
  normalizeCoverImagePosition,
  TEACHER_COURSE_COVER_PALETTE,
  TEACHER_COURSE_HSK_LEVELS
} from "@/lib/teacher-custom-course-form"
import { CourseCoverColorPicker } from "@/components/courses/course-cover-color-picker"

export function CreateCourseModal({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (course: TeacherCustomCourse) => void
}) {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [level, setLevel] = useState<string>("HSK1")
  const [levelCustom, setLevelCustom] = useState("")
  const [coverColor, setCoverColor] = useState<string>(TEACHER_COURSE_COVER_PALETTE[0]!)
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [coverImagePosition, setCoverImagePosition] = useState("50% 50%")
  const [coverImageScale, setCoverImageScale] = useState(1)
  const [coverImageFlipX, setCoverImageFlipX] = useState(false)
  const [coverImageFlipY, setCoverImageFlipY] = useState(false)
  const [coverImageOpen, setCoverImageOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCoverImageUrl("")
    setCoverImagePosition("50% 50%")
    setCoverImageScale(1)
    setCoverImageFlipX(false)
    setCoverImageFlipY(false)
  }, [open])

  const submitEnabled = useMemo(() => {
    if (!title.trim()) return false
    if (title.trim().length > 20) return false
    if (level === "custom") return Boolean(levelCustom.trim())
    return true
  }, [title, level, levelCustom])
  const bannerPalette = courseBannerPalette(coverColor)
  const bannerAccent = courseAccentFromCourse({ cover_color: coverColor })

  async function createCourse() {
    if (!submitEnabled) return
    setIsCreating(true)
    setError(null)
    const res = await fetch("/api/teacher/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        level,
        levelCustom,
        coverColor,
        coverImageUrl: coverImageUrl.trim() || null,
        coverImagePosition: normalizeCoverImagePosition(coverImagePosition),
        coverImageScale,
        coverImageFlipX,
        coverImageFlipY,
        coverStyle: coverStyleForCourseSave({ hasPhoto: Boolean(coverImageUrl.trim()), coverColor })
      })
    })
    const json = (await res.json().catch(() => null)) as { course?: TeacherCustomCourse; error?: string } | null
    if (!res.ok || !json?.course) {
      setError(json?.error ?? "Не удалось создать курс")
      setIsCreating(false)
      return
    }
    onCreated(json.course)
    onOpenChange(false)
    setIsCreating(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать курс</DialogTitle>
          <DialogDescription>Новый курс будет доступен в разделе «Мои курсы».</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">Название</p>
            <Input
              value={title}
              maxLength={20}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название курса"
            />
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
                Изображение появится в правом слоте баннера. Ссылка HTTPS или файл до 5 МБ.
              </p>
              <div
                className="overflow-hidden rounded-[24px] border border-black/[0.08] p-4 dark:border-white/10"
                style={courseCoverFromCourse({
                  cover_color: coverColor,
                })}
              >
                <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: bannerPalette.secondary }}>
                      Превью баннера
                    </p>
                    <p className="mt-2 text-2xl font-bold leading-none" style={{ color: bannerPalette.text }}>
                      {title.trim() || "Название курса"}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: bannerPalette.secondary }}>
                      {(level === "custom" ? levelCustom.trim() : level) || "HSK1"}
                    </p>
                    <p className="mt-3 max-w-[32ch] text-sm leading-6" style={{ color: bannerPalette.secondary }}>
                      {description.trim() || "Короткое описание курса появится здесь."}
                    </p>
                  </div>
                  <div
                    className="h-[132px] w-full overflow-hidden rounded-[22px]"
                    style={{ backgroundColor: bannerPalette.artworkSlotBg }}
                  >
                    <CourseArtworkSlot
                      cover={{
                        cover_image_url: coverImageUrl.trim() || null,
                        cover_image_position: coverImagePosition,
                        cover_image_scale: coverImageScale,
                        cover_image_flip_x: coverImageFlipX,
                        cover_image_flip_y: coverImageFlipY,
                        cover_style: null,
                      }}
                      accentColor={bannerAccent}
                      className="h-full w-full rounded-[22px]"
                      iconClassName="h-[58%] w-[58%] opacity-80"
                    />
                  </div>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setCoverImageOpen(true)}>
                Загрузить фотографию
              </Button>
            </div>
          </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Отмена
          </Button>
          <Button onClick={createCourse} disabled={!submitEnabled || isCreating}>
            {isCreating ? "Создание..." : "Создать курс"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CourseCoverImageDialog
      open={coverImageOpen}
      onOpenChange={setCoverImageOpen}
      courseId={null}
      coverColor={coverColor}
      initial={{
        url: coverImageUrl.trim() || null,
        position: coverImagePosition,
        scale: coverImageScale,
        flipX: coverImageFlipX,
        flipY: coverImageFlipY,
      }}
      onApply={(next) => {
        setCoverImageUrl(next.url?.trim() ?? "")
        setCoverImagePosition(normalizeCoverImagePosition(next.position))
        setCoverImageScale(next.scale)
        setCoverImageFlipX(next.flipX)
        setCoverImageFlipY(next.flipY)
      }}
    />
    </>
  )
}
