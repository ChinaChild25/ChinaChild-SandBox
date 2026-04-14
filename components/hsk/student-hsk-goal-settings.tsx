"use client"

import { useEffect, useState } from "react"
import { HskDropdown } from "@/components/hsk/hsk-dropdown"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { updateProfileFields } from "@/lib/supabase/profile"
import { hskGoalRange } from "@/lib/hsk-goal"
import { useUiLocale } from "@/lib/ui-locale"
import { cn } from "@/lib/utils"

type Props = {
  userId: string
  initialGoal: number | null | undefined
  onSaved: () => Promise<unknown>
  className?: string
}

/**
 * Цель HSK в настройках ученика: сохранение в profiles.hsk_goal (свой профиль).
 */
export function StudentHskGoalSettings({ userId, initialGoal, onSaved, className }: Props) {
  const { t } = useUiLocale()
  const [value, setValue] = useState<number | null | undefined>(initialGoal)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setValue(initialGoal)
  }, [initialGoal, userId])

  async function handleCommit(next: number | null) {
    const prev = value
    setValue(next)
    setErr(null)
    setSaving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await updateProfileFields(supabase, userId, { hsk_goal: next })
      if (error) throw error
      await onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.hskGoalSaveError"))
      setValue(prev)
    } finally {
      setSaving(false)
    }
  }

  const items = hskGoalRange().map((n) => ({ value: String(n), label: `HSK ${n}` }))

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor="settings-hsk-goal" className="text-[13px] font-medium text-ds-ink">
        {t("settings.hskGoalLabel")}
      </label>
      <p className="mb-1 text-[12px] text-ds-text-tertiary">{t("settings.hskGoalStudentHelp")}</p>
      <HskDropdown
        id="settings-hsk-goal"
        value={value}
        items={items}
        unsetLabel={t("settings.hskGoalUnset")}
        placeholder={t("settings.hskGoalPlaceholder")}
        disabled={saving}
        aria-label={t("settings.hskGoalLabel")}
        onCommit={(next) => void handleCommit(next)}
      />
      {err ? <span className="text-[12px] text-red-600 dark:text-red-400">{err}</span> : null}
    </div>
  )
}
