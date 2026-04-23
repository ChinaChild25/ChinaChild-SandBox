"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Стили под ds-figma: не дефолтный browser select. */
export const dsHskSelectTriggerClass = cn(
  "flex h-9 w-[min(100%,12rem)] items-center justify-between gap-2 rounded-[var(--ds-radius-md)] border border-black/10 bg-white px-3 py-2 text-left text-[13px] font-medium text-ds-ink shadow-none outline-none transition-colors",
  "hover:bg-ds-surface-hover focus-visible:ring-2 focus-visible:ring-ds-ink/20 disabled:cursor-not-allowed disabled:opacity-50",
  "data-[placeholder]:text-ds-text-tertiary dark:border-white/15 dark:bg-ds-surface dark:text-white dark:hover:bg-white/5",
  "[&_svg]:shrink-0 [&_svg]:opacity-60"
)

export const dsHskSelectContentClass = cn(
  "rounded-[var(--ds-radius-md)] border border-black/10 bg-white p-1 text-[13px] text-ds-ink shadow-sm",
  "dark:border-white/15 dark:bg-[#1a1a1a]"
)

export const dsHskSelectItemClass = cn(
  "rounded-[calc(var(--ds-radius-md)-2px)] py-2 pr-8 pl-2 text-[13px] outline-none",
  "focus:bg-[var(--ds-neutral-row-hover)] data-[highlighted]:bg-[var(--ds-neutral-row-hover)]",
  "dark:focus:bg-[var(--ds-neutral-row-hover)] dark:data-[highlighted]:bg-[var(--ds-neutral-row-hover)]"
)

type Item = { value: string; label: string }

type Props = {
  id: string
  /** Значение из БД: number или null/undefined = «не задан» */
  value: number | null | undefined
  items: Item[]
  unsetLabel: string
  placeholder: string
  disabled?: boolean
  onCommit: (next: number | null) => void | Promise<void>
  "aria-label"?: string
  className?: string
}

/**
 * Radix Select с единым оформлением для полей HSK (уровень / цель).
 * sentinel «unset» не показывается в value как число.
 */
export function HskDropdown({
  id,
  value,
  items,
  unsetLabel,
  placeholder,
  disabled,
  onCommit,
  "aria-label": ariaLabel,
  className
}: Props) {
  const inner = value === null || value === undefined ? "unset" : String(value)

  return (
    <Select
      value={inner}
      disabled={disabled}
      onValueChange={(raw) => {
        const next: number | null = raw === "unset" ? null : Number.parseInt(raw, 10)
        if (raw !== "unset" && (next === null || !Number.isFinite(next))) return
        void Promise.resolve(onCommit(next))
      }}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn(dsHskSelectTriggerClass, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={dsHskSelectContentClass}>
        <SelectItem value="unset" className={dsHskSelectItemClass}>
          {unsetLabel}
        </SelectItem>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value} className={dsHskSelectItemClass}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
