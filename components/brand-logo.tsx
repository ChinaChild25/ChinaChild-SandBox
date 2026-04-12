"use client"

import Image from "next/image"

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

/** Круглый знак «ЧЧ» (легаси / компактные места) */
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

const MARK_LIGHT = "/brand/chinachild-mark-light.svg"
const MARK_DARK = "/brand/chinachild-mark-dark.svg"

/**
 * Логотип как в v0: 52×52, отдельные SVG для светлой (#FEFEFE круг) и тёмной (#1A1A1A круг) темы.
 */
export function ChinaChildSidebarLogo({
  className,
  size = 52
}: {
  className?: string
  /** Сторона квадрата, по умолчанию 52 как в макете */
  size?: number
}) {
  return (
    <span className={cn("relative inline-block shrink-0 leading-none", className)} style={{ width: size, height: size }}>
      <Image
        src={MARK_LIGHT}
        alt="ChinaChild"
        width={size}
        height={size}
        className="h-full w-full dark:hidden"
        unoptimized
        priority
      />
      <Image
        src={MARK_DARK}
        alt=""
        width={size}
        height={size}
        className="hidden h-full w-full dark:block"
        unoptimized
        priority
        aria-hidden
      />
    </span>
  )
}
