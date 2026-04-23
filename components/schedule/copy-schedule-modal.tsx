"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WeekdayKey } from "@/lib/teacher-availability-template"
import { WEEK_OVERVIEW_DAYS } from "@/components/schedule/week-overview"

export function CopyScheduleModal({
  open,
  sourceDay,
  onClose,
  onApply
}: {
  open: boolean
  sourceDay: WeekdayKey
  onClose: () => void
  onApply: (targets: WeekdayKey[]) => void
}) {
  const [selected, setSelected] = useState<WeekdayKey[]>([])
  const targetDays = useMemo(() => WEEK_OVERVIEW_DAYS.filter((d) => d.key !== sourceDay), [sourceDay])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Скопировать расписание</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[13px] text-ds-text-secondary">Куда применить выбранный день:</p>
          {targetDays.map((d) => (
            <label key={d.key} className="flex items-center gap-2 text-[13px] text-ds-ink">
              <input
                type="checkbox"
                checked={selected.includes(d.key)}
                onChange={() =>
                  setSelected((prev) => (prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key]))
                }
              />
              {d.full}
            </label>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="ds-neutral-pill px-3 py-1.5 text-[12px]"
              onClick={() => setSelected(["monday", "tuesday", "wednesday", "thursday", "friday"].filter((x) => x !== sourceDay) as WeekdayKey[])}
            >
              Во все будни
            </button>
            <button
              type="button"
              className="ds-neutral-pill px-3 py-1.5 text-[12px]"
              onClick={() => setSelected(targetDays.map((d) => d.key))}
            >
              Во всю неделю
            </button>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              onApply(selected)
              setSelected([])
              onClose()
            }}
            disabled={selected.length === 0}
          >
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
