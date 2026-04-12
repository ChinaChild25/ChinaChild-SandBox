"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowLeft, Mail, Send, Search } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Textarea } from "@/components/ui/textarea"
import {
  formatListPeerRole,
  loadMessagesForConversation,
  loadMyConversationList,
  sendChatMessage,
  sortConversationListItems,
  formatChatTimeLabel,
  type ChatBubble,
  type ConversationListItem
} from "@/lib/supabase/chat"
import { cn } from "@/lib/utils"

const CHAT_BREAKPOINT = 1024

const DEFAULT_LIST_EMPTY = {
  title: "У вас пока нет диалогов",
  subtitle: "Когда преподаватель начнёт с вами переписку, диалог появится здесь."
}

const DEFAULT_NO_SELECTION = {
  title: "Выберите диалог",
  subtitle: "Откройте беседу в списке слева."
}

/** Строка до прихода беседы из `loadMyConversationList` (без «Загрузка…» в шапке). */
function pendingListItem(conversationId: string): ConversationListItem {
  return {
    id: conversationId,
    peer: {
      id: conversationId,
      name: "Новый чат",
      avatarUrl: null,
      role: ""
    },
    lastMessage: "",
    lastMessageAt: null,
    conversationCreatedAt: new Date().toISOString()
  }
}

export type ChatCopyBlock = { title: string; subtitle: string }

export type SupabaseMessagesProps = {
  /** Query `?conversation=<uuid>` для открытия диалога после загрузки списка. */
  initialConversationId?: string | null
  /** Кнопки справа от поиска (например «Новый диалог» у преподавателя). */
  listToolbarEnd?: ReactNode
  /** Текст пустого списка диалогов (сайдбар и панель при отсутствии выбранного чата). */
  listEmptyCopy?: ChatCopyBlock
  /** Панель справа, когда диалоги есть, но ни один не выбран. */
  noSelectionCopy?: ChatCopyBlock
}

