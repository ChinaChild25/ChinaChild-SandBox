"use client"

import { useEffect, useState } from "react"
import { HskDropdown } from "@/components/hsk/hsk-dropdown"
import { hskLevelRange } from "@/lib/hsk-level"
import { cn } from "@/lib/utils"

type Props = {
  studentProfileId: string
  initialLevel: number | null | undefined
  className?: string
  onSaved?: (level: number | null) => void
}

function normalizeHskTeacherError(message: string): string {
  if (/column "hsk_level" of relation "profiles" does not exist/i.test(message)) {
    return "В Supabase не применена миграция HSK уровня (profiles.hsk_level)."
  }
  if (/could not find the function public\.set_student_hsk_level/i.test(message)) {
    return "RPC set_student_hsk_level не найдена в Supabase. Примените миграции и обновите schema cache."
  }
  return message
}

export function TeacherStudentHskLevelSelect({ studentProfileId, initialLevel, className, onSaved }: Props) {
  const [value, setValue] = useState<number | null | undefined>(initialLevel)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setValue(initialLevel)
  }, [initialLevel, studentProfileId])

  async function handleCommit(next: number | null) {
    const prev = value
    setValue(next)
    setErr(null)
    setSaving(true)
    const payload =
      next === null
        ? { student_id: studentProfileId, hsk_level: null as number | null }
        : { student_id: studentProfileId, hsk_level: next }
    try {
      const res = await fetch("/api/teacher/student-hsk-level", {
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

  const items = hskLevelRange().map((n) => ({ value: String(n), label: `HSK ${n}` }))

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <HskDropdown
        id={`hsk-level-${studentProfileId}`}
        value={value}
        items={items}
        unsetLabel="Не задан"
        placeholder="Уровень HSK"
        disabled={saving}
        aria-label="Уровень HSK"
        onCommit={(next) => void handleCommit(next)}
      />
      {err ? <span className="text-[12px] text-red-600 dark:text-red-400">{err}</span> : null}
    </div>
  )
}
