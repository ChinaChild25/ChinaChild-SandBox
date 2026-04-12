"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { getCroppedAvatarBlob } from "@/lib/avatar-crop"
import { useUiLocale } from "@/lib/ui-locale"

export type AvatarCropApplyResult = { ok: true } | { ok: false; message: string }

type AvatarCropDialogProps = {
  open: boolean
  imageSrc: string
  onOpenChange: (open: boolean) => void
  onApply: (blob: Blob) => Promise<AvatarCropApplyResult>
}

export function AvatarCropDialog({ open, imageSrc, onOpenChange, onApply }: AvatarCropDialogProps) {
  const { t } = useUiLocale()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const pixelsRef = useRef<Area | null>(null)

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setLocalErr(null)
      pixelsRef.current = null
    }
  }, [open, imageSrc])

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    pixelsRef.current = areaPixels
  }, [])

  const handleSave = async () => {
    const pixels = pixelsRef.current
    if (!pixels) {
      setLocalErr(t("settings.avatarCropFailed"))
      return
    }
    setLocalErr(null)
    setSubmitting(true)
    try {
      const blob = await getCroppedAvatarBlob(imageSrc, pixels)
      const result = await onApply(blob)
      if (!result.ok) {
        setLocalErr(result.message)
        return
      }
      onOpenChange(false)
    } catch {
      setLocalErr(t("settings.avatarCropFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={!submitting}
        onPointerDownOutside={(e) => {
          if (submitting) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault()
        }}
      >
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{t("settings.avatarCropTitle")}</DialogTitle>
          <DialogDescription>{t("settings.avatarCropHint")}</DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(52vh,320px)] w-full bg-[#1a1a1a]">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-2 border-b border-border px-5 py-4">
          <label className="text-[13px] font-medium text-foreground" htmlFor="avatar-crop-zoom">
            {t("settings.avatarZoom")}
          </label>
          <Slider
            id="avatar-crop-zoom"
            min={1}
            max={3}
            step={0.02}
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
            disabled={submitting}
            className="w-full"
          />
        </div>

        {localErr ? (
          <p className="px-5 pt-3 text-[13px] text-red-600 dark:text-red-300" role="alert">
            {localErr}
          </p>
        ) : null}

        <DialogFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-4 sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-[var(--ds-radius-md)] border border-black/15 bg-transparent px-4 text-[14px] font-semibold text-ds-ink transition-colors hover:bg-black/[0.04] dark:border-white/20 dark:text-white dark:hover:bg-white/10"
          >
            {t("settings.avatarCropCancel")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSave()}
            className="flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-black px-4 text-[14px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("settings.avatarApply")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
