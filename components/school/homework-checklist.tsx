"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Check } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  tasks: string[]
  onContinue?: () => void
  continueLabel?: string
}

export function HomeworkChecklist({ tasks, onContinue, continueLabel = "К финалу" }: Props) {
  const [done, setDone] = useState<Record<number, boolean>>({})

  const completed = useMemo(() => tasks.reduce((n, _, i) => n + (done[i] ? 1 : 0), 0), [done, tasks])

  return (
    <div className="cc-hsk-hw">
      <ul className="cc-hsk-hw-list">
        {tasks.map((task, i) => {
          const isDone = !!done[i]
          return (
            <li key={i}>
              <button
                type="button"
                className={cn("cc-hsk-hw-row", isDone && "cc-hsk-hw-row--done")}
                onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
              >
                <span className={cn("cc-hsk-hw-badge", isDone && "cc-hsk-hw-badge--done")}>
                  {isDone ? <Check className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden /> : i + 1}
                </span>
                <span className="cc-hsk-hw-text">{task}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="cc-hsk-hw-footer">
        <span className="cc-hsk-hw-progress">
          Выполнено: {completed}/{tasks.length}
        </span>
        {onContinue ? (
          <button type="button" className="cc-hsk-btn-next" onClick={onContinue}>
            {continueLabel}
            <ArrowRight className="cc-hsk-btn-next-arrow" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}
