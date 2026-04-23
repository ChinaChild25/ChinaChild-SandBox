'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

/**
 * Единый вид подсказки: тёмный чип, белый текст, скруглённый прямоугольник.
 * Не используем `rounded-md` / `rounded-lg`: в теме `--radius-md` ≈ 14px при высоте чипа ~26px
 * даёт полукруглые торцы («пилюля»). Фиксированный px — явный прямоугольник с углами.
 */
export const TOOLTIP_CHIP_SURFACE_CLASS =
  'rounded-[10px] border-0 bg-[#1a1a1a] px-2 py-1 text-[13px] font-normal leading-snug text-white shadow-none text-balance'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  'aria-label': ariaLabelProp,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const ariaLabel =
    ariaLabelProp ??
    (typeof children === 'string' || typeof children === 'number' ? String(children) : undefined)

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        aria-label={ariaLabel}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
          TOOLTIP_CHIP_SURFACE_CLASS,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
