"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Mail, Send, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ChatMessage, type Conversation } from "@/lib/messages-conversations"
import { mentorSlugs } from "@/lib/mentors"

const CHAT_BREAKPOINT = 1024

export type MessagesViewProps = {
  conversations: Conversation[]
  /** Ссылка «Профиль» у ментора: по умолчанию /mentors/:id */
  mentorProfileHref?: (mentorId: string) => string
  /** ?mentor= из URL (кабинет ученика) */
  initialMentorId?: string | null
}

export function MessagesView({
  conversations,
  mentorProfileHref,
  initialMentorId
}: MessagesViewProps) {
  const profileHref = mentorProfileHref ?? ((id: string) => `/mentors/${id}`)

  const [wide, setWide] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list")
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(() => conversations[0]?.id ?? null)
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>(() =>
    Object.fromEntries(conversations.map((c) => [c.id, c.seed]))
  )
  const [inputText, setInputText] = useState("")

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${CHAT_BREAKPOINT}px)`)
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (!initialMentorId) return
    const hit = conversations.find((c) => c.id === initialMentorId)
    if (hit) {
      setActiveId(hit.id)
      setMobilePanel("chat")
    }
  }, [initialMentorId, conversations])

  const active = useMemo(() => {
    if (!activeId) return undefined
    return conversations.find((c) => c.id === activeId)
  }, [activeId, conversations])

  const messages = active ? (threads[active.id] ?? active.seed) : []

  const filteredConvos = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
    )
  }, [query, conversations])

  const handleSwitch = useCallback(
    (id: string) => {
      setActiveId(id)
      if (!wide) setMobilePanel("chat")
    },
    [wide]
  )

  const handleSend = useCallback(() => {
    if (!active) return
    const t = inputText.trim()
    if (!t) return
    setThreads((prev) => ({
      ...prev,
      [active.id]: [...(prev[active.id] ?? active.seed), { from: "me", text: t, time: "Сейчас" }]
    }))
    setInputText("")
  }, [active, inputText])

  const showList = wide || mobilePanel === "list"
  const showChat = wide || mobilePanel === "chat"

  const empty = conversations.length === 0

  return (
    <div className="ds-figma-page ds-messages-page flex min-h-0 w-full flex-1 flex-col">
      <div className="ds-messages-page__frame flex w-full min-h-0 flex-1 flex-col lg:h-[min(100%,calc(100dvh-9rem))] lg:max-h-[calc(100dvh-9rem)]">
        <div className="ds-messages-shell min-h-0 flex-1 flex-col lg:h-full lg:min-h-0 lg:flex-row lg:items-stretch">
          <div
            className={cn(
              "ds-messages-sidebar shrink-0 lg:min-h-0",
              !showList && "hidden",
              "lg:flex"
            )}
          >
            <div className="ds-messages-search-wrap border-b border-[#e8e8e8] p-4">
              <div className="ds-messages-search-glass flex items-center gap-2 rounded-2xl bg-[#f5f5f5] px-4 py-3 dark:bg-transparent">
                <Search size={15} className="shrink-0 text-[#aaa] dark:text-ds-text-placeholder" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск..."
                  aria-label="Поиск диалогов"
                  disabled={empty}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ds-ink outline-none placeholder:text-[#aaa] disabled:opacity-50 dark:placeholder:text-ds-text-placeholder"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {empty ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f0f0] dark:bg-white/10">
                    <Mail className="h-7 w-7 text-ds-text-tertiary" aria-hidden />
                  </div>
                  <p className="text-[15px] font-semibold text-ds-ink">Пока нет диалогов</p>
                  <p className="max-w-[240px] text-[13px] leading-snug text-ds-text-secondary">
                    Когда подключим сервер, здесь появятся переписки с учениками и коллегами.
                  </p>
                </div>
              ) : (
                filteredConvos.map((conv) => {
                  const selected = conv.id === activeId
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => handleSwitch(conv.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 border-b border-[#f0f0f0] p-4 text-left transition-colors dark:border-[#333333]",
                        selected ? "bg-[#f5f5f5] dark:bg-[#262626]" : "hover:bg-[#fafafa] dark:hover:bg-[#2a2a2a]"
                      )}
                    >
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ds-sidebar">
                        {conv.avatar ? (
                          <Image src={conv.avatar} alt={conv.name} fill className="object-cover" sizes="44px" />
                        ) : (
                          <span className="text-[16px] font-bold text-ds-text-tertiary">{conv.name[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14px] font-medium text-ds-ink">{conv.name}</span>
                          <span className="shrink-0 text-[11px] text-ds-text-placeholder">{conv.time}</span>
                        </div>
                        <p className="truncate text-[12px] text-ds-text-tertiary">{conv.lastMessage}</p>
                      </div>
                      {conv.unread > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ds-ink px-1 text-[10px] font-bold text-white dark:bg-white dark:text-[#1a1a1a]">
                          {conv.unread}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div
            className={cn(
              "ds-messages-chat-panel min-h-0 min-w-0 flex-1 flex-col",
              "lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)_auto]",
              !showChat && "hidden"
            )}
          >
            {!active ? (
              <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-3 p-8 text-center lg:row-span-3">
                <Mail className="h-10 w-10 text-ds-text-tertiary" aria-hidden />
                <p className="text-[15px] font-medium text-ds-ink">
                  {empty ? "Сообщения" : "Выберите диалог"}
                </p>
                <p className="max-w-sm text-[14px] text-ds-text-secondary">
                  {empty
                    ? "Тот же экран, что у ученика: список диалогов и переписка. После запуска бэкенда здесь появятся чаты."
                    : "Откройте диалог в списке слева."}
                </p>
              </div>
            ) : (
              <>
                <header className="flex shrink-0 items-start gap-2 border-b border-[#e8e8e8] p-3 sm:items-center sm:gap-3 sm:p-4 md:p-5 dark:border-[#333333] lg:row-start-1">
                  {!wide ? (
                    <button
                      type="button"
                      className="mt-0.5 grid h-10 w-10 shrink-0 place-content-center rounded-full border border-black/10 bg-ds-surface text-ds-ink sm:mt-0 dark:border-white/15"
                      onClick={() => setMobilePanel("list")}
                      aria-label="Назад к списку"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  ) : null}
                  <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ds-sidebar sm:mt-0">
                    {active.avatar ? (
                      <Image src={active.avatar} alt={active.name} fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[14px] font-bold text-ds-text-tertiary">
                        {active.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-[15px] font-semibold leading-snug text-ds-ink sm:text-[16px]">{active.name}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-ds-text-tertiary sm:text-[13px]">{active.role}</p>
                  </div>
                  {mentorSlugs.includes(active.id) ? (
                    <Link
                      href={profileHref(active.id)}
                      className="ml-auto hidden shrink-0 rounded-[var(--ds-radius-md)] bg-white px-3 py-1.5 text-[13px] font-medium text-ds-ink no-underline shadow-none transition-colors hover:bg-ds-surface-hover sm:inline dark:bg-ds-surface dark:hover:bg-white/5"
                    >
                      Профиль
                    </Link>
                  ) : null}
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-5 lg:row-start-2 lg:min-h-0">
                  {messages.map((msg, i) => (
                    <div
                      key={`${msg.time}-${i}`}
                      className={cn("flex w-full", msg.from === "me" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[min(92vw,24rem)] rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.5] sm:max-w-[70%]",
                          msg.from === "me" ? "ds-msg-bubble-me" : "ds-msg-bubble-them"
                        )}
                      >
                        <p>{msg.text}</p>
                        <p
                          className={cn(
                            "mt-1 text-right text-[11px] opacity-50",
                            msg.from === "me" ? "text-inherit" : ""
                          )}
                        >
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-3 border-t border-[#e8e8e8] bg-ds-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-[#333333] lg:row-start-3">
                  <input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Напишите сообщение..."
                    className="min-h-[44px] flex-1 rounded-2xl border-0 bg-[#f5f5f5] px-4 py-2.5 text-[14px] text-ds-ink outline-none placeholder:text-[#aaa] focus-visible:ring-2 focus-visible:ring-ds-ink/20 dark:bg-white/5 dark:placeholder:text-ds-text-placeholder"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    className="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-[#1a1a1a] text-white transition-colors hover:bg-[#333] dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-neutral-200"
                    aria-label="Отправить"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
