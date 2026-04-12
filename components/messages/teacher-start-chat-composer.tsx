"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquarePlus } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  getOrCreateConversation,
  loadAllStudentProfilesForPicker,
  loadStudentProfilesForTeacherPicker
} from "@/lib/supabase/chat"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Компактная кнопка «Новый диалог» с выбором ученика (панель преподавателя). */
export function TeacherStartChatComposer() {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [students, setStudents] = useState<{ id: string; label: string }[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)
  const [pickerFromAllStudents, setPickerFromAllStudents] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setListLoading(false)
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      setListLoading(true)
      setPickerFromAllStudents(false)
      const primary = await loadStudentProfilesForTeacherPicker(supabase, user.id)
      if (primary.error) {
        console.warn("[TeacherStartChat] не удалось загрузить список учеников:", primary.error.message)
        setStudents([])
        setListLoading(false)
        return
      }
      if (primary.students.length > 0) {
        setStudents(primary.students)
        setListLoading(false)
        return
      }
      const fallback = await loadAllStudentProfilesForPicker(supabase)
      if (fallback.error) {
        console.warn("[TeacherStartChat] fallback учеников:", fallback.error.message)
        setStudents([])
      } else {
        setStudents(fallback.students)
        setPickerFromAllStudents(fallback.students.length > 0)
      }
      setListLoading(false)
    })()
  }, [user?.id])

  const openChat = useCallback(
    async (peerUserId: string, peerLabel: string) => {
      const trimmed = peerUserId.trim()
      if (!trimmed || !user?.id) return
      if (!UUID_RE.test(trimmed)) {
        console.warn("[TeacherStartChat] неверный формат UUID:", trimmed)
        return
      }
      setChatError(null)
      setWorkingId(trimmed)
      const supabase = createBrowserSupabaseClient()
      const res = await getOrCreateConversation(supabase, user.id, trimmed)
      setWorkingId(null)
      if ("error" in res) {
        setChatError(res.error)
        return
      }
      setOpen(false)
      const label = encodeURIComponent(peerLabel.trim() || "Ученик")
      router.replace(
        `/teacher/messages?conversation=${res.conversationId}&peerId=${trimmed}&peerName=${label}`
      )
    },
    [router, user?.id]
  )

  const listEmpty = !listLoading && students.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-full border-black/10 px-3 text-[13px] font-medium dark:border-white/15"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          Новый диалог
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(calc(100vw-2rem),18rem)] border-black/10 p-0 shadow-lg dark:border-white/15"
      >
        <div className="border-b border-black/5 px-3 py-2.5 dark:border-white/10">
          <p className="text-[13px] font-semibold text-ds-ink">Выберите ученика</p>
          <p className="text-[11px] text-ds-text-tertiary">Откроется существующий чат или создастся новый</p>
          {pickerFromAllStudents ? (
            <p className="mt-1 text-[11px] leading-snug text-ds-text-placeholder">
              Показаны все ученики, доступные вам по правам доступа
            </p>
          ) : null}
        </div>
        <div className="max-h-[min(50vh,16rem)] overflow-y-auto overscroll-contain p-1">
          {listLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-ds-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Загрузка…
            </div>
          ) : listEmpty ? (
            <p className="px-3 py-6 text-center text-[13px] font-medium leading-snug text-ds-text-secondary">
              Нет доступных учеников
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {students.map((s) => {
                const busy = workingId === s.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!!workingId}
                      onClick={() => void openChat(s.id, s.label)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14px] text-ds-ink transition-colors",
                        "hover:bg-black/[0.04] disabled:opacity-60 dark:hover:bg-white/[0.06]"
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ds-text-secondary" aria-hidden />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[12px] font-semibold text-ds-text-secondary dark:bg-white/10">
                          {s.label.trim()[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {chatError ? (
          <p className="border-t border-black/5 px-3 py-2 text-[12px] leading-snug text-destructive dark:border-white/10">
            {chatError}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
