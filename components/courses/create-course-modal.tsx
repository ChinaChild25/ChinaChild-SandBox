"use client"

import { useMemo, useState } from "react"
import type { TeacherCustomCourse } from "@/lib/types"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const hskLevels = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"] as const
const coverPalette = [
  "linear-gradient(120deg, #3b82f6, #8b5cf6)",
  "linear-gradient(120deg, #0ea5e9, #14b8a6)",
  "linear-gradient(120deg, #f97316, #ef4444)",
  "linear-gradient(120deg, #22c55e, #16a34a)",
  "linear-gradient(120deg, #ec4899, #8b5cf6)",
  "linear-gradient(120deg, #64748b, #334155)"
]

export function CreateCourseModal({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (course: TeacherCustomCourse) => void
}) {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [level, setLevel] = useState<string>("HSK1")
  const [levelCustom, setLevelCustom] = useState("")
  const [coverColor, setCoverColor] = useState(coverPalette[0]!)
  const [error, setError] = useState<string | null>(null)

  const submitEnabled = useMemo(() => {
    if (!title.trim()) return false
    if (title.trim().length > 20) return false
    if (level === "custom") return Boolean(levelCustom.trim())
    return true
  }, [title, level, levelCustom])

  async function createCourse() {
    if (!submitEnabled) return
    setIsCreating(true)
    setError(null)
    const res = await fetch("/api/teacher/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, level, levelCustom, coverColor, coverStyle: "gradient" })
    })
    const json = (await res.json().catch(() => null)) as { course?: TeacherCustomCourse; error?: string } | null
    if (!res.ok || !json?.course) {
      setError(json?.error ?? "Не удалось создать курс")
      setIsCreating(false)
      return
    }
    onCreated(json.course)
    onOpenChange(false)
    setIsCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать курс</DialogTitle>
          <DialogDescription>Новый курс будет доступен в разделе «Мои курсы».</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">Название</p>
            <Input
              value={title}
              maxLength={20}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название курса"
            />
            <p className="text-xs text-muted-foreground">{title.length}/20</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Описание</p>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Уровень</p>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите уровень" />
              </SelectTrigger>
              <SelectContent>
                {hskLevels.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Свой вариант</SelectItem>
              </SelectContent>
            </Select>
            {level === "custom" ? (
              <Input value={levelCustom} onChange={(e) => setLevelCustom(e.target.value)} placeholder="Свой уровень" />
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Цвет обложки</p>
            <div className="flex flex-wrap gap-2">
              {coverPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCoverColor(color)}
                  className={`h-8 w-8 rounded-full border ${coverColor === color ? "border-white ring-2 ring-white/60" : "border-border"}`}
                  style={{ background: color }}
                  aria-label="Выбрать цвет обложки"
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Отмена
          </Button>
          <Button onClick={createCourse} disabled={!submitEnabled || isCreating}>
            {isCreating ? "Создание..." : "Создать курс"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
