"use client"

import type { ReactNode } from "react"
import { MoveHorizontal, MoveVertical, RotateCcw, Scan } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type MediaTransformControlsProps = {
  x: number
  y: number
  scale: number
  flipX: boolean
  flipY: boolean
  accentColor: string
  onXChange: (value: number) => void
  onYChange: (value: number) => void
  onScaleChange: (value: number) => void
  onFlipXChange: (value: boolean) => void
  onFlipYChange: (value: boolean) => void
  onReset: () => void
  minScale?: number
  maxScale?: number
  className?: string
}

function MetricLabel({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 text-[13px] font-medium text-ds-text-secondary">
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span>{value}</span>
    </div>
  )
}

export function MediaTransformControls({
  x,
  y,
  scale,
  flipX,
  flipY,
  accentColor,
  onXChange,
  onYChange,
  onScaleChange,
  onFlipXChange,
  onFlipYChange,
  onReset,
  minScale = 1,
  maxScale = 2.5,
  className,
}: MediaTransformControlsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3">
        <div>
          <MetricLabel
            icon={<MoveHorizontal className="h-3.5 w-3.5" aria-hidden />}
            label="Горизонталь"
            value={`${x}%`}
          />
          <Slider
            min={0}
            max={100}
            step={1}
            value={[x]}
            onValueChange={(value) => onXChange(value[0] ?? x)}
            className="w-full"
            style={{ ["--slider-accent" as string]: accentColor }}
          />
        </div>

        <div>
          <MetricLabel
            icon={<MoveVertical className="h-3.5 w-3.5" aria-hidden />}
            label="Вертикаль"
            value={`${y}%`}
          />
          <Slider
            min={0}
            max={100}
            step={1}
            value={[y]}
            onValueChange={(value) => onYChange(value[0] ?? y)}
            className="w-full"
            style={{ ["--slider-accent" as string]: accentColor }}
          />
        </div>

        <div>
          <MetricLabel
            icon={<Scan className="h-3.5 w-3.5" aria-hidden />}
            label="Масштаб"
            value={`${Math.round(scale * 100)}%`}
          />
          <Slider
            min={Math.round(minScale * 100)}
            max={Math.round(maxScale * 100)}
            step={1}
            value={[Math.round(scale * 100)]}
            onValueChange={(value) => onScaleChange((value[0] ?? Math.round(scale * 100)) / 100)}
            className="w-full"
            style={{ ["--slider-accent" as string]: accentColor }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-10 items-center gap-2 rounded-[var(--ds-radius-md)] bg-[var(--ds-neutral-row)] px-3.5 text-sm text-ds-ink">
          <Switch checked={flipX} onCheckedChange={onFlipXChange} />
          <span>Отразить по X</span>
        </label>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-[var(--ds-radius-md)] bg-[var(--ds-neutral-row)] px-3.5 text-sm text-ds-ink">
          <Switch checked={flipY} onCheckedChange={onFlipYChange} />
          <span>Отразить по Y</span>
        </label>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-md)] bg-[var(--ds-neutral-row)] px-3.5 text-sm font-medium text-ds-ink transition-colors hover:bg-[var(--ds-neutral-row-hover)]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Сбросить
        </button>
      </div>
    </div>
  )
}
