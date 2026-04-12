"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Send, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ChatMessage, MESSAGES_CONVERSATIONS } from "@/lib/messages-conversations"
import { mentorSlugs } from "@/lib/mentors"

const CONVERSATIONS = MESSAGES_CONVERSATIONS

const CHAT_BREAKPOINT = 1024

function MessagesPageInner() {
  const searchParams = useSearchParams()
  const mentorParam = searchParams.get("mentor")

  const [wide, setWide] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list")
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id)
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>(() =>
    Object.fromEntries(CONVERSATIONS.map((c) => [c.id, c.seed]))
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
    if (!mentorParam) return
    const hit = CONVERSATIONS.find((c) => c.id === mentorParam)
    if (hit) {
      setActiveId(hit.id)
      setMobilePanel("chat")
    }
  }, [mentorParam])

  const active = useMemo(
    () => CONVERSATIONS.find((c) => c.id === activeId) ?? CONVERSATIONS[0],
    [activeId]
  )

  const messages = threads[active.id] ?? active.seed

  const filteredConvos = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CONVERSATIONS
    return CONVERSATIONS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
    )
  }, [query])

  const handleSwitch = useCallback((id: string) => {
    setActiveId(id)
    if (!wide) setMobilePanel("chat")
  }, [wide])

  const handleSend = useCallback(() => {
    const t = inputText.trim()
    if (!t) return
    setThreads((prev) => ({
      ...prev,
      [active.id]: [...(prev[active.id] ?? active.seed), { from: "me", text: t, time: "Сейчас" }]
    }))
    setInputText("")
  }, [active.id, active.seed, inputText])

  const showList = wide || mobilePanel === "list"
  const showChat = wide || mobilePanel === "chat"

  return (
    <div className="ds-figma-page">
      <div className="mx-auto flex min-h-[min(720px,calc(100dvh-9rem))] w-full max-w-[var(--ds-shell-max-width)] flex-col">
        <div className="ds-messages-shell min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={cn(
              "ds-messages-sidebar max-h-[min(40dvh,340px)] shrink-0 lg:max-h-none",
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
                  className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ds-ink outline-none placeholder:text-[#aaa] dark:placeholder:text-ds-text-placeholder"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredConvos.map((conv) => {
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
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ds-ink px-1 text-[10px] font-bold text-white dark:bg-white dark:text-ds-ink">
                        {conv.unread}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-[min(58dvh,520px)] min-w-0 flex-1 flex-col lg:min-h-0",
              !showChat && "hidden",
              "lg:flex"
            )}
          >
            <header className="flex items-center gap-3 border-b border-[#e8e8e8] p-4 md:p-5 dark:border-[#333333]">
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
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ds-sidebar">
                {active.avatar ? (
                  <Image src={active.avatar} alt={active.name} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[14px] font-bold text-ds-text-tertiary">
                    {active.name[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-ds-ink">{active.name}</p>
                <p className="truncate text-[13px] text-ds-text-tertiary">{active.role}</p>
              </div>
              {mentorSlugs.includes(active.id) ? (
                <Link
                  href={`/mentors/${active.id}`}
                  className="ml-auto hidden shrink-0 rounded-[var(--ds-radius-md)] bg-white px-3 py-1.5 text-[13px] font-medium text-ds-ink no-underline shadow-none transition-colors hover:bg-ds-surface-hover sm:inline dark:bg-ds-surface dark:hover:bg-white/5"
                >
                  Профиль
                </Link>
              ) : null}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 md:p-5">
              {messages.map((msg, i) => (
                <div key={`${msg.time}-${i}`} className={cn("flex", msg.from === "me" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-[14px] leading-[1.5]",
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

            <div className="flex items-center gap-3 border-t border-[#e8e8e8] p-4 dark:border-[#333333]">
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
                className="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-[#1a1a1a] text-white transition-colors hover:bg-[#333] dark:bg-white dark:text-ds-ink dark:hover:bg-neutral-200"
                aria-label="Отправить"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-figma-page">
          <div className="mx-auto max-w-[var(--ds-shell-max-width)] px-4 py-10 text-ds-text-tertiary">
            Загрузка…
          </div>
        </div>
      }
    >
      <MessagesPageInner />
    </Suspense>
  )
}
