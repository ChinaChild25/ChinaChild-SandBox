"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"
import { computeWaveformPeaksFromUrl } from "@/lib/audio-waveform"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
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
    <div
      className={cn("grid h-9 min-w-0 flex-1 items-center gap-x-px sm:gap-x-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${display.length}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {display.map((h, i) => {
        const played = (i + 1) / display.length <= progress
        const heightPx = 4 + h * 26
        return (
          <div
            key={i}
            className={cn(
              "mx-auto w-full max-w-[2px] rounded-full transition-[height,background-color] duration-75 sm:max-w-[3px]",
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

/** Равносторонний ▶ в 24×24; className SVG должен содержать `size-*` (иначе `Button` даёт svg size-4). */
function SolidPlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M5.45 6.75Q5.87 5.98 6.359 6.225L15.453 11.475Q16.982 12 15.453 12.525L6.359 17.775Q5.87 18.02 5.45 17.25Z"
      />
    </svg>
  )
}

function SolidPauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <rect x="4.4" y="4.15" width="6.55" height="15.7" rx="3.2" ry="3.2" />
      <rect x="13.05" y="4.15" width="6.55" height="15.7" rx="3.2" ry="3.2" />
    </svg>
  )
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
  timeClassName,
  seekable = false,
  volumeControl = false,
  speedControl = false,
  transportIconMode = "lucide",
  transportIconClassName,
  onPlaybackComplete,
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
  /** Клик / перетаскивание по полосе волны — перемотка */
  seekable?: boolean
  /** Слайдер громкости (элемент `audio.volume`) */
  volumeControl?: boolean
  /** Переключение скорости воспроизведения */
  speedControl?: boolean
  /** `solid` — залитые play/pause (цвет через `transportIconClassName` + currentColor). */
  transportIconMode?: "lucide" | "solid"
  /** Класс для SVG (например `text-neutral-500`). */
  transportIconClassName?: string
  onPlaybackComplete?: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveRef = useRef<HTMLDivElement>(null)
  const onDecodedRef = useRef(onDecodedPeaks)
  onDecodedRef.current = onDecodedPeaks

  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [fetchedPeaks, setFetchedPeaks] = useState<number[] | null>(null)
  const [volume, setVolume] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [waveWidth, setWaveWidth] = useState(0)

  const adaptiveBarCount =
    waveWidth > 0 ? Math.max(DEFAULT_BAR_COUNT, Math.min(220, Math.round(waveWidth / 4.5))) : 96
  const resolvedBarCount = Math.max(barCount, adaptiveBarCount)

  const mergedPeaks = peaks && peaks.length > 0 ? peaks : fetchedPeaks

  useEffect(() => {
    setFetchedPeaks(null)
    setPlaying(false)
    setProgress(0)
    setDuration(0)
    setCurrentTime(0)
  }, [src])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
  }, [volume])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const waveEl = waveRef.current
    if (!waveEl) return

    const updateWidth = () => {
      setWaveWidth(waveEl.getBoundingClientRect().width)
    }

    updateWidth()
    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(waveEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!src || isRecording || liveBars) return
    if (peaks && peaks.length > 0) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await computeWaveformPeaksFromUrl(src, resolvedBarCount)
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
  }, [src, isRecording, liveBars, peaks, resolvedBarCount])

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
      el.volume = volume
      await el.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const wave = waveRef.current
      const el = audioRef.current
      if (!seekable || !wave || !el) return
      const d = el.duration
      if (!Number.isFinite(d) || d <= 0) return
      const rect = wave.getBoundingClientRect()
      const ratio = clamp01((clientX - rect.left) / rect.width)
      el.currentTime = ratio * d
      setCurrentTime(el.currentTime)
      setProgress(ratio)
    },
    [seekable],
  )

  const onWavePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!seekable) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      seekFromClientX(e.clientX)
    },
    [seekable, seekFromClientX],
  )

  const onWavePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!seekable) return
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      seekFromClientX(e.clientX)
    },
    [seekable, seekFromClientX],
  )

  const onWavePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const showPlayer = Boolean(src) && !isRecording && !(liveBars && liveBars.length > 0)

  const timeLabel =
    showPlayer && duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : ""

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2 py-1.5 dark:bg-muted/30",
        (volumeControl || speedControl) && "flex-wrap",
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
            className={cn("h-9 w-9 shrink-0", buttonClassName, "rounded-full")}
            onClick={() => void togglePlay()}
            aria-label={playing ? "Пауза" : "Воспроизвести"}
          >
            {transportIconMode === "solid" ? (
              playing ? (
                <SolidPauseIcon className={cn("size-4 shrink-0", transportIconClassName)} />
              ) : (
                <SolidPlayIcon
                  className={cn("size-4 shrink-0 translate-x-px", transportIconClassName)}
                />
              )
            ) : playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
          <div
            ref={waveRef}
            className={cn(
              "flex min-w-0 flex-1 touch-none items-stretch",
              seekable &&
                "cursor-pointer rounded-md px-0.5 py-0.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
            )}
            role={seekable ? "slider" : undefined}
            tabIndex={seekable ? 0 : undefined}
            aria-label={seekable ? "Позиция воспроизведения" : undefined}
            aria-valuemin={seekable ? 0 : undefined}
            aria-valuemax={seekable ? 100 : undefined}
            aria-valuenow={seekable ? Math.round(progress * 100) : undefined}
            onPointerDown={seekable ? onWavePointerDown : undefined}
            onPointerMove={seekable ? onWavePointerMove : undefined}
            onPointerUp={seekable ? onWavePointerUp : undefined}
            onPointerCancel={seekable ? onWavePointerUp : undefined}
            onKeyDown={
              seekable
                ? (e) => {
                    const el = audioRef.current
                    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return
                    if (e.key === "ArrowLeft") {
                      e.preventDefault()
                      el.currentTime = Math.max(0, el.currentTime - 5)
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault()
                      el.currentTime = Math.min(el.duration, el.currentTime + 5)
                    }
                  }
                : undefined
            }
          >
            <VoiceWaveformBars
              peaks={mergedPeaks}
              progress={playing || progress > 0 ? progress : 0}
              barCount={resolvedBarCount}
              className={cn("min-w-0 flex-1", waveformClassName)}
              playedBarClassName={playedBarClassName}
              idleBarClassName={idleBarClassName}
              liveActiveBarClassName={liveActiveBarClassName}
              liveIdleBarClassName={liveIdleBarClassName}
            />
          </div>
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-right tabular-nums text-[11px] text-muted-foreground sm:text-xs",
              timeClassName,
            )}
          >
            {timeLabel}
          </span>
          {speedControl ? (
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center rounded-full bg-black/[0.06] px-3 text-[12px] font-semibold text-ds-ink transition-colors hover:bg-black/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
              onClick={() =>
                setPlaybackRate((prev) => {
                  const rates = [0.75, 1, 1.25, 1.5]
                  const currentIndex = rates.findIndex((rate) => Math.abs(rate - prev) < 0.001)
                  return rates[(currentIndex + 1) % rates.length] ?? 1
                })
              }
              aria-label={`Скорость воспроизведения ${playbackRate}x`}
            >
              {playbackRate}x
            </button>
          ) : null}
          {volumeControl ? (
            <div className="flex w-[76px] shrink-0 items-center gap-1.5 sm:w-[92px]">
              {volume < 0.04 ? (
                <VolumeX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <Slider
                className={cn(
                  "min-w-0 flex-1 py-1",
                  /* track/range/thumb: без bg-muted/bg-primary (в sage-accent они зелёные) */
                  "[&_[data-slot=slider-track]]:!bg-neutral-300/70 dark:[&_[data-slot=slider-track]]:!bg-neutral-600/45",
                  "[&_[data-slot=slider-range]]:!bg-neutral-600 dark:[&_[data-slot=slider-range]]:!bg-neutral-300",
                  "[&_[data-slot=slider-thumb]]:!border-neutral-400 [&_[data-slot=slider-thumb]]:!bg-white",
                  "dark:[&_[data-slot=slider-thumb]]:!border-neutral-500",
                )}
                min={0}
                max={100}
                step={1}
                value={[Math.round(volume * 100)]}
                onValueChange={(v) => {
                  const pct = (v[0] ?? 0) / 100
                  setVolume(pct)
                  if (audioRef.current) audioRef.current.volume = pct
                }}
                aria-label="Громкость"
              />
            </div>
          ) : null}
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            className="hidden"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              setDuration(Number.isFinite(d) ? d : 0)
              e.currentTarget.volume = volume
            }}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => {
              setPlaying(false)
              setProgress(0)
              setCurrentTime(0)
              onPlaybackComplete?.()
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
            barCount={resolvedBarCount}
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