export function SupabaseMessages({
  initialConversationId,
  listToolbarEnd,
  listEmptyCopy,
  noSelectionCopy
}: SupabaseMessagesProps) {
  const { user } = useAuth()
  const myId = user?.id ?? null

  const urlConversationId = (initialConversationId ?? "").trim() || null

  const [wide, setWide] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list")
  const [query, setQuery] = useState("")

  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [items, setItems] = useState<ConversationListItem[]>([])

  const [activeId, setActiveId] = useState<string | null>(null)

  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatBubble[]>([])

  const [inputText, setInputText] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)

  const emptyCopy = listEmptyCopy ?? DEFAULT_LIST_EMPTY
  const idleCopy = noSelectionCopy ?? DEFAULT_NO_SELECTION

  const sortedItems = useMemo(() => sortConversationListItems(items), [items])

  const sidebarItems = useMemo(() => {
    if (!urlConversationId) return sortedItems
    const has = sortedItems.some((c) => c.id === urlConversationId)
    if (has) return sortedItems
    return [pendingListItem(urlConversationId), ...sortedItems]
  }, [sortedItems, urlConversationId])

  const active = useMemo(
    () => sidebarItems.find((c) => c.id === activeId) ?? null,
    [sidebarItems, activeId]
  )

  const refreshList = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    const supabase = createBrowserSupabaseClient()
    const { items: next, error } = await loadMyConversationList(supabase)
    if (error) {
      setListError(error.message)
      setItems([])
    } else {
      setItems(next)
    }
    setListLoading(false)
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList, urlConversationId])

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${CHAT_BREAKPOINT}px)`)
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  /** Сразу открываем чат из URL, не дожидаясь списка (новая беседа появится после refreshList). */
  useEffect(() => {
    if (!urlConversationId) return
    setActiveId(urlConversationId)
    setMobilePanel("chat")
  }, [urlConversationId])

  useEffect(() => {
    if (!myId || !activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    setMessagesError(null)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { messages: rows, error } = await loadMessagesForConversation(supabase, activeId, myId)
      if (cancelled) return
      if (error) {
        setMessagesError(error.message)
        setMessages([])
      } else {
        setMessages(rows)
      }
      setMessagesLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [myId, activeId])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sidebarItems
    return sidebarItems.filter((c) => {
      const name = c.peer.name.toLowerCase()
      const role = c.peer.role.toLowerCase()
      return (
        name.includes(q) ||
        role.includes(q) ||
        c.peer.id.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
      )
    })
  }, [query, sidebarItems])

  const handleSwitch = useCallback(
    (id: string) => {
      setActiveId(id)
      setSendError(null)
      if (!wide) setMobilePanel("chat")
    },
    [wide]
  )

  const handleSend = useCallback(async () => {
    if (!myId || !activeId || !active) return
    const t = inputText.trim()
    if (!t) return
    setSendError(null)
    const supabase = createBrowserSupabaseClient()
    const { message, error } = await sendChatMessage(supabase, activeId, myId, t)
    if (error) {
      setSendError(error.message)
      return
    }
    if (message) {
      setMessages((prev) => [...prev, message])
      setItems((prev) => {
        const idx = prev.findIndex((row) => row.id === activeId)
        if (idx === -1) {
          const peer = active?.peer ?? {
            id: "",
            name: "Собеседник",
            avatarUrl: null,
            role: ""
          }
          const row: ConversationListItem = {
            id: activeId,
            peer,
            lastMessage: message.text,
            lastMessageAt: message.createdAt,
            conversationCreatedAt: new Date().toISOString()
          }
          return sortConversationListItems([row, ...prev])
        }
        const next = prev.map((row) =>
          row.id === activeId
            ? {
                ...row,
                lastMessage: message.text,
                lastMessageAt: message.createdAt
              }
            : row
        )
        return sortConversationListItems(next)
      })
    }
    setInputText("")
  }, [myId, activeId, active, inputText])

  const showList = wide || mobilePanel === "list"
  const showChat = wide || mobilePanel === "chat"
  const empty = !listLoading && !listError && sidebarItems.length === 0

  const peerInitial = active ? (active.peer.name.trim()[0] ?? "?") : "?"
  const activeRoleLine = active ? formatListPeerRole(active.peer.role) : ""
  const canSend =
    !!inputText.trim() && !messagesLoading && !messagesError && !!myId && !!activeId && !!active

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
            <div className="ds-messages-search-wrap border-b border-[#e8e8e8] p-3 sm:p-4 dark:border-[#333333]">
              <div className="flex items-center gap-2">
                <div className="ds-messages-search-glass flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[#f5f5f5] px-3.5 py-2.5 dark:bg-white/[0.06]">
                  <Search size={16} className="shrink-0 text-ds-text-placeholder" aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск"
                    aria-label="Поиск диалогов"
                    disabled={empty || !!listError}
                    className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ds-ink outline-none placeholder:text-ds-text-placeholder disabled:opacity-50"
                  />
                </div>
                {listToolbarEnd ? <div className="shrink-0">{listToolbarEnd}</div> : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {listLoading ? (
                <div className="px-6 py-12 text-center text-[14px] text-ds-text-secondary">Загрузка диалогов…</div>
              ) : listError ? (
                <div className="flex flex-col gap-2 px-6 py-12 text-center">
                  <p className="text-[15px] font-semibold text-destructive">Не удалось загрузить чаты</p>
                  <p className="text-[13px] text-ds-text-secondary">{listError}</p>
                  <button
                    type="button"
                    className="mx-auto mt-2 rounded-[var(--ds-radius-md)] bg-ds-ink px-4 py-2 text-[13px] font-medium text-white dark:bg-white dark:text-[#1a1a1a]"
                    onClick={() => void refreshList()}
                  >
                    Повторить
                  </button>
                </div>
              ) : empty ? (
                <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10">
                    <Mail className="h-6 w-6 text-ds-text-tertiary" aria-hidden />
                  </div>
                  <p className="text-[16px] font-semibold tracking-tight text-ds-ink">{emptyCopy.title}</p>
                  <p className="max-w-[260px] text-[13px] leading-relaxed text-ds-text-secondary">
                    {emptyCopy.subtitle}
                  </p>
                </div>
              ) : (
                filteredItems.map((row) => {
                  const selected = row.id === activeId
                  const { peer } = row
                  const timeLabel = row.lastMessageAt ? formatChatTimeLabel(row.lastMessageAt) : ""
                  const initial = peer.name.trim()[0] ?? "?"
                  const preview = row.lastMessage.trim() || "Нет сообщений"
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => handleSwitch(row.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 border-b border-[#f0f0f0] py-3 pl-[calc(1rem-3px)] pr-4 text-left transition-[background-color,border-color] duration-150 dark:border-[#333333]",
                        selected
                          ? "border-l-[3px] border-l-ds-ink bg-black/[0.07] dark:border-l-neutral-200 dark:bg-white/[0.08]"
                          : "border-l-[3px] border-l-transparent hover:bg-black/[0.05] active:bg-black/[0.07] dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]"
                      )}
                    >
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                        {peer.avatarUrl ? (
                          <Image
                            src={peer.avatarUrl}
                            alt={peer.name}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <span className="text-[15px] font-semibold text-ds-text-secondary">{initial}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-[15px] font-semibold leading-tight text-ds-ink">
                            {peer.name}
                          </span>
                          {timeLabel ? (
                            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-ds-text-placeholder">
                              {timeLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[13px] leading-snug text-ds-text-secondary">
                          {preview}
                        </p>
                      </div>
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
              <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center lg:row-span-3">
                <Mail className="h-9 w-9 text-ds-text-tertiary" aria-hidden />
                <p className="text-[16px] font-semibold text-ds-ink">
                  {empty ? emptyCopy.title : idleCopy.title}
                </p>
                <p className="max-w-sm text-[13px] leading-relaxed text-ds-text-secondary">
                  {empty ? emptyCopy.subtitle : idleCopy.subtitle}
                </p>
              </div>
            ) : (
              <>
                <header className="flex shrink-0 items-center gap-3 border-b border-[#e8e8e8] px-3 py-3 sm:px-5 sm:py-4 dark:border-[#333333] lg:row-start-1">
                  {!wide ? (
                    <button
                      type="button"
                      className="grid h-10 w-10 shrink-0 place-content-center rounded-full border border-black/10 bg-ds-surface text-ds-ink dark:border-white/15"
                      onClick={() => setMobilePanel("list")}
                      aria-label="Назад к списку"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  ) : null}
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                    {active.peer.avatarUrl ? (
                      <Image
                        src={active.peer.avatarUrl}
                        alt={active.peer.name}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-ds-text-secondary">
                        {peerInitial}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold leading-tight text-ds-ink">{active.peer.name}</p>
                    {activeRoleLine ? (
                      <p className="mt-0.5 truncate text-[13px] text-ds-text-secondary">{activeRoleLine}</p>
                    ) : null}
                  </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-5 lg:row-start-2 lg:min-h-0">
                  {messagesLoading ? (
                    <div className="flex flex-1 items-center justify-center text-[14px] text-ds-text-secondary">
                      Загрузка сообщений…
                    </div>
                  ) : messagesError ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                      <p className="text-[14px] font-medium text-destructive">Не удалось загрузить сообщения</p>
                      <p className="text-[13px] text-ds-text-secondary">{messagesError}</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
                      <p className="text-[17px] font-semibold tracking-tight text-ds-ink">Начните диалог</p>
                      <p className="max-w-[240px] text-[14px] leading-relaxed text-ds-text-secondary">
                        Напишите первое сообщение
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
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
                            {msg.timeLabel}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 border-t border-[#e8e8e8] bg-ds-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-[#333333] lg:row-start-3">
                  {sendError ? (
                    <p className="text-center text-[12px] text-destructive">{sendError}</p>
                  ) : null}
                  <div className="flex items-end gap-2 sm:gap-3">
                    <Textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          void handleSend()
                        }
                      }}
                      placeholder="Сообщение…"
                      rows={1}
                      disabled={messagesLoading || !!messagesError}
                      className="min-h-[44px] max-h-[9rem] flex-1 resize-none rounded-2xl border-0 bg-[#f5f5f5] px-4 py-3 text-[14px] leading-snug text-ds-ink shadow-none outline-none ring-0 placeholder:text-ds-text-placeholder focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-ds-ink/15 disabled:opacity-50 dark:bg-white/[0.06]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!canSend}
                      className="mb-0.5 grid h-11 w-11 shrink-0 place-content-center rounded-full bg-[#1a1a1a] text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-35 dark:bg-white dark:text-[#1a1a1a]"
                      aria-label="Отправить"
                    >
                      <Send size={18} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
