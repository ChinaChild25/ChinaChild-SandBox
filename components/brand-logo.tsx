"use client"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  compact?: boolean
}

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  return (
    <div
      className={cn(
        "text-[#181b24] leading-[0.86] tracking-[-0.055em]",
        compact ? "text-[1.8rem] font-extrabold" : "text-[2.1rem] font-extrabold",
        className
      )}
      aria-label="ChinaChild"
    >
      <p>China</p>
      <p>Child</p>
    </div>
  )
}

/** Круглый знак «ЧЧ» как в макете Figma (сайдбар) */
export function ChinaChildCircleMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-[15px] font-bold tracking-[-0.02em] text-white",
        className
      )}
      aria-hidden
    >
      ЧЧ
    </div>
  )
}
