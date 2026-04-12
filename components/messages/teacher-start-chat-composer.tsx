"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, MessageSquarePlus } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { getOrCreateConversation, loadStudentProfilesForTeacherPicker } from "@/lib/supabase/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function TeacherStartChatComposer() {
  const router = useRouter()
  const { user } = useAuth()
  const [students, setStudents] = useState<{ id: string; label: string }[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [selectedId, setSelectedId] = useState("")
  const [manualUuid, setManualUuid] = useState("")
  const [working, setWorking] = useState(false)
  /** Только ошибки создания беседы (RLS, сеть), не список/роли */
  const [chatError, setChatError] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setListLoading(false)
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      setListLoading(true)
      const { students: rows, error } = await loadStudentProfilesForTeacherPicker(supabase, user.id)
      if (error) {
        console.warn("[TeacherStartChat] не удалось загрузить список учеников (только для отображения):", error.message)
        setStudents([])
      } else {
        setStudents(rows)
      }
      setListLoading(false)
    })()
  }, [user?.id])

  const openChat = useCallback(
    async (peerUserId: string) => {
      const trimmed = peerUserId.trim()
      if (!trimmed || !user?.id) return
      if (!UUID_RE.test(trimmed)) {
        console.warn("[TeacherStartChat] неверный формат UUID:", trimmed)
        return
      }
      setChatError(null)
      setWorking(true)
      const supabase = createBrowserSupabaseClient()
      const res = await getOrCreateConversation(supabase, user.id, trimmed)
      setWorking(false)
      if ("error" in res) {
        setChatError(res.error)
        return
      }
      router.replace(`/teacher/messages?conversation=${res.conversationId}`)
    },
    [router, user?.id]
  )

  const onSubmitSelect = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    void openChat(selectedId)
  }

  const onSubmitDebug = (e: React.FormEvent) => {
    e.preventDefault()
    if (!UUID_RE.test(manualUuid.trim())) {
      console.warn("[TeacherStartChat] debug: неверный UUID")
      return
    }
    void openChat(manualUuid)
  }

  const listEmpty = !listLoading && students.length === 0

  return (
    <div className="border-b border-[#e8e8e8] bg-ds-surface px-4 py-4 dark:border-[#333333]">
      <div className="mx-auto flex w-full max-w-[min(100%,1320px)] flex-col gap-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ds-ink">
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-ds-text-secondary" aria-hidden />
          Новый диалог
        </div>
        <p className="text-[13px] leading-snug text-ds-text-secondary">
          Выберите ученика и откройте чат. Список — для удобства; сам чат создаётся по id без проверки ролей в этом шаге.
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
                setChatError(null)
              }}
              disabled={listLoading || working}
              className="mt-1.5 flex h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-[14px] text-ds-ink outline-none focus-visible:ring-2 focus-visible:ring-ds-ink/20 disabled:opacity-60 dark:border-white/15 dark:bg-[#141414]"
            >
              <option value="">{listLoading ? "Загрузка…" : "Выберите ученика"}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {listEmpty ? (
              <p className="mt-1.5 text-[12px] text-ds-text-tertiary">
                Список пуст. При необходимости используйте отладку ниже.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={working || listLoading || !selectedId} className="h-11 shrink-0">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Открыть чат"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setDebugOpen((o) => !o)}
          className="flex items-center gap-1 text-left text-[12px] font-medium uppercase tracking-wide text-ds-text-placeholder hover:text-ds-text-secondary"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", debugOpen && "rotate-180")} aria-hidden />
          Отладка
        </button>

        {debugOpen ? (
          <form
            onSubmit={onSubmitDebug}
            className="flex flex-col gap-3 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-4 dark:border-white/20 dark:bg-white/[0.03] sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor="teacher-chat-uuid" className="text-[12px] text-ds-text-placeholder">
                UUID пользователя (отладка)
              </Label>
              <Input
                id="teacher-chat-uuid"
                value={manualUuid}
                onChange={(e) => {
                  setManualUuid(e.target.value)
                  setChatError(null)
                }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={working}
                className="mt-1.5 h-11 rounded-xl font-mono text-[13px]"
              />
            </div>
            <Button type="submit" variant="outline" disabled={working || !manualUuid.trim()} className="h-11 shrink-0">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Открыть"}
            </Button>
          </form>
        ) : null}

        {chatError ? <p className="text-[13px] text-destructive">{chatError}</p> : null}
      </div>
    </div>
  )
}
