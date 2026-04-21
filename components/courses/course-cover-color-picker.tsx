"use client"

import { useEffect, useId, useState } from "react"
import { Plus } from "lucide-react"
import {
  hexForColorInput,
  isTeacherCourseCoverPreset,
  normalizeHexColor,
  TEACHER_COURSE_COVER_PALETTE
} from "@/lib/teacher-custom-course-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function CourseCoverColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const hexFieldId = useId()
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState("#64748B")
  const [hexError, setHexError] = useState<string | null>(null)

  const isCustom = !isTeacherCourseCoverPreset(value)

  useEffect(() => {
    if (!open) return
    setHexError(null)
    setHexDraft(hexForColorInput(isCustom ? value : "#64748B"))
  }, [open, isCustom, value])

  function applyHex() {
    const normalized = normalizeHexColor(hexDraft)
    if (!normalized) {
      setHexError("Введите цвет в формате HEX, например #2B6CB0")
      return
    }
    onChange(normalized)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TEACHER_COURSE_COVER_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`h-8 w-8 shrink-0 rounded-full border ${value === color ? "border-white ring-2 ring-white/60" : "border-border"}`}
          style={{ background: color }}
          aria-label="Выбрать цвет обложки"
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed bg-ds-surface text-ds-ink transition-colors hover:bg-ds-surface-hover ${
              isCustom ? "border-ds-ink ring-2 ring-ds-ink/20" : "border-border"
            }`}
            aria-label="Свой цвет HEX"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[min(100vw-2rem,20rem)] rounded-[var(--ds-radius-md)] border-black/10 bg-ds-surface p-4 text-ds-text-primary shadow-md dark:border-white/10 dark:bg-ds-surface"
        >
          <p className="text-sm font-semibold text-ds-ink">Свой цвет</p>
          <p className="mt-1 text-xs text-ds-text-secondary">Любой HEX — сплошная заливка обложки курса.</p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              aria-label="Палитра"
              className="h-10 w-14 shrink-0 cursor-pointer rounded-[var(--ds-radius-sm)] border border-black/10 bg-transparent p-0.5 dark:border-white/15"
              value={hexForColorInput(hexDraft)}
              onChange={(e) => {
                setHexError(null)
                setHexDraft(e.target.value.toUpperCase())
              }}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs font-medium text-ds-text-tertiary" htmlFor={hexFieldId}>
                HEX
              </label>
              <Input
                id={hexFieldId}
                value={hexDraft}
                onChange={(e) => {
                  setHexError(null)
                  setHexDraft(e.target.value)
                }}
                placeholder="#1A1A1A"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
          {hexError ? <p className="mt-2 text-xs text-red-500">{hexError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" size="sm" onClick={() => void applyHex()}>
              Применить
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
