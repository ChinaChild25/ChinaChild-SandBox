"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Send, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { mentorsBySlug, mentorSlugs } from "@/lib/mentors"

type ChatMessage = { from: "me" | "them"; text: string; time: string }

type Conversation = {
  id: string
  name: string
  role: string
  avatar: string | null
  lastMessage: string
  time: string
  unread: number
  seed: ChatMessage[]
}

const GROUP_ID = "group-hsk1"

function buildConversations(): Conversation[] {
  const curator = mentorsBySlug["eo-mi-ran"]
  const teacher = mentorsBySlug["kim-ji-hun"]
  return [
    {
      id: curator.slug,
      name: curator.name,
      role: curator.role,
      avatar: curator.photo,
      lastMessage: "Не забудьте подготовить текст к завтрашнему уроку",
      time: "14:23",
      unread: 2,
      seed: [
        { from: "them", text: "Добрый день! Как ваши успехи в изучении китайского?", time: "12:00" },
        { from: "me", text: "Всё хорошо, работаю над тонами", time: "12:15" },
        { from: "them", text: "Отлично! Практикуйте каждый день — это ключ к успеху", time: "12:20" },
        { from: "them", text: "Не забудьте подготовить текст к завтрашнему уроку", time: "14:23" }
      ]
    },
    {
      id: teacher.slug,
      name: teacher.name,
      role: teacher.role,
      avatar: teacher.photo,
      lastMessage: "Домашнее задание принято, молодец!",
      time: "Вчера",
      unread: 0,
      seed: [
        { from: "me", text: "Здравствуйте! Я отправила домашнее задание по теме №7", time: "18:00" },
        { from: "them", text: "Получил, посмотрю сегодня вечером", time: "18:30" },
        { from: "them", text: "Домашнее задание принято, молодец!", time: "21:15" }
      ]
    },
    {
      id: GROUP_ID,
      name: "Группа HSK1",
      role: "Групповой чат",
      avatar: null,
      lastMessage: "Лю Фан: Кто-нибудь ещё идёт на экскурсию?",
      time: "10:05",
      unread: 5,
      seed: [
        { from: "them", text: "Всем привет! Не забудьте про встречу в пятницу", time: "9:00" },
        { from: "me", text: "Буду!", time: "9:05" },
        { from: "them", text: "Лю Фан: Кто-нибудь ещё идёт на экскурсию?", time: "10:05" }
      ]
    }
  ]
}

const CONVERSATIONS = buildConversations()

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
    <div className="ds-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4 md:gap-5">
        <section className="ek-surface bg-ds-panel-muted px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ds-text-tertiary">
            Коммуникация
          </p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.35rem)] font-semibold leading-none tracking-[-0.04em] text-ds-ink">
            Сообщения
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-snug text-[var(--ds-text-secondary)]">
            Чат с куратором, преподавателем и группой — как в обновлённом макете кабинета.
          </p>
        </section>

        <div className="ds-messages-shell min-h-[min(72dvh,760px)] flex-col shadow-sm lg:flex-row">
          <div
            className={cn(
              "ds-messages-sidebar max-h-[min(52dvh,420px)] lg:max-h-none",
              !showList && "hidden",
              "lg:flex"
            )}
          >
            <div className="border-b border-black/8 p-3 dark:border-white/10 sm:p-4">
              <div className="ds-messages-search">
                <Search size={15} className="shrink-0 text-ds-text-placeholder" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск..."
                  aria-label="Поиск диалогов"
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
                      "flex w-full items-center gap-3 border-b border-black/6 p-3 text-left transition-colors dark:border-white/8 sm:p-4",
                      selected ? "bg-ds-surface-pill" : "hover:bg-ds-surface-hover/80"
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
              "flex min-h-0 min-w-0 flex-1 flex-col",
              !showChat && "hidden",
              "lg:flex"
            )}
          >
            <header className="flex items-center gap-3 border-b border-black/8 px-3 py-3 dark:border-white/10 sm:px-5 sm:py-4">
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
                  className="ml-auto hidden shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-ds-ink no-underline transition-colors hover:bg-ds-surface-hover sm:inline dark:border-white/12"
                >
                  Профиль
                </Link>
              ) : null}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:p-5">
              {messages.map((msg, i) => (
                <div key={`${msg.time}-${i}`} className={cn("flex", msg.from === "me" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[min(100%,520px)] rounded-2xl px-4 py-2.5 text-[14px] leading-[1.5]",
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

            <div className="flex items-center gap-2 border-t border-black/8 p-3 dark:border-white/10 sm:gap-3 sm:p-4">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Напишите сообщение..."
                className="min-h-[44px] flex-1 rounded-2xl border border-transparent bg-ds-surface-pill px-4 py-2.5 text-[14px] text-ds-ink outline-none placeholder:text-ds-text-placeholder focus-visible:ring-2 focus-visible:ring-ds-ink/20"
              />
              <button
                type="button"
                onClick={handleSend}
                className="grid h-11 w-11 shrink-0 place-content-center rounded-full bg-ds-ink text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-ds-ink"
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
        <div className="ds-page">
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
