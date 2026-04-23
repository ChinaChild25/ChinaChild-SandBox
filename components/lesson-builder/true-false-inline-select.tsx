"use client"

import { forwardRef, useEffect, useRef, useState, type MutableRefObject } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type TrueFalseInlineSelectProps = {
  value: boolean | null
  onChange: (next: boolean | null) => void
  /** Student mode: first row clears selection; trigger shows placeholder until answered. */
  allowEmpty?: boolean
  emptyLabel?: string
  listboxAriaLabel?: string
  triggerAriaLabel?: string
  triggerClassName?: string
}

/** Правда/ложь без портала: список раскрывается вниз в том же блоке, что и триггер. */
export const TrueFalseInlineSelect = forwardRef<HTMLDivElement, TrueFalseInlineSelectProps>(
  function TrueFalseInlineSelect(
    {
      value,
      onChange,
      allowEmpty = false,
      emptyLabel = "Выберите ответ",
      listboxAriaLabel = "Верный ответ",
      triggerAriaLabel,
      triggerClassName
    },
    ref
  ) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)

    const setRootRef = (node: HTMLDivElement | null) => {
      rootRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node
    }

    useEffect(() => {
      if (!open) return
      const close = (e: PointerEvent) => {
        const root = rootRef.current
        if (root && !root.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener("pointerdown", close, true)
      return () => document.removeEventListener("pointerdown", close, true)
    }, [open])

    useEffect(() => {
      if (!open) return
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false)
      }
      window.addEventListener("keydown", onKey)
      return () => window.removeEventListener("keydown", onKey)
    }, [open])

    const label = allowEmpty && value === null ? emptyLabel : value ? "Правда" : "Ложь"

    return (
      <div ref={setRootRef} className="min-w-0 w-full">
        <div
          className={cn(
            "isolate flex flex-col overflow-hidden rounded-xl border-0 bg-background/90 text-card-foreground shadow-none dark:bg-input/45",
            /* ring-inset: без внешнего кольца у скруглений (нет «грязных» углов при overflow-hidden) */
            "focus-within:ring-[3px] focus-within:ring-inset focus-within:ring-ring/40"
          )}
        >
          <button
            type="button"
            className={cn(
              "flex h-12 min-h-12 w-full items-center justify-between gap-2 px-3 text-left text-sm outline-none transition-colors",
              "rounded-t-xl rounded-b-xl hover:bg-muted/25 focus-visible:ring-0",
              open && "rounded-b-none hover:bg-muted/20",
              triggerClassName
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={triggerAriaLabel}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="truncate">{label}</span>
            <ChevronDown
              className={cn("size-4 shrink-0 opacity-50 transition-transform duration-200", open && "rotate-180")}
              aria-hidden
            />
          </button>
          {open ? (
            <div
              role="listbox"
              aria-label={listboxAriaLabel}
              className="flex flex-col gap-0.5 overflow-hidden rounded-b-xl border-t border-black/[0.08] px-1.5 py-1.5 dark:border-white/[0.08]"
            >
              {allowEmpty ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === null}
                  className={cn(
                    "flex h-10 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                    value === null && "bg-muted/35 font-medium"
                  )}
                  onClick={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                >
                  {emptyLabel}
                </button>
              ) : null}
              <button
                type="button"
                role="option"
                aria-selected={value === true}
                className={cn(
                  "flex h-10 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                  value === true && "bg-muted/35 font-medium"
                )}
                onClick={() => {
                  onChange(true)
                  setOpen(false)
                }}
              >
                Правда
              </button>
              <button
                type="button"
                role="option"
                aria-selected={value === false}
                className={cn(
                  "flex h-10 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                  value === false && "bg-muted/35 font-medium"
                )}
                onClick={() => {
                  onChange(false)
                  setOpen(false)
                }}
              >
                Ложь
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
)
TrueFalseInlineSelect.displayName = "TrueFalseInlineSelect"
