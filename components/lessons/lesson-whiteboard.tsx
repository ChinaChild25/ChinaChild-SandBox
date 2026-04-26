"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Eraser, Grid3X3, Minus, Paintbrush, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type WhiteboardCopy = {
  title: string
  subtitle: string
  localHint: string
  pen: string
  eraser: string
  clear: string
  undo: string
  thinner: string
  thicker: string
  gridOn: string
  gridOff: string
}

type WhiteboardProps = {
  copy: WhiteboardCopy
  className?: string
}

type Point = {
  x: number
  y: number
}

type Stroke = {
  mode: "draw" | "erase"
  color: string
  width: number
  points: Point[]
}

const COLOR_SWATCHES = ["#171717", "#b42318", "#2563eb", "#047857", "#7c3aed"]

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return

  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = stroke.width
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over"

  if (stroke.points.length === 1) {
    const point = stroke.points[0]!
    ctx.beginPath()
    ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y)
  for (const point of stroke.points.slice(1)) {
    ctx.lineTo(point.x, point.y)
  }
  ctx.stroke()
  ctx.restore()
}

export function LessonWhiteboard({ copy, className }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const draftStrokeRef = useRef<Stroke | null>(null)
  const isDrawingRef = useRef(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [tool, setTool] = useState<"pen" | "eraser">("pen")
  const [color, setColor] = useState(COLOR_SWATCHES[0]!)
  const [strokeWidth, setStrokeWidth] = useState(6)
  const [showGrid, setShowGrid] = useState(true)

  const gridStyle = useMemo(
    () =>
      showGrid
        ? {
            backgroundImage:
              "linear-gradient(to right, rgba(23,23,23,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,23,23,0.08) 1px, transparent 1px), linear-gradient(to right, rgba(23,23,23,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,23,23,0.03) 1px, transparent 1px)",
            backgroundSize: "96px 96px, 96px 96px, 24px 24px, 24px 24px",
            backgroundPosition: "center center"
          }
        : undefined,
    [showGrid]
  )

  const redrawCanvas = useCallback((allStrokes: Stroke[], draftStroke?: Stroke | null) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(canvasSize.width * dpr))
    canvas.height = Math.max(1, Math.floor(canvasSize.height * dpr))
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, canvasSize.width, canvasSize.height)

    for (const stroke of allStrokes) {
      drawStroke(context, stroke)
    }

    if (draftStroke) {
      drawStroke(context, draftStroke)
    }
  }, [canvasSize.height, canvasSize.width])

  useEffect(() => {
    redrawCanvas(strokes, draftStrokeRef.current)
  }, [redrawCanvas, strokes])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    const syncSize = () => {
      const nextRect = surface.getBoundingClientRect()
      setCanvasSize({
        width: Math.max(1, Math.floor(nextRect.width)),
        height: Math.max(1, Math.floor(nextRect.height))
      })
    }

    syncSize()

    const observer = new ResizeObserver(syncSize)
    observer.observe(surface)

    return () => observer.disconnect()
  }, [])

  const getPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }, [])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    isDrawingRef.current = true
    draftStrokeRef.current = {
      mode: tool === "eraser" ? "erase" : "draw",
      color,
      width: strokeWidth,
      points: [getPoint(event)]
    }

    redrawCanvas(strokes, draftStrokeRef.current)
  }, [color, getPoint, redrawCanvas, strokeWidth, strokes, tool])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !draftStrokeRef.current) return

    event.preventDefault()
    draftStrokeRef.current = {
      ...draftStrokeRef.current,
      points: [...draftStrokeRef.current.points, getPoint(event)]
    }

    redrawCanvas(strokes, draftStrokeRef.current)
  }, [getPoint, redrawCanvas, strokes])

  const finishStroke = useCallback(() => {
    if (!isDrawingRef.current || !draftStrokeRef.current) return

    const nextStroke = draftStrokeRef.current
    draftStrokeRef.current = null
    isDrawingRef.current = false
    setStrokes((current) => [...current, nextStroke])
  }, [])

  const handleUndo = useCallback(() => {
    setStrokes((current) => current.slice(0, -1))
  }, [])

  const currentToolButtonClass =
    "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
  const idleToolButtonClass =
    "bg-black/[0.05] text-ds-ink hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12]"

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ds-ink dark:text-white">{copy.title}</h3>
        <p className="text-[13px] leading-5 text-ds-text-secondary dark:text-white/65">{copy.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className={tool === "pen" ? currentToolButtonClass : idleToolButtonClass}
          onClick={() => setTool("pen")}
          aria-pressed={tool === "pen"}
        >
          <Paintbrush aria-hidden />
          {copy.pen}
        </Button>
        <Button
          type="button"
          size="sm"
          className={tool === "eraser" ? currentToolButtonClass : idleToolButtonClass}
          onClick={() => setTool("eraser")}
          aria-pressed={tool === "eraser"}
        >
          <Eraser aria-hidden />
          {copy.eraser}
        </Button>
        <Button
          type="button"
          size="sm"
          className={idleToolButtonClass}
          onClick={() => setShowGrid((current) => !current)}
          aria-pressed={showGrid}
        >
          <Grid3X3 aria-hidden />
          {showGrid ? copy.gridOff : copy.gridOn}
        </Button>
        <Button type="button" size="sm" className={idleToolButtonClass} onClick={handleUndo} disabled={strokes.length === 0}>
          <RotateCcw aria-hidden />
          {copy.undo}
        </Button>
        <Button type="button" size="sm" className={idleToolButtonClass} onClick={() => setStrokes([])} disabled={strokes.length === 0}>
          <Trash2 aria-hidden />
          {copy.clear}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {COLOR_SWATCHES.map((swatch) => {
          const selected = color === swatch
          return (
            <button
              key={swatch}
              type="button"
              className={cn(
                "h-8 w-8 rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40",
                selected && "scale-105 ring-2 ring-black/30 ring-offset-2 ring-offset-[var(--ds-surface)] dark:ring-white/55 dark:ring-offset-[#171717]"
              )}
              style={{ backgroundColor: swatch }}
              aria-label={swatch}
              aria-pressed={selected}
              onClick={() => {
                setColor(swatch)
                setTool("pen")
              }}
            />
          )
        })}

        <div className="ml-auto flex items-center gap-2 rounded-full bg-black/[0.05] px-2 py-1.5 dark:bg-white/[0.08]">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-ds-ink transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-white dark:hover:bg-white/[0.08]"
            aria-label={copy.thinner}
            onClick={() => setStrokeWidth((current) => Math.max(2, current - 2))}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[3.5rem] text-center text-[12px] font-medium text-ds-text-secondary dark:text-white/70">
            {strokeWidth}px
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-ds-ink transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-white dark:hover:bg-white/[0.08]"
            aria-label={copy.thicker}
            onClick={() => setStrokeWidth((current) => Math.min(18, current + 2))}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[24px] bg-[rgba(255,255,255,0.76)] shadow-[inset_0_0_0_1px_rgba(23,23,23,0.06)] dark:bg-[#111111] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <div
          ref={surfaceRef}
          className="relative h-full min-h-[280px] w-full touch-none overflow-hidden"
          style={gridStyle}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onPointerLeave={finishStroke}
          />
        </div>
      </div>

      <p className="text-[12px] leading-5 text-ds-text-tertiary dark:text-white/48">{copy.localHint}</p>
    </div>
  )
}
