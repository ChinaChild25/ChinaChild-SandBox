"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { computeWaveformPeaksFromUrl } from "@/lib/audio-waveform"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DEFAULT_BAR_COUNT = 40

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function resamplePeaks(peaks: number[] | null | undefined, count: number): number[] {
  if (!peaks || peaks.length === 0) {
    return Array.from({ length: count }, (_, i) => 0.1 + ((i * 7) % 5) * 0.04)
  }
  if (peaks.length === count) return peaks.map(clamp01)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const pos = peaks.length === 1 ? 0 : (i / (count - 1)) * (peaks.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(peaks.length - 1, Math.ceil(pos))
    const t = pos - lo
    out.push(clamp01(peaks[lo]! * (1 - t) + peaks[hi]! * t))
  }
  return out
}

export function VoiceWaveformBars({
  peaks,
  liveBars,
  progress = 0,
  barCount = DEFAULT_BAR_COUNT,
  active = false,
  className,
  playedBarClassName,
  idleBarClassName,
  liveActiveBarClassName,
  liveIdleBarClassName
}: {
  peaks?: number[] | null
  liveBars?: number[] | null
  progress?: number
  barCount?: number
  /** подсветка «живой» записи */
  active?: boolean
  className?: string
  playedBarClassName?: string
  idleBarClassName?: string
  liveActiveBarClassName?: string
  liveIdleBarClassName?: string
}) {
  const display =
    liveBars && liveBars.length > 0 ? resamplePeaks(liveBars, barCount) : resamplePeaks(peaks, barCount)

  return (
    <div className={cn("flex h-9 min-w-0 flex-1 items-center gap-px sm:gap-0.5", className)} aria-hidden>
      {display.map((h, i) => {
        const played = (i + 1) / display.length <= progress
        const heightPx = 4 + h * 26
        return (
          <div
            key={i}
            className={cn(
              "w-[2px] shrink-0 rounded-full transition-[height,background-color] duration-75 sm:w-[3px]",
              liveBars && liveBars.length > 0
                ? active
                  ? (liveActiveBarClassName ?? "bg-primary/90")
                  : (liveIdleBarClassName ?? "bg-muted-foreground/45")
                : played
                  ? (playedBarClassName ?? "bg-primary")
                  : (idleBarClassName ?? "bg-muted-foreground/35")
            )}
            style={{ height: `${heightPx}px` }}
          />
        )
      })}
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function LessonAudioPlayerRow({
  src,
  peaks,
  liveBars,
  isRecording,
  barCount = DEFAULT_BAR_COUNT,
  onDecodedPeaks,
  className,
  containerClassName,
  buttonClassName,
  waveformClassName,
  playedBarClassName,
  idleBarClassName,
  liveActiveBarClassName,
  liveIdleBarClassName,
  timeClassName
}: {
  src: string
  peaks?: number[] | null
  liveBars?: number[] | null
  isRecording?: boolean
  barCount?: number
  /** после успешного разбора URL (например, вставленная ссылка) */
  onDecodedPeaks?: (next: number[]) => void
  className?: string
  containerClassName?: string
  buttonClassName?: string
  waveformClassName?: string
  playedBarClassName?: string
  idleBarClassName?: string
  liveActiveBarClassName?: string
  liveIdleBarClassName?: string
  timeClassName?: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const onDecodedRef = useRef(onDecodedPeaks)
  onDecodedRef.current = onDecodedPeaks

  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [fetchedPeaks, setFetchedPeaks] = useState<number[] | null>(null)

  const mergedPeaks = peaks && peaks.length > 0 ? peaks : fetchedPeaks

  useEffect(() => {
    setFetchedPeaks(null)
    setPlaying(false)
    setProgress(0)
    setDuration(0)
    setCurrentTime(0)
  }, [src])

  useEffect(() => {
    if (!src || isRecording || liveBars) return
    if (peaks && peaks.length > 0) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await computeWaveformPeaksFromUrl(src)
          if (cancelled) return
          setFetchedPeaks(next)
          onDecodedRef.current?.(next)
        } catch {
          /* CORS или не аудио */
        }
      })()
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [src, isRecording, liveBars, peaks])

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.duration || !Number.isFinite(el.duration)) {
      setProgress(0)
      return
    }
    setCurrentTime(el.currentTime)
    setProgress(el.currentTime / el.duration)
  }, [])

  async function togglePlay() {
    const el = audioRef.current
    if (!el || !src) return
    if (playing) {
      el.pause()
      setPlaying(false)
      return
    }
    try {
      await el.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const showPlayer = Boolean(src) && !isRecording && !(liveBars && liveBars.length > 0)

  const timeLabel =
    showPlayer && duration > 0 ? (playing ? formatTime(currentTime) : formatTime(duration)) : ""

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2 py-1.5 dark:bg-muted/30",
        containerClassName,
        className
      )}
    >
      {showPlayer ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={cn("h-9 w-9 shrink-0 rounded-full", buttonClassName)}
            onClick={() => void togglePlay()}
            aria-label={playing ? "Пауза" : "Воспроизвести"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <VoiceWaveformBars
            peaks={mergedPeaks}
            progress={playing || progress > 0 ? progress : 0}
            barCount={barCount}
            className={waveformClassName}
            playedBarClassName={playedBarClassName}
            idleBarClassName={idleBarClassName}
            liveActiveBarClassName={liveActiveBarClassName}
            liveIdleBarClassName={liveIdleBarClassName}
          />
          <span className={cn("w-10 shrink-0 text-right tabular-nums text-xs text-muted-foreground", timeClassName)}>{timeLabel}</span>
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            className="hidden"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              setDuration(Number.isFinite(d) ? d : 0)
            }}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => {
              setPlaying(false)
              setProgress(0)
              setCurrentTime(0)
            }}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
        </>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("shrink-0 text-xs text-muted-foreground", timeClassName)}>{isRecording ? "Запись…" : ""}</span>
          <VoiceWaveformBars
            peaks={mergedPeaks}
            liveBars={liveBars ?? undefined}
            active={isRecording}
            barCount={barCount}
            className={waveformClassName}
            playedBarClassName={playedBarClassName}
            idleBarClassName={idleBarClassName}
            liveActiveBarClassName={liveActiveBarClassName}
            liveIdleBarClassName={liveIdleBarClassName}
          />
        </div>
      )}
    </div>
  )
}
