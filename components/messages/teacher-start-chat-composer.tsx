"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquarePlus } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  createStudentTeacherConversation,
  loadStudentProfilesForTeacherPicker
} from "@/lib/supabase/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function TeacherStartChatComposer() {
  const router = useRouter()
  const { user } = useAuth()
  const [students, setStudents] = useState<{ id: string; label: string }[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [manualUuid, setManualUuid] = useState("")
  const [working, setWorking] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setListLoading(false)
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      setListLoading(true)
      setListError(null)
      const { students: rows, error } = await loadStudentProfilesForTeacherPicker(supabase, user.id)
      if (error) {
        setListError(error.message)
        setStudents([])
      } else {
        setStudents(rows)
      }
      setListLoading(false)
    })()
  }, [user?.id])

  const openChat = useCallback(
    async (studentProfileId: string) => {
      const trimmed = studentProfileId.trim()
      if (!trimmed || !user?.id) return
      if (!UUID_RE.test(trimmed)) {
        setFormError("Некорректный UUID ученика.")
        return
      }
      setFormError(null)
      setWorking(true)
      const supabase = createBrowserSupabaseClient()
      const res = await createStudentTeacherConversation(supabase, user.id, trimmed)
      setWorking(false)
      if ("error" in res) {
        setFormError(res.error)
        return
      }
      router.replace(`/teacher/messages?conversation=${res.conversationId}`)
    },
    [router, user?.id]
  )

  const onSubmitSelect = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) {
      setFormError("Выберите ученика из списка.")
      return
    }
    void openChat(selectedId)
  }

  const onSubmitManual = (e: React.FormEvent) => {
    e.preventDefault()
    void openChat(manualUuid)
  }

  return (
    <div className="border-b border-[#e8e8e8] bg-ds-surface px-4 py-4 dark:border-[#333333]">
      <div className="mx-auto flex w-full max-w-[min(100%,1320px)] flex-col gap-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ds-ink">
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-ds-text-secondary" aria-hidden />
          Написать ученику
        </div>
        <p className="text-[13px] leading-snug text-ds-text-secondary">
          Выберите ученика из школы или вставьте его UUID из Supabase (Authentication → Users).
        </p>

        <form onSubmit={onSubmitSelect} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[min(100%,280px)] flex-1">
            <Label htmlFor="teacher-chat-student" className="text-[13px] text-ds-text-secondary">
              Ученик
            </Label>
            <select
              id="teacher-chat-student"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setFormError(null)
              }}
              disabled={listLoading || working}
              className="mt-1.5 flex h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-[14px] text-ds-ink outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/20 disabled:opacity-60 dark:border-white/15 dark:bg-[#141414]"
            >
              <option value="">{listLoading ? "Загрузка…" : "— выберите —"}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {listError ? (
              <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">
                Список не загрузился: {listError}. Используйте поле UUID ниже или проверьте миграцию RLS для
                преподавателя.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={working || listLoading} className="h-11 shrink-0">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Открыть чат"}
          </Button>
        </form>

        <form onSubmit={onSubmitManual} className="flex flex-col gap-3 border-t border-black/5 pt-4 dark:border-white/10 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="teacher-chat-uuid" className="text-[13px] text-ds-text-secondary">
              UUID ученика
            </Label>
            <Input
              id="teacher-chat-uuid"
              value={manualUuid}
              onChange={(e) => {
                setManualUuid(e.target.value)
                setFormError(null)
              }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={working}
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={working || !manualUuid.trim()} className="h-11 shrink-0">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Открыть по UUID"}
          </Button>
        </form>

        {formError ? <p className="text-[13px] text-destructive">{formError}</p> : null}
      </div>
    </div>
  )
}
