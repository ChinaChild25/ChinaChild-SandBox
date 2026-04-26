"use client"

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"
import type { SkillAxisKey, SkillMap } from "@/lib/lesson-analytics/server"

const SKILL_LABELS: Array<{ key: SkillAxisKey; label: string }> = [
  { key: "phrases", label: "Фразы" },
  { key: "vocabulary", label: "Лексика" },
  { key: "listening", label: "Аудирование" },
  { key: "grammar", label: "Грамматика" },
  { key: "reading", label: "Чтение" },
  { key: "speaking", label: "Говорение" },
]

type SkillRadarChartProps = {
  current: SkillMap
  previous?: SkillMap | null
  mode?: "hero" | "panel"
}

type RadarPoint = {
  subject: string
  current: number
  previous: number
}

function formatLevel(value: number): string {
  if (value >= 75) return "сильная зона"
  if (value >= 45) return "растёт"
  if (value > 0) return "нужно подтянуть"
  return "ещё нет данных"
}

function RadarTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload as RadarPoint | undefined
  if (!point) return null

  return (
    <div className="rounded-[14px] bg-[#1f1f22] px-3 py-2 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
      <p className="text-[13px] font-semibold">{point.subject}</p>
      <div className="mt-1 space-y-0.5 text-[12px] text-white/80">
        <p>Текущий уровень: {point.current}/100</p>
        <p>Состояние: {formatLevel(point.current)}</p>
        {point.previous > 0 ? <p>Прошлый срез: {point.previous}/100</p> : null}
      </div>
    </div>
  )
}

function AxisTick(props: {
  x?: number
  y?: number
  payload?: { value?: string }
  textAnchor?: "start" | "end" | "inherit" | "middle"
}) {
  if (typeof props.x !== "number" || typeof props.y !== "number" || !props.payload?.value) return null

  return (
    <text
      x={props.x}
      y={props.y}
      textAnchor={props.textAnchor}
      fill="#2d2c33"
      fontSize={16}
      fontWeight={600}
    >
      {props.payload.value}
    </text>
  )
}

export function SkillRadarChart({
  current,
  previous,
  mode = "panel",
}: SkillRadarChartProps) {
  const data: RadarPoint[] = SKILL_LABELS.map(({ key, label }) => ({
    subject: label,
    current: current[key],
    previous: previous?.[key] ?? 0,
  }))

  const hasCurrent = Object.values(current).some((value) => value > 0)
  const hasPrevious = previous ? Object.values(previous).some((value) => value > 0) : false
  const heightClass = mode === "hero" ? "h-[420px] sm:h-[500px]" : "h-[320px] sm:h-[360px]"
  const outerRadius = mode === "hero" ? "76%" : "72%"

  return (
    <div className={`relative w-full ${heightClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius={outerRadius}>
          <PolarGrid gridType="polygon" radialLines stroke="#ece8f2" />
          <PolarAngleAxis dataKey="subject" tickLine={false} axisLine={false} tick={<AxisTick />} />
          <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />

          {hasPrevious ? (
            <Radar
              dataKey="previous"
              stroke="#8E7FD8"
              fill="#C8BFF3"
              fillOpacity={0.22}
              strokeWidth={2.35}
              isAnimationActive
              animationDuration={520}
              animationEasing="ease-out"
            />
          ) : null}

          <Radar
            dataKey="current"
            stroke="#E3B73F"
            fill="#F5D783"
            fillOpacity={0.22}
            strokeWidth={2.45}
            isAnimationActive
            animationDuration={560}
            animationEasing="ease-out"
          />

          <Tooltip cursor={false} content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {!hasCurrent ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/92 px-4 py-2 text-sm font-medium text-ds-text-secondary shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            Карта заполнится после первых разобранных уроков
          </div>
        </div>
      ) : null}
    </div>
  )
}
