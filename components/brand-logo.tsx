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
