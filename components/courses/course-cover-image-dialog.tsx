"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { Plus } from "lucide-react"
import {
  courseCoverSurfaceStyle,
  isAllowedExternalCoverImageUrl,
  normalizeCoverImagePosition
} from "@/lib/teacher-custom-course-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type CourseCoverImageValue = {
  url: string | null
  position: string
}

function parsePositionPercents(pos: string): { x: number; y: number } {
  const n = normalizeCoverImagePosition(pos)
  const [xs, ys] = n.split(" ")
  return {
    x: Math.min(100, Math.max(0, parseInt(xs!, 10) || 50)),
    y: Math.min(100, Math.max(0, parseInt(ys!, 10) || 50))
  }
}

export function CourseCoverImageDialog({
  open,
  onOpenChange,
  courseId,
  initial,
  onApply
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null — новый курс, файл уходит в draft/… */
  courseId: string | null
  initial: CourseCoverImageValue
  onApply: (next: CourseCoverImageValue) => void
}) {
  const [tab, setTab] = useState<"link" | "file">("link")
  const [workingUrl, setWorkingUrl] = useState("")
  const [position, setPosition] = useState("50% 50%")
  const [linkDraft, setLinkDraft] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileFieldId = useId()

  const { x, y } = parsePositionPercents(position)

  const resetFromInitial = useCallback(() => {
    const u = initial.url?.trim() ?? ""
    setWorkingUrl(u)
    setLinkDraft(u)
    setPosition(normalizeCoverImagePosition(initial.position))
    setLinkError(null)
    setFileError(null)
    setTab("link")
  }, [initial.url, initial.position])

  useEffect(() => {
    if (!open) return
    resetFromInitial()
  }, [open, resetFromInitial])

  function setPositionFromPercents(nx: number, ny: number) {
    setPosition(`${Math.round(Math.min(100, Math.max(0, nx)))}% ${Math.round(Math.min(100, Math.max(0, ny)))}%`)
  }

  function verifyLink() {
    setLinkError(null)
    const raw = linkDraft.trim()
    if (!raw) {
      setLinkError("Вставьте ссылку на изображение (HTTPS)")
      return
    }
    if (!isAllowedExternalCoverImageUrl(raw)) {
      setLinkError("Нужна ссылка HTTPS без скобок в адресе, либо путь с сайта (/…)")
      return
    }
    const img = new Image()
    img.onload = () => {
      setWorkingUrl(raw)
      setLinkError(null)
    }
    img.onerror = () => setLinkError("Не удалось загрузить изображение по ссылке")
    img.src = raw
  }

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setFileError(null)
    if (file.size > 5 * 1024 * 1024) {
      setFileError("Не больше 5 МБ — сожмите фото или выберите другой файл.")
      return
    }
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    if (!ok) {
      setFileError("Формат: JPEG, PNG, WebP или GIF.")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (courseId) fd.append("courseId", courseId)
      const res = await fetch("/api/teacher/course-covers/upload", { method: "POST", body: fd })
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !json?.url) {
        setFileError(json?.error ?? "Не удалось загрузить")
        return
      }
      setWorkingUrl(json.url)
      setLinkDraft(json.url)
    } finally {
      setUploading(false)
    }
  }

  function onPreviewClick(ev: React.PointerEvent<HTMLElement>) {
    if (!workingUrl.trim()) return
    const el = ev.currentTarget
    const r = el.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * 100
    const py = ((ev.clientY - r.top) / r.height) * 100
    setPositionFromPercents(px, py)
  }

  function apply() {
    const u = workingUrl.trim()
    if (u && !isAllowedExternalCoverImageUrl(u)) {
      setLinkError("Некорректный URL")
      return
    }
    onApply({ url: u || null, position: normalizeCoverImagePosition(position) })
    onOpenChange(false)
  }

  function removePhoto() {
    onApply({ url: null, position: "50% 50%" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[60]"
        className="z-[70] max-h-[min(92vh,640px)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Фотография обложки</DialogTitle>
          <DialogDescription>
            Укажите ссылку HTTPS на картинку или загрузите файл с устройства (до 5 МБ: JPEG, PNG, WebP, GIF). Ниже
            можно сместить кадр — какая часть фото попадёт в обложку.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "file")} className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="link" className="flex-1 sm:flex-none">
              По ссылке
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 sm:flex-none">
              С устройства
            </TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cover-img-url">URL изображения (HTTPS)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="cover-img-url"
                  value={linkDraft}
                  onChange={(e) => {
                    setLinkDraft(e.target.value)
                    setLinkError(null)
                  }}
                  placeholder="https://…"
                  spellCheck={false}
                  autoComplete="off"
                />
                <Button type="button" variant="secondary" className="shrink-0" onClick={() => void verifyLink()}>
                  Проверить
                </Button>
              </div>
              {linkError ? <p className="text-xs text-red-500">{linkError}</p> : null}
            </div>
          </TabsContent>
          <TabsContent value="file" className="mt-4 space-y-3">
            <p className="text-xs text-ds-text-secondary">
              Файл не больше 5 МБ. Изображение загружается на сервер и появится в курсе по публичной ссылке.
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  htmlFor={fileFieldId}
                  className={cn(
                    "ds-input-field flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2.5 transition-opacity",
                    uploading && "pointer-events-none opacity-50"
                  )}
                >
                  <input
                    id={fileFieldId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => void onFilePick(e)}
                  />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-ds-surface-muted dark:bg-ds-surface">
                    <Plus className="size-5 text-ds-ink" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-left text-sm text-ds-text-secondary">
                    Нажмите, чтобы выбрать файл на устройстве
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[min(90vw,280px)] text-balance">
                Форматы: JPEG, PNG, WebP или GIF. Размер не больше 5 МБ — файл загрузится на сервер после выбора.
              </TooltipContent>
            </Tooltip>
            {uploading ? <p className="text-sm text-ds-text-secondary">Загрузка…</p> : null}
            {fileError ? <p className="text-xs text-red-500">{fileError}</p> : null}
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>Кадр на обложке</Label>
          <p className="text-xs text-ds-text-secondary">Нажмите на превью в нужную точку или подвиньте ползунки.</p>
          <button
            type="button"
            className="relative aspect-[16/10] w-full cursor-crosshair overflow-hidden rounded-[var(--ds-radius-md)] border border-black/10 shadow-sm dark:border-white/15"
            style={courseCoverSurfaceStyle("#c4b5fd", { url: workingUrl || null, position })}
            onPointerDown={onPreviewClick}
            aria-label="Выбрать фрагмент фотографии для обложки"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] dark:bg-black/40"
            />
            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
              Превью
            </span>
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Горизонталь — {x}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={x}
                className="w-full accent-ds-ink"
                onChange={(e) => setPositionFromPercents(Number(e.target.value), y)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Вертикаль — {y}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={y}
                className="w-full accent-ds-ink"
                onChange={(e) => setPositionFromPercents(x, Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(initial.url ?? "").trim() || workingUrl.trim() ? (
              <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => removePhoto()}>
                Убрать фото
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void apply()} disabled={Boolean(workingUrl.trim() && !isAllowedExternalCoverImageUrl(workingUrl.trim()))}>
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
