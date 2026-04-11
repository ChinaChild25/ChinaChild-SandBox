"use client"

import { useState } from "react"

type Props = {
  tasks: string[]
}

export function HomeworkChecklist({ tasks }: Props) {
  const [done, setDone] = useState<Record<number, boolean>>({})

  return (
    <ul className="space-y-3">
      {tasks.map((task, i) => (
        <li key={i} className="flex gap-3 rounded-[var(--cc-radius-md)] bg-[#f8f9fb] p-3">
          <input
            id={`hw-${i}`}
            type="checkbox"
            checked={!!done[i]}
            onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--cc-hsk-accent)]"
          />
          <label htmlFor={`hw-${i}`} className="cc-lesson-note cursor-pointer">
            {task}
          </label>
        </li>
      ))}
    </ul>
  )
}
