"use client"

import { useEffect, useState } from "react"
import { HskDropdown } from "@/components/hsk/hsk-dropdown"
import { hskGoalRange } from "@/lib/hsk-goal"
import { cn } from "@/lib/utils"

type Props = {
  studentProfileId: string
  initialGoal: number | null | undefined
  className?: string
  onSaved?: (goal: number | null) => void
}

function normalizeHskTeacherError(message: string): string {
  if (/column "hsk_goal" of relation "profiles" does not exist/i.test(message)) {
    return "В Supabase не применена миграция цели HSK (profiles.hsk_goal)."
  }
  if (/function public\.teacher_can_set_student_hsk\(uuid, uuid\) does not exist/i.test(message)) {
    return "В Supabase не хватает helper-функции teacher_can_set_student_hsk. Примените миграции."
  }
  if (/could not find the function public\.set_student_hsk_goal/i.test(message)) {
    return "RPC set_student_hsk_goal не найдена в Supabase. Примените миграции и обновите schema cache."
  }
  return message
}

export function TeacherStudentHskGoalSelect({ studentProfileId, initialGoal, className, onSaved }: Props) {
  const [value, setValue] = useState<number | null | undefined>(initialGoal)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setValue(initialGoal)
  }, [initialGoal, studentProfileId])

  async function handleCommit(next: number | null) {
    const prev = value
    setValue(next)
    setErr(null)
    setSaving(true)
    const payload =
      next === null
        ? { student_id: studentProfileId, hsk_goal: null as number | null }
        : { student_id: studentProfileId, hsk_goal: next }
    try {
      const res = await fetch("/api/teacher/student-hsk-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || "Не удалось сохранить")
      }
      onSaved?.(next)
    } catch (e) {
      setErr(e instanceof Error ? normalizeHskTeacherError(e.message) : "Ошибка")
      setValue(prev)
    } finally {
      setSaving(false)
    }
  }

  const items = hskGoalRange().map((n) => ({ value: String(n), label: `HSK ${n}` }))

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <HskDropdown
        id={`hsk-goal-${studentProfileId}`}
        value={value}
        items={items}
        unsetLabel="Не задана"
        placeholder="Цель HSK"
        disabled={saving}
        aria-label="Цель HSK"
        onCommit={(next) => void handleCommit(next)}
      />
      {err ? <span className="text-[12px] text-red-600 dark:text-red-400">{err}</span> : null}
    </div>
  )
}
