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
}

type RadarPoint = {
  subject: string
  current: number
  previous: number
  max: number
}

function formatLevel(value: number): string {
  if (value >= 75) return "Уверенно"
  if (value >= 45) return "Растёт"
  return "Нужна практика"
}

function RadarTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload as RadarPoint | undefined
  if (!point) return null

  return (
    <div className="rounded-[22px] bg-[#1f1f22] px-4 py-3 text-white shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
      <p className="text-sm font-semibold">{point.subject}</p>
      <div className="mt-2 space-y-1 text-sm text-white/[0.78]">
        <p>Текущий уровень: {point.current}/100</p>
        <p>Статус: {formatLevel(point.current)}</p>
        {point.previous > 0 ? <p>Предыдущий урок: {point.previous}/100</p> : null}
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
      fontSize={15}
      fontWeight={600}
    >
      {props.payload.value}
    </text>
  )
}

export function SkillRadarChart({ current, previous }: SkillRadarChartProps) {
  const data: RadarPoint[] = SKILL_LABELS.map(({ key, label }) => ({
    subject: label,
    current: current[key],
    previous: previous?.[key] ?? 0,
    max: 100,
  }))

  const hasCurrent = Object.values(current).some((value) => value > 0)
  const hasPrevious = previous ? Object.values(previous).some((value) => value > 0) : false

  return (
    <div className="relative h-[360px] w-full sm:h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid
            gridType="polygon"
            radialLines
            stroke="#eceaf2"
            className="[&_line]:stroke-white/90"
          />
          <PolarAngleAxis dataKey="subject" tickLine={false} axisLine={false} tick={<AxisTick />} />
          <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />

          <Radar
            dataKey="max"
            stroke="#9BD7F7"
            strokeDasharray="8 8"
            fill="none"
            strokeWidth={1.8}
            isAnimationActive={false}
          />

          {hasPrevious ? (
            <Radar
              dataKey="previous"
              stroke="#93C5FD"
              strokeDasharray="7 6"
              fill="#93C5FD"
              fillOpacity={0.08}
              strokeWidth={2.25}
              isAnimationActive={false}
            />
          ) : null}

          <Radar
            dataKey="current"
            stroke="#F5C542"
            fill="#F5C542"
            fillOpacity={hasCurrent ? 0.18 : 0}
            strokeWidth={2.75}
            isAnimationActive={false}
          />

          <Tooltip cursor={false} content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {!hasCurrent ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/[0.88] px-4 py-2 text-sm font-medium text-ds-text-secondary shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
            Карта начнет заполняться после первых разобранных уроков
          </div>
        </div>
      ) : null}
    </div>
  )
}
