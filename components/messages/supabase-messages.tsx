"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowLeft, Check, Mail, Mic, Paperclip, Pencil, Send, Search, Smile, X } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Textarea } from "@/components/ui/textarea"
import {
  addParticipantsToConversation,
  chatBubbleFromMessageRow,
  chatPeerProfileHref,
  formatListPeerRole,
  loadConversationParticipants,
  loadConversationPeerProfile,
  loadMessagesForConversation,
  loadReadReceiptMessageIds,
  loadMyConversationList,
  moveStudentToAnotherConversation,
  markConversationRead,
  peerAvatarUrlForUi,
  removeParticipantFromConversation,
  renameConversation,
  editChatMessage,
  deleteChatMessage,
  sendChatMessage,
  sortConversationListItems,
  formatChatTimeLabel,
  type ChatBubble,
  type ConversationParticipantProfile,
  type ConversationListItem,
  type ConversationListPeer
} from "@/lib/supabase/chat"
import { uploadChatMedia, MEDIA_LIMITS } from "@/lib/supabase/chat-media"
import { subscribeToMessageReads, subscribeToMessages, subscribeToPresence, subscribeToTyping } from "@/lib/supabase/chat-realtime"
import { getChatCapabilities, type ChatCapabilities } from "@/lib/supabase/chat-capabilities"
import { isOnline, startPresenceHeartbeat, stopPresenceHeartbeat } from "@/lib/supabase/presence"
import { createTypingManager } from "@/lib/supabase/typing"
import { cn } from "@/lib/utils"

const CHAT_BREAKPOINT = 1024
const QUICK_EMOJIS = ["😀", "😁", "😂", "😊", "😍", "🙏", "👏", "👍", "🔥", "🎉", "❤️", "🤝", "🤔", "😢", "😎", "🤗"]

function preferredVoiceMimeTypes(): string[] {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua)
    if (isAppleMobile) {
      return ["audio/mp4", "audio/x-m4a", "audio/mpeg", "audio/webm;codecs=opus", "audio/webm"]
    }
  }
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/x-m4a", "audio/webm"]
}

function normalizeMimeType(type: string): string {
  return type.split(";")[0]?.trim().toLowerCase() ?? ""
}

function formatRecordingDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function readAudioDurationSec(audio: HTMLAudioElement): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
  if (audio.seekable && audio.seekable.length > 0) {
    const end = audio.seekable.end(audio.seekable.length - 1)
    if (Number.isFinite(end) && end > 0) return end
  }
  return 0
}

const ICON_ACTION_NONSELECT_STYLE: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation"
}

const decodedVoiceDurationCache = new Map<string, number>()
const decodedVoiceDurationInFlight = new Map<string, Promise<number>>()

async function decodeAudioDurationFromSrc(src: string): Promise<number> {
  const cached = decodedVoiceDurationCache.get(src)
  if (typeof cached === "number" && cached > 0) return cached
  const running = decodedVoiceDurationInFlight.get(src)
  if (running) return running

  const task = (async () => {
    if (typeof window === "undefined") return 0
    const response = await fetch(src, { cache: "force-cache" })
    if (!response.ok) return 0
    const data = await response.arrayBuffer()
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return 0
    const ctx = new AudioCtx()
    try {
      const decoded = await ctx.decodeAudioData(data.slice(0))
      const duration = Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : 0
      if (duration > 0) decodedVoiceDurationCache.set(src, duration)
      return duration
    } finally {
      void ctx.close()
    }
  })()

  decodedVoiceDurationInFlight.set(src, task)
  try {
    return await task
  } finally {
    decodedVoiceDurationInFlight.delete(src)
  }
}

function extractChatMediaObjectPath(urlValue: string): string | null {
  try {
    const u = new URL(urlValue)
    const signedMarker = "/storage/v1/object/sign/chat-media/"
    const publicMarker = "/storage/v1/object/public/chat-media/"
    const signedIdx = u.pathname.indexOf(signedMarker)
    if (signedIdx >= 0) {
      return decodeURIComponent(u.pathname.slice(signedIdx + signedMarker.length))
    }
    const publicIdx = u.pathname.indexOf(publicMarker)
    if (publicIdx >= 0) {
      return decodeURIComponent(u.pathname.slice(publicIdx + publicMarker.length))
    }
    return null
  } catch {
    return null
  }
}

function isSignedChatMediaUrl(urlValue: string): boolean {
  try {
    const u = new URL(urlValue)
    return u.pathname.includes("/storage/v1/object/sign/chat-media/")
  } catch {
    return urlValue.includes("/storage/v1/object/sign/chat-media/")
  }
}

async function refreshChatMediaSignedUrl(urlValue: string): Promise<string | null> {
  const objectPath = extractChatMediaObjectPath(urlValue)
  if (!objectPath) return null
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(objectPath, 60 * 60 * 24 * 30)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

function createDeterministicWave(id: string, bars = 40): number[] {
  let seed = 0
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) >>> 0
  }
  const result: number[] = []
  for (let i = 0; i < bars; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const v = ((seed >>> 8) % 1000) / 1000
    result.push(0.2 + v * 0.8)
  }
  return result
}

type AccentKey = "sage" | "pink" | "blue" | "orange"

function accentPalette(accent: AccentKey) {
  if (accent === "pink") {
    return {
      buttonBg: "#9b4f62",
      buttonFg: "#fdeef1",
      played: "#8f4257",
      unplayed: "#c98ea0",
      text: "#7d394b"
    }
  }
  if (accent === "blue") {
    return {
      buttonBg: "#396ea8",
      buttonFg: "#edf5ff",
      played: "#2f5e93",
      unplayed: "#8cb1db",
      text: "#2b527d"
    }
  }
  if (accent === "orange") {
    return {
      buttonBg: "#b7702f",
      buttonFg: "#fff5ea",
      played: "#9a5e28",
      unplayed: "#dbb086",
      text: "#844f21"
    }
  }
  return {
    buttonBg: "#55762f",
    buttonFg: "#eff7dc",
    played: "#4a6829",
    unplayed: "#9cba73",
    text: "#3f5823"
  }
}

function accentBubbleCssVars(accent: AccentKey): Record<string, string> {
  if (accent === "pink") {
    return { "--voice-bubble-bg": "#f4d6df", "--voice-bubble-fg": "#7d394b" }
  }
  if (accent === "blue") {
    return { "--voice-bubble-bg": "#d8e8f8", "--voice-bubble-fg": "#2b527d" }
  }
  if (accent === "orange") {
    return { "--voice-bubble-bg": "#fce8d1", "--voice-bubble-fg": "#844f21" }
  }
  return { "--voice-bubble-bg": "#d4e7b0", "--voice-bubble-fg": "#3f5823" }
}

function waitForAudioReady(audio: HTMLAudioElement, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      cleanup()
      resolve()
    }
    const onReady = () => finish()
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onReady)
      audio.removeEventListener("loadeddata", onReady)
      audio.removeEventListener("canplay", onReady)
      window.clearTimeout(timer)
    }
    const timer = window.setTimeout(finish, timeoutMs)
    audio.addEventListener("loadedmetadata", onReady)
    audio.addEventListener("loadeddata", onReady)
    audio.addEventListener("canplay", onReady)
  })
}

function MediaImageAttachment({ src, alt }: { src: string; alt: string }) {
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [refreshTried, setRefreshTried] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setResolvedSrc(src)
    setRefreshTried(false)
    setFailed(false)
  }, [src])

  useEffect(() => {
    if (!isSignedChatMediaUrl(src)) return
    let cancelled = false
    void refreshChatMediaSignedUrl(src)
      .then((fresh) => {
        if (cancelled || !fresh || fresh === src) return
        setResolvedSrc(fresh)
      })
      .catch(() => {
        // Best-effort refresh only.
      })
    return () => {
      cancelled = true
    }
  }, [src])

  const handleError = () => {
    if (refreshTried) {
      setFailed(true)
      return
    }
    setRefreshTried(true)
    void refreshChatMediaSignedUrl(resolvedSrc)
      .then((fresh) => {
        if (!fresh || fresh === resolvedSrc) {
          setFailed(true)
          return
        }
        setResolvedSrc(fresh)
      })
      .catch(() => {
        setFailed(true)
      })
  }

  if (failed) {
    return <p className="mt-1 text-[12px] opacity-80">Не удалось загрузить вложение</p>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      className="mt-1 max-h-64 w-auto rounded-lg object-contain"
      onError={handleError}
    />
  )
}

function VoiceMessageBubble({
  messageId,
  src,
  tone,
  accent = "sage",
  initialDurationSec = null
}: {
  messageId: string
  src: string
  tone: "accent" | "dark" | "light"
  accent?: AccentKey
  initialDurationSec?: number | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const durationRef = useRef(initialDurationSec && initialDurationSec > 0 ? initialDurationSec : 0)
  const isPlayAttemptRef = useRef(false)
  const isRetryingSrcRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [duration, setDuration] = useState(durationRef.current)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackCompleted, setPlaybackCompleted] = useState(false)
  const [playError, setPlayError] = useState<string | null>(null)
  const wave = useMemo(() => createDeterministicWave(messageId), [messageId])
  const palette = useMemo(() => accentPalette(accent), [accent])

  useEffect(() => {
    setResolvedSrc(src)
    setPlayError(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setPlaybackCompleted(false)
    durationRef.current = initialDurationSec && initialDurationSec > 0 ? initialDurationSec : 0
    setDuration(durationRef.current)
  }, [src, initialDurationSec])

  useEffect(() => {
    if (!isSignedChatMediaUrl(src)) return
    let cancelled = false
    void refreshChatMediaSignedUrl(src)
      .then((fresh) => {
        if (cancelled || !fresh || fresh === src) return
        setResolvedSrc(fresh)
      })
      .catch(() => {
        // Keep original src; click retry flow still handles refresh on demand.
      })
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const syncDuration = () => {
      if (initialDurationSec && initialDurationSec > 0) {
        if (durationRef.current !== initialDurationSec) {
          durationRef.current = initialDurationSec
          setDuration(initialDurationSec)
        }
        return
      }
      const nextDuration = readAudioDurationSec(audio)
      if (nextDuration > 0) {
        durationRef.current = nextDuration
        setDuration(nextDuration)
      }
    }
    const onLoaded = () => syncDuration()
    const onTime = () => {
      syncDuration()
      setCurrentTime(audio.currentTime)
      if (durationRef.current > 0 && audio.currentTime >= durationRef.current - 0.08) {
        setPlaybackCompleted(true)
      }
    }
    const onCanPlay = () => syncDuration()
    const onDurationChange = () => syncDuration()
    const onEnded = () => {
      setIsPlaying(false)
      setPlaybackCompleted(true)
      const finalDuration = readAudioDurationSec(audio) || durationRef.current
      setCurrentTime((prev) => (finalDuration > 0 ? finalDuration : prev))
    }
    const onError = () => {
      setIsPlaying(false)
      if (isPlayAttemptRef.current && !isRetryingSrcRef.current) {
        setPlayError("Аудио недоступно")
      }
    }
    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("loadeddata", onLoaded)
    audio.addEventListener("progress", onLoaded)
    audio.addEventListener("suspend", onLoaded)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("canplay", onCanPlay)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("error", onError)
    // 1) Сначала подписываемся, 2) потом инициируем загрузку.
    // И сразу пробуем синхронизировать, если метаданные уже доступны.
    syncDuration()
    audio.load()
    queueMicrotask(syncDuration)
    const lateSyncTimer = window.setTimeout(syncDuration, 120)
    return () => {
      window.clearTimeout(lateSyncTimer)
      audio.pause()
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("loadeddata", onLoaded)
      audio.removeEventListener("progress", onLoaded)
      audio.removeEventListener("suspend", onLoaded)
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("canplay", onCanPlay)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("error", onError)
    }
  }, [resolvedSrc, initialDurationSec])

  useEffect(() => {
    if (durationRef.current > 0 || (initialDurationSec ?? 0) > 0) return
    let cancelled = false
    void decodeAudioDurationFromSrc(resolvedSrc)
      .then((decodedDuration) => {
        if (cancelled || decodedDuration <= 0) return
        durationRef.current = decodedDuration
        setDuration(decodedDuration)
      })
      .catch(() => {
        // Silent fallback: UI stays interactive, metadata may still arrive later.
      })
    return () => {
      cancelled = true
    }
  }, [resolvedSrc, initialDurationSec])

  const baseProgress = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const progress = playbackCompleted ? 1 : baseProgress
  const activeBars = Math.round(progress * wave.length)
  const hasPlaybackStarted = currentTime > 0 || playbackCompleted
  const shownDuration =
    duration > 0
      ? playbackCompleted && !isPlaying
        ? duration
        : hasPlaybackStarted
          ? Math.max(0, duration - currentTime)
          : duration
      : null

  return (
    <div
      className={cn(
        "mt-0.5 flex min-w-[13rem] max-w-[18rem] items-center gap-2.5 px-0.5 py-0.5",
        tone === "accent"
          ? "text-[color:color-mix(in_srgb,var(--ds-sage-strong)_60%,var(--ds-ink))]"
          : tone === "dark"
            ? "text-[#1f1f1f]"
            : "text-ds-text-secondary"
      )}
    >
      <audio ref={audioRef} src={resolvedSrc} preload="auto" />
      <button
        type="button"
        className={cn(
          "grid h-9 w-9 shrink-0 place-content-center rounded-full",
          tone === "accent"
            ? ""
            : tone === "dark"
              ? "bg-black/10 text-[#1f1f1f] hover:bg-black/15"
              : "bg-black/80 text-white dark:bg-white dark:text-[#141414]"
        )}
        style={
          tone === "accent"
            ? {
                backgroundColor: palette.buttonBg,
                color: palette.buttonFg
              }
            : undefined
        }
        onClick={() => {
          const audio = audioRef.current
          if (!audio) return
          if (isPlaying) {
            audio.pause()
            setIsPlaying(false)
          } else {
            if (durationRef.current > 0 && audio.currentTime >= durationRef.current - 0.05) {
              audio.currentTime = 0
              setCurrentTime(0)
              setPlaybackCompleted(false)
            }
            setPlaybackCompleted(false)
            setPlayError(null)
            isPlayAttemptRef.current = true
            void (async () => {
              try {
                try {
                  await audio.play()
                  setIsPlaying(true)
                  return
                } catch {
                  // Refresh URL and retry once for expired signed links.
                }

                isRetryingSrcRef.current = true
                const refreshed = await refreshChatMediaSignedUrl(resolvedSrc)
                if (!refreshed) {
                  setIsPlaying(false)
                  setPlayError("Аудио недоступно")
                  return
                }

                setResolvedSrc(refreshed)
                audio.src = refreshed
                audio.load()
                await waitForAudioReady(audio, 600)
                await audio.play()
                setIsPlaying(true)
              } catch {
                setIsPlaying(false)
                setPlayError("Аудио недоступно")
              } finally {
                isRetryingSrcRef.current = false
                isPlayAttemptRef.current = false
              }
            })()
          }
        }}
        aria-label={isPlaying ? "Пауза голосового" : "Воспроизвести голосовое"}
      >
        {isPlaying ? (
          <span className="inline-flex items-center gap-[3px]">
            <span className="h-[13px] w-[4px] rounded-full bg-current" />
            <span className="h-[13px] w-[4px] rounded-full bg-current" />
          </span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-[18px] w-[18px] translate-x-[1px] fill-current"
          >
            <path d="M8 5.5c0-.8.9-1.3 1.6-.9l9.6 6.1c.7.4.7 1.4 0 1.8l-9.6 6.1c-.7.4-1.6-.1-1.6-.9V5.5z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 items-end gap-[2px]">
          {wave.map((v, idx) => (
            <span
              key={`${messageId}-${idx}`}
              className={cn(
                "inline-block w-[3px] rounded-full transition-colors duration-200",
                idx < activeBars
                  ? tone === "accent"
                    ? ""
                    : tone === "dark"
                      ? "bg-black/65"
                      : "bg-black/55 dark:bg-white/90"
                  : tone === "accent"
                    ? ""
                    : tone === "dark"
                      ? "bg-black/28"
                      : "bg-black/28 dark:bg-white/30"
              )}
              style={{
                height: `${Math.max(6, Math.round(v * 26))}px`,
                ...(tone === "accent"
                  ? { backgroundColor: idx < activeBars ? palette.played : palette.unplayed }
                  : {})
              }}
            />
          ))}
        </div>
        <p
          className={cn(
            "mt-0.5 text-[11px] font-semibold",
            tone === "accent"
              ? ""
              : tone === "dark"
                ? "text-black/70"
                : "opacity-90"
          )}
          style={tone === "accent" ? { color: palette.text } : undefined}
        >
          {playError ? playError : shownDuration == null ? "--:--" : formatRecordingDuration(shownDuration)}
        </p>
      </div>
    </div>
  )
}

const DEFAULT_LIST_EMPTY = {
  title: "У вас пока нет диалогов",
  subtitle: "Когда преподаватель начнёт с вами переписку, диалог появится здесь."
}

const DEFAULT_NO_SELECTION = {
  title: "Выберите диалог",
  subtitle: "Выберите существующий чат или начните новый."
}

function peerInitialLetter(name: string): string {
  const t = name.trim()
  if (!t || t === "User") return "U"
  return (t[0] ?? "U").toUpperCase()
}

function PeerAvatarImg({
  peer,
  size,
  isOnline = false
}: {
  peer: ConversationListPeer
  size: "list" | "header"
  isOnline?: boolean
}) {
  const url = peerAvatarUrlForUi(peer)
  const initial = peerInitialLetter(peer.name)
  const box =
    size === "list" ? "h-12 w-12 text-[15px]" : "h-11 w-11 text-[15px]"
  return (
    <div className={cn("relative shrink-0", box)}>
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- внешние Supabase URL; next/image не требуется
          <img src={url} alt={peer.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-semibold text-ds-text-secondary">{initial}</span>
        )}
      </div>
      {isOnline ? (
        <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500 shadow-sm dark:border-[#141414]" />
      ) : null}
    </div>
  )
}

/** Строка до появления беседы в списке: профиль из БД, подсказка из picker или «User». */
function pendingListItem(
  conversationId: string,
  resolved: ConversationListPeer | null,
  hint: { id: string; name: string } | null
): ConversationListItem {
  const peer: ConversationListPeer = (() => {
    if (resolved && resolved.name.trim() && resolved.name !== "User") {
      return resolved
    }
    if (hint) {
      return {
        id: hint.id,
        name: hint.name,
        avatarUrl: resolved?.avatarUrl?.trim() ? resolved.avatarUrl : null,
        role: resolved?.role?.trim() ? resolved.role : "",
        uiAccent: resolved?.uiAccent ?? null
      }
    }
    return (
      resolved ?? {
        id: conversationId,
        name: "User",
        avatarUrl: null,
        role: "",
        uiAccent: null
      }
    )
  })()
  return {
    id: conversationId,
    type: "direct",
    title: peer.name,
    peer,
    lastMessage: "",
    lastMessageAt: null,
    unreadCount: 0,
    conversationCreatedAt: new Date().toISOString()
  }
}

export type ChatCopyBlock = { title: string; subtitle: string }

export type SupabaseMessagesProps = {
  /** Query `?conversation=<uuid>` для открытия диалога после загрузки списка. */
  initialConversationId?: string | null
  /** Имя/id собеседника из URL после «Новый диалог», пока грузится profiles. */
  newChatPeerHint?: { id: string; name: string } | null
  /** Кнопки справа от поиска (например «Новый диалог» у преподавателя). */
  listToolbarEnd?: ReactNode
  /** Текст пустого списка диалогов (сайдбар и панель при отсутствии выбранного чата). */
  listEmptyCopy?: ChatCopyBlock
  /** Панель справа, когда диалоги есть, но ни один не выбран. */
  noSelectionCopy?: ChatCopyBlock
}

export function SupabaseMessages({
  initialConversationId,
  newChatPeerHint = null,
  listToolbarEnd,
  listEmptyCopy,
  noSelectionCopy
}: SupabaseMessagesProps) {
  const { user } = useAuth()
  const myId = user?.id ?? null
  const myRole = user?.role ?? null

  const urlConversationId = (initialConversationId ?? "").trim() || null

  const [wide, setWide] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list")
  const [query, setQuery] = useState("")

  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [items, setItems] = useState<ConversationListItem[]>([])

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesLoadingOlder, setMessagesLoadingOlder] = useState(false)
  const [messagesHasMore, setMessagesHasMore] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatBubble[]>([])
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [readReceiptIds, setReadReceiptIds] = useState<Set<string>>(new Set())
  const [pendingMessageIds, setPendingMessageIds] = useState<Set<string>>(new Set())

  const [inputText, setInputText] = useState("")
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [editing, setEditing] = useState<{ messageId: string; originalText: string } | null>(null)
  const [replying, setReplying] = useState<{ messageId: string; previewText: string; from: "me" | "them" } | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [caps, setCaps] = useState<ChatCapabilities | null>(null)
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, "online" | "offline">>({})
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const [pendingPeerOverride, setPendingPeerOverride] = useState<ConversationListPeer | null>(null)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [participants, setParticipants] = useState<ConversationParticipantProfile[]>([])
  const [msgMenu, setMsgMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null)
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [addParticipantOpen, setAddParticipantOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [addParticipantInput, setAddParticipantInput] = useState("")
  const [renameInput, setRenameInput] = useState("")
  const [moveStudentInput, setMoveStudentInput] = useState("")
  const [moveTargetConversationInput, setMoveTargetConversationInput] = useState("")
  const [groupActionBusy, setGroupActionBusy] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingDurationSec, setRecordingDurationSec] = useState(0)
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([])
  const [voiceDraftFile, setVoiceDraftFile] = useState<File | null>(null)
  const [viewportFrameHeight, setViewportFrameHeight] = useState<number | null>(null)
  const touchStartRef = useRef<{ messageId: string; x: number; y: number } | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const needsInitialScrollToBottomRef = useRef(false)
  const canLoadOlderByScrollRef = useRef(false)
  const keepBottomUntilTsRef = useRef(0)
  const autoScrollingRef = useRef(false)

  const emptyCopy = listEmptyCopy ?? DEFAULT_LIST_EMPTY
  const idleCopy = noSelectionCopy ?? DEFAULT_NO_SELECTION

  const sortedItems = useMemo(() => sortConversationListItems(items), [items])

  const pendingPeerHint = useMemo(() => {
    if (!urlConversationId || !newChatPeerHint) return null
    if (sortedItems.some((c) => c.id === urlConversationId)) return null
    return newChatPeerHint
  }, [urlConversationId, newChatPeerHint, sortedItems])

  const sidebarItems = useMemo(() => {
    if (!urlConversationId) return sortedItems
    const has = sortedItems.some((c) => c.id === urlConversationId)
    if (has) return sortedItems
    return [pendingListItem(urlConversationId, pendingPeerOverride, pendingPeerHint), ...sortedItems]
  }, [sortedItems, urlConversationId, pendingPeerOverride, pendingPeerHint])

  const active = useMemo(
    () => sidebarItems.find((c) => c.id === activeId) ?? null,
    [sidebarItems, activeId]
  )
  const activeTitle = active?.type === "group" ? active.title : active?.peer.name ?? ""
  const isActivePeerOnline =
    !!active && active.type === "direct" && presenceByUserId[active.peer.id] === "online"
  const typingManager = useMemo(() => {
    if (!activeId) return null
    const supabase = createBrowserSupabaseClient()
    return createTypingManager(supabase, activeId)
  }, [activeId])
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<BlobPart[]>([])
  const recordingStartTsRef = useRef<number | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const recordingRafRef = useRef<number | null>(null)
  const recordingWaveTimerRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const listRefreshInFlightRef = useRef(false)
  const lastListRefreshAtRef = useRef(0)

  const refreshList = useCallback(async () => {
    const now = Date.now()
    if (listRefreshInFlightRef.current) return
    if (now - lastListRefreshAtRef.current < 3000) return
    listRefreshInFlightRef.current = true
    lastListRefreshAtRef.current = now
    setListLoading(true)
    setListError(null)
    const supabase = createBrowserSupabaseClient()
    try {
      const { items: next, error } = await loadMyConversationList(supabase)
      if (error) {
        setListError(error.message)
        setItems([])
      } else {
        setItems(next)
      }
    } finally {
      listRefreshInFlightRef.current = false
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList, urlConversationId])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    void getChatCapabilities(supabase).then(setCaps)
  }, [])

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
    setPendingPeerOverride(null)
  }, [urlConversationId])

  /** Пока строки нет в списке — один раз подтягиваем профиль собеседника (без «Загрузка…» в UI). */
  useEffect(() => {
    if (!urlConversationId || !myId || listLoading) return
    if (sortedItems.some((c) => c.id === urlConversationId)) {
      setPendingPeerOverride(null)
      return
    }

    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    void loadConversationPeerProfile(supabase, urlConversationId, myId).then(({ peer, error }) => {
      if (cancelled) return
      if (error) console.warn("[SupabaseMessages] pending peer profile:", error.message)
      setPendingPeerOverride(peer)
    })
    return () => {
      cancelled = true
    }
  }, [urlConversationId, myId, listLoading, sortedItems])

  useEffect(() => {
    if (!myId || !activeId) {
      setMessages([])
      setMessagesHasMore(false)
      setReadReceiptIds(new Set())
      setPendingMessageIds(new Set())
      canLoadOlderByScrollRef.current = false
      return
    }
    needsInitialScrollToBottomRef.current = true
    canLoadOlderByScrollRef.current = false
    keepBottomUntilTsRef.current = Date.now() + 2500
    let cancelled = false
    setMessagesLoading(true)
    setMessagesError(null)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { messages: rows, hasMore, error } = await loadMessagesForConversation(supabase, activeId, myId, {
        limit: 40
      })
      if (cancelled) return
      if (error) {
        setMessagesError(error.message)
        setMessages([])
        setMessagesHasMore(false)
        setReadReceiptIds(new Set())
      } else {
        setMessages(rows)
        setMessagesHasMore(hasMore)
        const rr = await loadReadReceiptMessageIds(supabase, activeId, myId)
        if (!cancelled && !rr.error) {
          setReadReceiptIds(new Set(rr.ids))
        }
      }
      setMessagesLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [myId, activeId])

  useEffect(() => {
    if (!activeId || messagesLoading) return
    if (!needsInitialScrollToBottomRef.current) return
    const container = messagesScrollRef.current
    if (!container) return
    queueMicrotask(() => {
      const node = messagesScrollRef.current
      if (!node) return
      autoScrollingRef.current = true
      node.scrollTop = node.scrollHeight
      window.setTimeout(() => {
        autoScrollingRef.current = false
      }, 0)
      needsInitialScrollToBottomRef.current = false
      canLoadOlderByScrollRef.current = true
    })
  }, [activeId, messagesLoading, messages.length])

  useEffect(() => {
    if (!activeId || messagesLoading || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (!last) return
    const scrollToLast = () => {
      const node = messageRefs.current[last.id]
      if (!node) return
      autoScrollingRef.current = true
      node.scrollIntoView({ block: "end" })
      window.setTimeout(() => {
        autoScrollingRef.current = false
      }, 0)
    }
    const t1 = window.setTimeout(scrollToLast, 60)
    const t2 = window.setTimeout(scrollToLast, 260)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [activeId, messagesLoading, messages.length])

  useEffect(() => {
    if (!activeId || messagesLoading) return
    if (Date.now() > keepBottomUntilTsRef.current) return
    const node = messagesScrollRef.current
    if (!node) return
    const id = window.requestAnimationFrame(() => {
      const target = messagesScrollRef.current
      if (!target) return
      autoScrollingRef.current = true
      target.scrollTop = target.scrollHeight
      window.setTimeout(() => {
        autoScrollingRef.current = false
      }, 0)
    })
    return () => window.cancelAnimationFrame(id)
  }, [activeId, messagesLoading, messages.length, viewportFrameHeight])

  const loadOlderMessages = useCallback(async () => {
    if (!myId || !activeId || messagesLoadingOlder || !messagesHasMore || messages.length === 0) return
    const oldest = messages[0]
    if (!oldest?.createdAt) return
    const container = messagesScrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    const prevTop = container?.scrollTop ?? 0
    setMessagesLoadingOlder(true)
    const supabase = createBrowserSupabaseClient()
    const { messages: older, hasMore, error } = await loadMessagesForConversation(supabase, activeId, myId, {
      limit: 40,
      beforeCreatedAt: oldest.createdAt
    })
    setMessagesLoadingOlder(false)
    if (error) {
      setMessagesError(error.message)
      return
    }
    if (older.length === 0) {
      setMessagesHasMore(hasMore)
      return
    }
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      const append = older.filter((m) => !seen.has(m.id))
      return [...append, ...prev]
    })
    setMessagesHasMore(hasMore)
    queueMicrotask(() => {
      if (!container) return
      const nextHeight = container.scrollHeight
      container.scrollTop = Math.max(0, nextHeight - prevHeight + prevTop)
    })
  }, [myId, activeId, messagesLoadingOlder, messagesHasMore, messages])

  useEffect(() => {
    if (!myId || !activeId) return
    const supabase = createBrowserSupabaseClient()
    const channel = subscribeToMessageReads(supabase, (row) => {
      if (!row.message_id || !row.user_id || row.user_id === myId) return
      setReadReceiptIds((prev) => {
        const next = new Set(prev)
        next.add(row.message_id!)
        return next
      })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [myId, activeId])

  useEffect(() => {
    const close = () => setMsgMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  useEffect(() => {
    if (!emojiOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const node = composerRef.current
      if (!node) return
      if (event.target instanceof Node && node.contains(event.target)) return
      setEmojiOpen(false)
    }
    window.addEventListener("mousedown", onPointerDown)
    return () => window.removeEventListener("mousedown", onPointerDown)
  }, [emojiOpen])

  const resetRecordingRuntime = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (recordingRafRef.current) {
      window.cancelAnimationFrame(recordingRafRef.current)
      recordingRafRef.current = null
    }
    if (recordingWaveTimerRef.current) {
      window.clearInterval(recordingWaveTimerRef.current)
      recordingWaveTimerRef.current = null
    }
    mediaRecorderRef.current = null
    analyserRef.current = null
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (recordingStreamRef.current) {
      for (const track of recordingStreamRef.current.getTracks()) {
        track.stop()
      }
      recordingStreamRef.current = null
    }
    recordingStartTsRef.current = null
    recordingChunksRef.current = []
  }, [])

  const stopVoiceRecording = useCallback(
    (commit: boolean) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) return
      const mimeType = recorder.mimeType
      setIsRecordingVoice(false)
      recorder.onstop = () => {
        const chunks = recordingChunksRef.current
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" })
        resetRecordingRuntime()
        if (!commit || blob.size === 0) {
          setRecordingDurationSec(0)
          setRecordingWaveform([])
          return
        }
        const normalizedType = normalizeMimeType(blob.type || "audio/webm")
        const ext = normalizedType.includes("ogg")
          ? "ogg"
          : normalizedType.includes("mp4") || normalizedType.includes("m4a")
            ? "m4a"
            : normalizedType.includes("mpeg")
              ? "mp3"
              : "webm"
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: normalizedType || "audio/webm"
        })
        setVoiceDraftFile(file)
      }
      recorder.stop()
    },
    [resetRecordingRuntime]
  )

  const startVoiceRecording = useCallback(async () => {
    if (isRecordingVoice || !!voiceDraftFile || !!editing) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSendError("Голосовые сообщения не поддерживаются в этом браузере")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = preferredVoiceMimeTypes().find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recordingChunksRef.current = []
      recordingStreamRef.current = stream
      mediaRecorderRef.current = recorder
      setEmojiOpen(false)
      setAttachedFile(null)
      setRecordingDurationSec(0)
      setRecordingWaveform([])
      setVoiceDraftFile(null)
      setSendError(null)
      setIsRecordingVoice(true)
      recordingStartTsRef.current = Date.now()

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        audioContextRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser

        const bins = new Uint8Array(analyser.frequencyBinCount)
        const readWave = () => {
          const node = analyserRef.current
          if (!node) return
          node.getByteTimeDomainData(bins)
          let peak = 0
          for (let i = 0; i < bins.length; i++) {
            const val = Math.abs(bins[i]! - 128) / 128
            if (val > peak) peak = val
          }
          const normalized = Math.min(1, Math.max(0.08, peak * 1.35))
          setRecordingWaveform((prev) => {
            const last = prev[prev.length - 1] ?? normalized
            const smooth = last * 0.7 + normalized * 0.3
            return [...prev.slice(-47), smooth]
          })
        }
        recordingWaveTimerRef.current = window.setInterval(readWave, 120)
      }

      recordingTimerRef.current = window.setInterval(() => {
        if (!recordingStartTsRef.current) return
        setRecordingDurationSec(Math.floor((Date.now() - recordingStartTsRef.current) / 1000))
      }, 250)

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }
      recorder.start(160)
    } catch (error) {
      resetRecordingRuntime()
      setIsRecordingVoice(false)
      const message = error instanceof Error ? error.message : "Не удалось начать запись голосового сообщения"
      setSendError(message)
    }
  }, [editing, isRecordingVoice, resetRecordingRuntime, voiceDraftFile])

  useEffect(() => {
    if (!isRecordingVoice) return
    const stopByRelease = () => {
      stopVoiceRecording(true)
    }
    window.addEventListener("pointerup", stopByRelease)
    window.addEventListener("touchend", stopByRelease)
    window.addEventListener("mouseup", stopByRelease)
    return () => {
      window.removeEventListener("pointerup", stopByRelease)
      window.removeEventListener("touchend", stopByRelease)
      window.removeEventListener("mouseup", stopByRelease)
    }
  }, [isRecordingVoice, stopVoiceRecording])

  useEffect(() => {
    const updateFrameHeightToViewport = () => {
      const frame = frameRef.current
      if (!frame) return
      if (window.innerWidth < CHAT_BREAKPOINT) {
        setViewportFrameHeight(null)
        return
      }
      const rect = frame.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const bottomGap = 4
      const available = Math.floor(viewportHeight - rect.top - bottomGap)
      setViewportFrameHeight(available > 240 ? available : 240)
    }

    updateFrameHeightToViewport()
    window.addEventListener("resize", updateFrameHeightToViewport)
    window.addEventListener("scroll", updateFrameHeightToViewport, { passive: true })
    window.visualViewport?.addEventListener("resize", updateFrameHeightToViewport)
    window.visualViewport?.addEventListener("scroll", updateFrameHeightToViewport)
    return () => {
      window.removeEventListener("resize", updateFrameHeightToViewport)
      window.removeEventListener("scroll", updateFrameHeightToViewport)
      window.visualViewport?.removeEventListener("resize", updateFrameHeightToViewport)
      window.visualViewport?.removeEventListener("scroll", updateFrameHeightToViewport)
    }
  }, [])

  useEffect(() => {
    if (!activeId || !myId) return
    const hasUnreadFromPeer = messages.some((m) => m.from === "them" && !m.deletedAt)
    if (!hasUnreadFromPeer) return
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const res = await markConversationRead(supabase, activeId)
      if (res.error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[chat/read] markConversationRead failed:", res.error.message)
        }
        return
      }
      setItems((prev) => prev.map((x) => (x.id === activeId ? { ...x, unreadCount: 0 } : x)))
      const rr = await loadReadReceiptMessageIds(supabase, activeId, myId)
      if (!rr.error) {
        setReadReceiptIds(new Set(rr.ids))
      }
    })()
  }, [activeId, myId, messages])

  useEffect(() => {
    if (!participantsOpen || !activeId) return
    const supabase = createBrowserSupabaseClient()
    void loadConversationParticipants(supabase, activeId).then(({ participants: rows }) => setParticipants(rows))
  }, [participantsOpen, activeId])

  useEffect(() => {
    if (!activeId) return
    const supabase = createBrowserSupabaseClient()
    void loadConversationParticipants(supabase, activeId).then(({ participants: rows }) => {
      setParticipants(rows)
    })
  }, [activeId])

  useEffect(() => {
    if (!myId || !activeId) return
    const supabase = createBrowserSupabaseClient()
    const channel = subscribeToMessages(supabase, activeId, (row) => {
      if (!row.id || !row.conversation_id || !row.sender_id || !row.created_at) return
      const bubble = chatBubbleFromMessageRow(
        {
          id: row.id,
          sender_id: row.sender_id,
          created_at: row.created_at,
          content: row.content,
          is_forwarded: row.is_forwarded,
          forwarded_from_message_id: row.forwarded_from_message_id,
          media_url: row.media_url,
          media_type: row.media_type,
          media_size: row.media_size,
          media_duration_sec: row.media_duration_sec,
          reply_to_id: row.reply_to_id
        },
        myId
      )
      const cid = row.conversation_id
      setMessages((prev) => {
        if (cid !== activeIdRef.current) return prev
        if (prev.some((m) => m.id === bubble.id)) return prev
        const pendingMineIdx = prev.findIndex((m) => m.id.startsWith("tmp-") && m.from === "me" && m.text === bubble.text)
        if (pendingMineIdx >= 0 && bubble.from === "me") {
          const next = [...prev]
          next[pendingMineIdx] = bubble
          return next
        }
        return [...prev, bubble]
      })
      setItems((prev) => {
        const idx = prev.findIndex((r) => r.id === cid)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          lastMessage:
            bubble.text ||
            (bubble.mediaUrl
              ? bubble.mediaType?.startsWith("audio/")
                ? "Голосовое сообщение"
                : "Медиа"
              : "Нет сообщений"),
          lastMessageAt: bubble.createdAt
        }
        return sortConversationListItems(next)
      })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [myId, activeId])

  useEffect(() => {
    if (!myId) return
    const supabase = createBrowserSupabaseClient()
    startPresenceHeartbeat(supabase)
    const channel = subscribeToPresence(supabase, (userId, status) => {
      setPresenceByUserId((prev) => ({ ...prev, [userId]: status }))
    })
    return () => {
      stopPresenceHeartbeat(supabase)
      void supabase.removeChannel(channel)
    }
  }, [myId])

  useEffect(() => {
    if (!active || active.type !== "direct") return
    const supabase = createBrowserSupabaseClient()
    let cancelled = false
    const loadPresence = async () => {
      const { data } = await supabase
      .from("user_presence")
      .select("user_id, status, last_seen_at")
      .eq("user_id", active.peer.id)
      .maybeSingle()
      if (!data || cancelled) return
      const status =
        data.status === "online" &&
        typeof data.last_seen_at === "string" &&
        isOnline({ status: data.status, last_seen_at: data.last_seen_at })
          ? "online"
          : "offline"
      setPresenceByUserId((prev) => ({ ...prev, [active.peer.id]: status }))
    }
    void loadPresence()
    const poll = window.setInterval(() => {
      void loadPresence()
    }, 12_000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [active])

  useEffect(() => {
    if (!active || active.type !== "direct" || !myId) return
    const supabase = createBrowserSupabaseClient()
    let cancelled = false
    const syncPeerProfile = async () => {
      const { peer, error } = await loadConversationPeerProfile(supabase, active.id, myId)
      if (cancelled || error || !peer) return
      setItems((prev) =>
        prev.map((row) =>
          row.id === active.id && row.type === "direct"
            ? {
                ...row,
                title: peer.name,
                peer
              }
            : row
        )
      )
    }
    void syncPeerProfile()
    const poll = window.setInterval(() => {
      void syncPeerProfile()
    }, 15000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [active?.id, active?.type, myId])

  useEffect(() => {
    if (!myId || !activeId) {
      setTypingUserIds([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    let cancelled = false
    const loadTypingNow = async () => {
      const { data } = await supabase
      .from("typing_indicators")
      .select("user_id")
      .eq("conversation_id", activeId)
      .neq("user_id", myId)
      if (cancelled) return
      const ids = (data ?? [])
        .map((row) => (row as { user_id?: string }).user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
      setTypingUserIds([...new Set(ids)])
    }
    void loadTypingNow()
    const poll = window.setInterval(() => {
      void loadTypingNow()
    }, 15_000)
    const channel = subscribeToTyping(supabase, activeId, (userId, isTyping) => {
      if (userId === myId) return
      setTypingUserIds((prev) => {
        if (isTyping) {
          if (prev.includes(userId)) return prev
          return [...prev, userId]
        }
        return prev.filter((id) => id !== userId)
      })
    })
    return () => {
      cancelled = true
      window.clearInterval(poll)
      setTypingUserIds([])
      void supabase.removeChannel(channel)
    }
  }, [myId, activeId])

  useEffect(() => {
    return () => {
      typingManager?.cleanup()
      touchStartRef.current = null
    }
  }, [typingManager])

  useEffect(() => {
    return () => {
      resetRecordingRuntime()
    }
  }, [resetRecordingRuntime])

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

  const startReplyFromMessage = useCallback(
    (msg: ChatBubble) => {
      if (msg.deletedAt) return
      setEditing(null)
      setAttachedFile(null)
      setReplying({
        messageId: msg.id,
        previewText: msg.text?.trim() ? msg.text : msg.mediaUrl ? "Вложение" : "Сообщение",
        from: msg.from
      })
      queueMicrotask(() => inputRef.current?.focus())
    },
    []
  )

  const handleSend = useCallback(async () => {
    if (!myId || !activeId || !active) return
    const t = inputText.trim()
    if (editing) {
      if (!t || t === editing.originalText.trim()) return
      setSendError(null)
      const supabase = createBrowserSupabaseClient()
      const res = await editChatMessage(supabase, editing.messageId, t)
      if (res.error) {
        setSendError(res.error.message)
        return
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editing.messageId
            ? { ...m, text: t, editedAt: new Date().toISOString() }
            : m
        )
      )
      setItems((prev) =>
        sortConversationListItems(
          prev.map((row) =>
            row.id === activeId
              ? { ...row, lastMessage: t }
              : row
          )
        )
      )
      setEditing(null)
      setInputText("")
      return
    }
    if (!t && !attachedFile && !voiceDraftFile) return
    setSendError(null)
    const supabase = createBrowserSupabaseClient()
    const optimisticId = `tmp-${Date.now()}`
    const optimisticNow = new Date().toISOString()
    const optimistic: ChatBubble = {
      id: optimisticId,
      from: "me",
      text: t,
      isForwarded: false,
      mediaUrl: null,
      mediaType: null,
      mediaSize: null,
      mediaDurationSec: voiceDraftFile ? Math.max(1, recordingDurationSec || 0) : null,
      replyToId: replying?.messageId ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt: optimisticNow,
      timeLabel: formatChatTimeLabel(optimisticNow)
    }
    setMessages((prev) => [...prev, optimistic])
    setPendingMessageIds((prev) => {
      const next = new Set(prev)
      next.add(optimisticId)
      return next
    })
    let mediaPayload: { url: string; type: string; size: number } | null = null
    const mediaFile = voiceDraftFile ?? attachedFile
    if (mediaFile) {
      try {
        const uploaded = await uploadChatMedia(supabase, activeId, mediaFile)
        mediaPayload = {
          url: uploaded.url,
          type: uploaded.mediaType,
          size: uploaded.mediaSize
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Не удалось загрузить медиафайл"
        setSendError(message)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setPendingMessageIds((prev) => {
          const next = new Set(prev)
          next.delete(optimisticId)
          return next
        })
        return
      }
    }
    const { message, error } = await sendChatMessage(supabase, activeId, myId, t, {
      mediaUrl: mediaPayload?.url ?? null,
      mediaType: mediaPayload?.type ?? null,
      mediaSize: mediaPayload?.size ?? null,
      mediaDurationSec:
        mediaPayload?.type?.startsWith("audio/") && voiceDraftFile ? Math.max(1, recordingDurationSec || 0) : null,
      replyToId: replying?.messageId ?? null
    })
    if (error) {
      setSendError(error.message)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setPendingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(optimisticId)
        return next
      })
      return
    }
    if (message) {
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? message : m)))
      setPendingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(optimisticId)
        return next
      })
      setItems((prev) => {
        const idx = prev.findIndex((row) => row.id === activeId)
        if (idx === -1) {
          const peer = active?.peer ?? {
            id: "",
            name: "User",
            avatarUrl: null,
            role: "",
            uiAccent: null
          }
          const row: ConversationListItem = {
            id: activeId,
            type: active?.type ?? "direct",
            title: active?.type === "group" ? active.title : peer.name,
            peer,
            lastMessage:
              message.text ||
              (message.mediaUrl
                ? message.mediaType?.startsWith("audio/")
                  ? "Голосовое сообщение"
                  : "Медиа"
                : "Нет сообщений"),
            lastMessageAt: message.createdAt,
            unreadCount: 0,
            conversationCreatedAt: new Date().toISOString()
          }
          return sortConversationListItems([row, ...prev])
        }
        const next = prev.map((row) =>
          row.id === activeId
            ? {
                ...row,
                lastMessage:
                  message.text ||
                  (message.mediaUrl
                    ? message.mediaType?.startsWith("audio/")
                      ? "Голосовое сообщение"
                      : "Медиа"
                    : "Нет сообщений"),
                lastMessageAt: message.createdAt
              }
            : row
        )
        return sortConversationListItems(next)
      })
    }
    setInputText("")
    setAttachedFile(null)
    setVoiceDraftFile(null)
    setRecordingDurationSec(0)
    setRecordingWaveform([])
    setReplying(null)
    typingManager?.cleanup()
  }, [myId, activeId, active, inputText, attachedFile, voiceDraftFile, typingManager, editing, replying])

  const showList = wide || mobilePanel === "list"
  const showChat = wide || mobilePanel === "chat"
  const empty = !listLoading && !listError && sidebarItems.length === 0

  const activeRoleLine =
    active?.type === "group"
      ? "Групповой чат"
      : active
        ? formatListPeerRole(active.peer.role)
        : ""
  const activePeerHref = active && myRole ? chatPeerProfileHref(myRole, active.peer) : null
  const canManageGroup = !!active && active.type === "group" && (myRole === "teacher" || myRole === "curator")
  const canAttachMedia = caps?.has_messages_media === true
  const canRecordVoice = canAttachMedia
  const canSend =
    (editing
      ? !!inputText.trim()
      : !!inputText.trim() || !!attachedFile || !!voiceDraftFile) &&
    !messagesLoading &&
    !messagesError &&
    !!myId &&
    !!activeId &&
    !!active

  const typingIndicatorText = useMemo(() => {
    if (typingUserIds.length === 0) return ""
    if (!active) return "Кто-то печатает"

    const nameById = new Map(participants.map((p) => [p.id, p.name]))
    if (active.type === "direct") {
      return `${active.peer.name} печатает`
    }

    const names = typingUserIds
      .map((id) => nameById.get(id) ?? "Участник")
      .filter((name, idx, arr) => arr.indexOf(name) === idx)

    if (names.length === 1) return `${names[0]} печатает`
    if (names.length === 2) return `${names[0]} и ${names[1]} печатают`
    return `${names[0]}, ${names[1]} и еще ${names.length - 2} печатают`
  }, [typingUserIds, active, participants])

  const insertEmoji = useCallback(
    (emoji: string) => {
      const input = inputRef.current
      const current = inputText
      if (!input) {
        setInputText((prev) => `${prev}${emoji}`)
        typingManager?.onKeypress()
        return
      }
      const start = input.selectionStart ?? current.length
      const end = input.selectionEnd ?? start
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`
      setInputText(next)
      queueMicrotask(() => {
        input.focus()
        const cursor = start + emoji.length
        input.setSelectionRange(cursor, cursor)
      })
      typingManager?.onKeypress()
    },
    [inputText, typingManager]
  )

  const forwardSourceMessage = useMemo(
    () => messages.find((m) => m.id === forwardingMessageId) ?? null,
    [messages, forwardingMessageId]
  )
  const forwardSourceAuthor = useMemo(() => {
    if (!forwardSourceMessage) return null
    if (forwardSourceMessage.from === "me") {
      return {
        name: user?.name?.trim() || "Вы",
        avatarUrl: user?.avatar?.trim() || null,
        role: myRole ?? ""
      }
    }
    if (active?.type === "direct") {
      return {
        name: active.peer.name,
        avatarUrl: active.peer.avatarUrl,
        role: active.peer.role
      }
    }
    return {
      name: "Участник чата",
      avatarUrl: null,
      role: ""
    }
  }, [forwardSourceMessage, user?.name, user?.avatar, myRole, active])

  return (
    <div className="ds-figma-page ds-messages-page flex min-h-0 w-full flex-1 flex-col lg:overflow-hidden">
      <div
        ref={frameRef}
        className="ds-messages-page__frame flex w-full min-h-0 flex-1 flex-col lg:overflow-hidden"
        style={
          wide && viewportFrameHeight
            ? {
                height: `${viewportFrameHeight}px`,
                maxHeight: `${viewportFrameHeight}px`
              }
            : undefined
        }
      >
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
                      <PeerAvatarImg peer={peer} size="list" />
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
                        {row.unreadCount > 0 ? (
                          <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-ds-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            {row.unreadCount}
                          </span>
                        ) : null}
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
                <header className="flex shrink-0 items-center gap-3 border-b border-[#e8e8e8] px-3 py-2 sm:px-5 sm:py-4 dark:border-[#333333] lg:row-start-1">
                  {!wide ? (
                    <button
                      type="button"
                      className="grid h-10 w-10 shrink-0 place-content-center rounded-full border border-black/10 bg-ds-surface text-ds-ink transition-colors hover:bg-black/[0.04] active:bg-black/[0.08] dark:border-white/15 dark:hover:bg-white/[0.08] dark:active:bg-white/[0.14]"
                      onClick={() => setMobilePanel("list")}
                      aria-label="Назад к списку"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  ) : null}
                  {activePeerHref ? (
                    <Link href={activePeerHref} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                      <PeerAvatarImg peer={active.peer} size="header" isOnline={isActivePeerOnline} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold leading-tight text-ds-ink">{activeTitle}</p>
                        {activeRoleLine || isActivePeerOnline ? (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-ds-text-secondary">
                            <span>{activeRoleLine}</span>
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ) : (
                    <>
                      <PeerAvatarImg peer={active.peer} size="header" isOnline={isActivePeerOnline} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold leading-tight text-ds-ink">{activeTitle}</p>
                        {activeRoleLine || isActivePeerOnline ? (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-ds-text-secondary">
                            <span>{activeRoleLine}</span>
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                  {canManageGroup ? (
                    <button
                      type="button"
                      onClick={() => setParticipantsOpen(true)}
                      className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-medium text-ds-ink dark:border-white/15"
                    >
                      Участники
                    </button>
                  ) : null}
                </header>

                <div
                  ref={messagesScrollRef}
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-5 lg:row-start-2 lg:min-h-0"
                  onScroll={(e) => {
                    const el = e.currentTarget
                    if (!autoScrollingRef.current) {
                      const distanceToBottom = el.scrollHeight - el.clientHeight - el.scrollTop
                      if (distanceToBottom > 56) {
                        keepBottomUntilTsRef.current = 0
                      }
                    }
                    if (canLoadOlderByScrollRef.current && el.scrollTop <= 40) {
                      void loadOlderMessages()
                    }
                  }}
                >
                  {messagesLoadingOlder ? (
                    <p className="text-center text-[12px] text-ds-text-tertiary">Загрузка предыдущих сообщений…</p>
                  ) : null}
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
                        <div className="max-w-[min(92vw,24rem)] sm:max-w-[70%]">
                          <div
                            ref={(el) => {
                              messageRefs.current[msg.id] = el
                            }}
                            className={cn(
                              "rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.5] transition-[box-shadow,background-color]",
                              msg.from === "me" ? "ds-msg-bubble-me" : "ds-msg-bubble-them",
                              ((myRole === "student" && msg.from === "me") ||
                                (myRole !== "student" && msg.from === "them" && active?.peer.role === "student")) &&
                                msg.mediaType?.startsWith("audio/")
                                ? "bg-[var(--voice-bubble-bg)] text-[var(--voice-bubble-fg)] dark:text-[var(--voice-bubble-fg)]"
                                : "",
                              highlightedMessageId === msg.id
                                ? "ring-2 ring-ds-sage-strong/60 shadow-[0_0_0_4px_rgb(0_0_0/0.06)] dark:shadow-[0_0_0_4px_rgb(255_255_255/0.08)]"
                                : ""
                            )}
                            style={
                              ((myRole === "student" && msg.from === "me") ||
                                (myRole !== "student" && msg.from === "them" && active?.peer.role === "student")) &&
                              msg.mediaType?.startsWith("audio/")
                                ? (accentBubbleCssVars(
                                    (myRole === "student" && msg.from === "me"
                                      ? user?.uiAccent
                                      : active?.peer.uiAccent) ?? "sage"
                                  ) as unknown as CSSProperties)
                                : undefined
                            }
                            onContextMenu={(e) => {
                              if (msg.deletedAt) return
                              e.preventDefault()
                              setMsgMenu({ messageId: msg.id, x: e.clientX, y: e.clientY })
                            }}
                            onTouchStart={(e) => {
                              if (msg.deletedAt) return
                              if (e.touches.length !== 1) return
                              const touch = e.touches[0]
                              touchStartRef.current = { messageId: msg.id, x: touch.clientX, y: touch.clientY }
                            }}
                            onTouchMove={() => {
                              /* keep native selection/scroll behavior */
                            }}
                            onTouchEnd={(e) => {
                              if (msg.deletedAt) return
                              const start = touchStartRef.current
                              touchStartRef.current = null
                              if (!start || start.messageId !== msg.id) return
                              const touch = e.changedTouches[0]
                              if (!touch) return
                              const dx = touch.clientX - start.x
                              const dy = touch.clientY - start.y
                              // Mobile quick actions:
                              // - swipe right => reply (for any message, Telegram-style)
                              // - swipe left  => open menu (only own message)
                              if (dx >= 64 && Math.abs(dy) <= 28) {
                                startReplyFromMessage(msg)
                                return
                              }
                              if (dx <= -64 && Math.abs(dy) <= 28 && msg.from === "me") {
                                setMsgMenu({ messageId: msg.id, x: touch.clientX, y: touch.clientY })
                              }
                            }}
                          >
                          {msg.replyToId ? (
                            <button
                              type="button"
                              className={cn(
                                "mb-1.5 w-full rounded-lg border-l-2 px-2 py-1 text-left text-[12px] leading-snug",
                                msg.from === "me"
                                  ? "border-white/55 bg-white/12 text-white/85"
                                  : "border-black/35 bg-black/[0.05] text-ds-text-secondary dark:border-white/35 dark:bg-white/[0.06]"
                              )}
                              onClick={() => {
                                const target = messageRefs.current[msg.replyToId!]
                                if (!target) return
                                target.scrollIntoView({ behavior: "smooth", block: "center" })
                                setHighlightedMessageId(msg.replyToId!)
                                window.setTimeout(() => {
                                  setHighlightedMessageId((prev) => (prev === msg.replyToId ? null : prev))
                                }, 1600)
                              }}
                            >
                              {(() => {
                                const replied = messages.find((m) => m.id === msg.replyToId)
                                if (!replied) return "Ответ на сообщение"
                                if (replied.deletedAt) return "Ответ на: Сообщение удалено"
                                const prefix = replied.from === "me" ? "Вы: " : "Собеседник: "
                                const body = replied.text?.trim()
                                  ? replied.text
                                  : replied.mediaUrl
                                    ? "Вложение"
                                    : "Сообщение"
                                return `Ответ на: ${prefix}${body}`
                              })()}
                            </button>
                          ) : null}
                          {msg.isForwarded && !msg.deletedAt ? (
                            <p
                              className={cn(
                                "mb-1 text-[11px] font-medium opacity-75",
                                msg.from === "me" ? "text-inherit" : "text-ds-text-tertiary"
                              )}
                            >
                              Переслано
                            </p>
                          ) : null}
                          {msg.deletedAt ? (
                            <p className="italic opacity-70">Сообщение удалено</p>
                          ) : msg.text ? (
                            <p className="ds-hyphenate-safe min-w-0 max-w-full">{msg.text}</p>
                          ) : null}
                          {msg.mediaUrl ? (
                            msg.mediaType?.startsWith("audio/") ? (
                              <VoiceMessageBubble
                                messageId={msg.id}
                                src={msg.mediaUrl}
                                initialDurationSec={msg.mediaDurationSec}
                                tone={
                                  (myRole === "student" && msg.from === "me") ||
                                  (myRole !== "student" && msg.from === "them" && active?.peer.role === "student")
                                    ? "accent"
                                    : msg.from === "me"
                                      ? "dark"
                                      : "light"
                                }
                                accent={
                                  myRole === "student" && msg.from === "me"
                                    ? ((user?.uiAccent as AccentKey | null) ?? "sage")
                                    : ((active?.peer.uiAccent as AccentKey | null) ?? "sage")
                                }
                              />
                            ) : (
                              <MediaImageAttachment src={msg.mediaUrl} alt="Вложение" />
                            )
                          ) : null}
                          </div>
                          <p
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1.5 px-1 text-right text-[11px] opacity-80",
                              msg.from === "me" ? "text-ds-text-secondary" : "text-ds-text-tertiary"
                            )}
                          >
                            {msg.editedAt ? (
                              <span className="inline-flex items-center gap-1 opacity-95">
                                <Pencil size={11} />
                                <span>изменено</span>
                              </span>
                            ) : null}
                            <span>{msg.timeLabel}</span>
                            {msg.from === "me" ? (
                              pendingMessageIds.has(msg.id) ? (
                                <span className="inline-flex items-center">
                                  <Check size={13} />
                                </span>
                              ) : readReceiptIds.has(msg.id) ? (
                                <span className="inline-flex items-center text-sky-400 opacity-100">
                                  <Check size={13} />
                                  <Check size={13} className="-ml-1" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center opacity-100">
                                  <Check size={13} />
                                  <Check size={13} className="-ml-1" />
                                </span>
                              )
                            ) : null}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  {typingUserIds.length > 0 ? (
                    <div className="flex w-full justify-start">
                      <div className="inline-flex items-end gap-2 rounded-2xl bg-black/[0.05] px-3 py-2 text-[12px] text-ds-text-tertiary dark:bg-white/[0.07]">
                        <span>{typingIndicatorText}</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-[typingDot_1s_ease-in-out_infinite]"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-[typingDot_1s_ease-in-out_infinite]"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-[typingDot_1s_ease-in-out_infinite]"
                            style={{ animationDelay: "300ms" }}
                          />
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col gap-2 border-t border-[#e8e8e8] bg-ds-surface px-3 py-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-[#333333] lg:row-start-3">
                  {editing ? (
                    <div className="rounded-xl bg-[var(--ds-sage)] px-3 py-2 text-[color:color-mix(in_srgb,var(--ds-sage-strong)_58%,var(--ds-ink))] dark:text-[color:color-mix(in_srgb,var(--ds-sage-hover)_75%,white)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                            <Pencil size={12} className="shrink-0" />
                            <span>Редактирование сообщения</span>
                          </p>
                          <p className="truncate text-[12px] opacity-85">{editing.originalText}</p>
                        </div>
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 rounded-full p-1 text-inherit hover:bg-black/10 dark:hover:bg-white/10"
                          onClick={() => {
                            setEditing(null)
                            setInputText("")
                          }}
                          aria-label="Отменить редактирование"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {replying && !editing ? (
                    <div className="rounded-xl bg-[var(--ds-sage)] px-3 py-2 text-[color:color-mix(in_srgb,var(--ds-sage-strong)_58%,var(--ds-ink))] dark:text-[color:color-mix(in_srgb,var(--ds-sage-hover)_75%,white)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold">
                            Ответ на {replying.from === "me" ? "ваше сообщение" : "сообщение собеседника"}
                          </p>
                          <p className="truncate text-[12px] opacity-85">{replying.previewText}</p>
                        </div>
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 rounded-full p-1 text-inherit hover:bg-black/10 dark:hover:bg-white/10"
                          onClick={() => setReplying(null)}
                          aria-label="Отменить ответ"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {sendError ? (
                    <p className="text-center text-[12px] text-destructive">{sendError}</p>
                  ) : null}
                  {isRecordingVoice || voiceDraftFile ? (
                    <div
                      className="rounded-2xl bg-[var(--voice-bubble-bg)] px-3 py-2 text-[var(--voice-bubble-fg)] dark:text-[var(--voice-bubble-fg)]"
                      style={accentBubbleCssVars((user?.uiAccent as AccentKey | null) ?? "sage") as unknown as CSSProperties}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            isRecordingVoice ? "animate-pulse bg-red-500" : "bg-sky-500"
                          )}
                        />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex h-8 items-end gap-[2px]">
                            {(recordingWaveform.length > 0 ? recordingWaveform : [0.2, 0.26, 0.18, 0.32, 0.22]).map((val, idx) => (
                              <span
                                key={idx}
                                className="inline-block w-[3px] rounded-full bg-black/65 transition-[height] duration-150 dark:bg-white/75"
                                style={{ height: `${Math.max(4, Math.round(val * 24))}px` }}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="shrink-0 text-[12px] font-medium text-ds-text-secondary">
                          {formatRecordingDuration(recordingDurationSec)}
                        </span>
                        {!isRecordingVoice ? (
                          <>
                            <button
                              type="button"
                              className="rounded-full p-1 text-ds-text-tertiary hover:bg-black/10 dark:hover:bg-white/10"
                              onClick={() => {
                                setVoiceDraftFile(null)
                                setRecordingDurationSec(0)
                                setRecordingWaveform([])
                              }}
                              aria-label="Отменить голосовое"
                            >
                              <X size={16} />
                            </button>
                            <button
                              type="button"
                              className="rounded-full p-1 text-sky-600 hover:bg-black/10 dark:text-sky-400 dark:hover:bg-white/10"
                              onClick={() => void handleSend()}
                              aria-label="Отправить голосовое"
                            >
                              <Check size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-ds-text-tertiary">
                        {isRecordingVoice ? "Удерживайте кнопку микрофона для записи" : "Голосовое сообщение готово к отправке"}
                      </p>
                    </div>
                  ) : null}
                  <div ref={composerRef} className="relative flex min-w-0 items-end gap-2 sm:gap-3">
                    <label
                      className={cn(
                        "mb-0.5 grid h-11 w-11 shrink-0 select-none place-content-center rounded-full border border-black/10 text-ds-ink transition-colors dark:border-white/15",
                        canAttachMedia
                          ? "cursor-pointer hover:bg-black/[0.04] active:bg-black/[0.08] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.14]"
                          : "cursor-not-allowed opacity-40"
                      )}
                      style={ICON_ACTION_NONSELECT_STYLE}
                    >
                      <Paperclip size={18} strokeWidth={2} />
                      <input
                        type="file"
                        className="hidden"
                        accept={MEDIA_LIMITS.allowedMimeTypes.join(",")}
                        disabled={!canAttachMedia || !!editing}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          if (!file) return
                          if (file.size > MEDIA_LIMITS.maxFileSizeBytes) {
                            setSendError(
                              `Файл слишком большой (максимум ${Math.floor(MEDIA_LIMITS.maxFileSizeBytes / 1024 / 1024)} MB)`
                            )
                            return
                          }
                          const normalizedType = normalizeMimeType(file.type)
                          if (
                            !MEDIA_LIMITS.allowedMimeTypes.includes(
                              normalizedType as (typeof MEDIA_LIMITS.allowedMimeTypes)[number]
                            )
                          ) {
                            setSendError(`Недопустимый тип файла: ${file.type}`)
                            return
                          }
                          setSendError(null)
                          setAttachedFile(file)
                        }}
                      />
                    </label>
                    {wide ? (
                      <button
                        type="button"
                        className="mb-0.5 grid h-11 w-11 shrink-0 select-none place-content-center rounded-full border border-black/10 text-ds-ink transition-colors hover:bg-black/[0.04] active:bg-black/[0.08] dark:border-white/15 dark:hover:bg-white/[0.08] dark:active:bg-white/[0.14]"
                        aria-label="Открыть эмодзи"
                        style={ICON_ACTION_NONSELECT_STYLE}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => setEmojiOpen((v) => !v)}
                      >
                        <Smile size={18} strokeWidth={2} />
                      </button>
                    ) : null}
                    {wide && emojiOpen ? (
                      <div className="absolute bottom-[calc(100%+0.5rem)] left-12 z-30 w-[min(22rem,75vw)] rounded-2xl border border-black/10 bg-white/90 p-2 shadow-xl backdrop-blur dark:border-white/15 dark:bg-[#161616]/90">
                        <div className="grid grid-cols-8 gap-1">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="grid h-8 w-8 place-content-center rounded-lg text-[18px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                              onClick={() => insertEmoji(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <Textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value)
                        typingManager?.onKeypress()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          void handleSend()
                        }
                      }}
                      placeholder="Сообщение…"
                      rows={1}
                      disabled={messagesLoading || !!messagesError || isRecordingVoice}
                      className="min-h-[44px] max-h-[9rem] min-w-0 flex-1 resize-none rounded-2xl border-0 bg-[#f5f5f5] px-4 py-3 text-base leading-snug text-ds-ink shadow-none outline-none ring-0 placeholder:text-ds-text-placeholder focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-ds-ink/15 disabled:opacity-50 md:text-[14px] md:leading-snug dark:bg-white/[0.06]"
                    />
                    <button
                      type="button"
                      className={cn(
                        "mb-0.5 grid h-11 w-11 shrink-0 select-none place-content-center rounded-full border border-black/10 text-ds-ink transition-colors dark:border-white/15",
                        canRecordVoice
                          ? "hover:bg-black/[0.04] active:bg-black/[0.08] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.14]"
                          : "cursor-not-allowed opacity-40",
                        isRecordingVoice ? "bg-red-500/10 text-red-600 dark:text-red-400" : ""
                      )}
                      aria-label={isRecordingVoice ? "Идет запись" : "Записать голосовое сообщение"}
                      disabled={!canRecordVoice || !!editing || !!voiceDraftFile}
                      style={ICON_ACTION_NONSELECT_STYLE}
                      onContextMenu={(e) => e.preventDefault()}
                      onPointerDown={(e) => {
                        if (!canRecordVoice || !!editing || !!voiceDraftFile) return
                        e.preventDefault()
                        void startVoiceRecording()
                      }}
                      onTouchStart={(e) => {
                        if (!canRecordVoice || !!editing || !!voiceDraftFile) return
                        e.preventDefault()
                        void startVoiceRecording()
                      }}
                      onPointerUp={() => {
                        if (isRecordingVoice) stopVoiceRecording(true)
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault()
                        if (isRecordingVoice) stopVoiceRecording(true)
                      }}
                      onPointerCancel={() => {
                        if (isRecordingVoice) stopVoiceRecording(false)
                      }}
                      onTouchCancel={(e) => {
                        e.preventDefault()
                        if (isRecordingVoice) stopVoiceRecording(false)
                      }}
                      onPointerLeave={(e) => {
                        if (!isRecordingVoice) return
                        if (e.buttons === 1) return
                        stopVoiceRecording(true)
                      }}
                    >
                      <Mic size={18} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!canSend}
                      className="mb-0.5 grid h-11 w-11 shrink-0 select-none place-content-center rounded-full bg-[#1a1a1a] text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-35 dark:bg-white dark:text-[#1a1a1a]"
                      aria-label={editing ? "Сохранить изменение" : "Отправить"}
                      style={ICON_ACTION_NONSELECT_STYLE}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <Send size={18} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                {attachedFile ? (
                  <p className="truncate text-center text-[12px] text-ds-text-secondary">
                    Вложение: {attachedFile.name}
                  </p>
                ) : null}
                {voiceDraftFile && !isRecordingVoice ? (
                  <p className="truncate text-center text-[12px] text-ds-text-secondary">
                    Голосовое: {voiceDraftFile.name}
                  </p>
                ) : null}
                {!canAttachMedia ? (
                  <p className="truncate text-center text-[12px] text-ds-text-tertiary">
                    Медиа будет доступно после полного обновления схемы чата
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
      {msgMenu ? (
        <div
          className="fixed z-50 min-w-44 rounded-xl border border-black/10 bg-white/70 p-1 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-white/15 dark:bg-[#161616]/70 dark:supports-[backdrop-filter]:bg-[#141414]/55"
          style={{ left: Math.max(8, msgMenu.x - 90), top: Math.max(8, msgMenu.y - 12) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            onClick={() => {
              const msg = messages.find((m) => m.id === msgMenu.messageId)
              setMsgMenu(null)
              if (!msg || msg.deletedAt) return
              startReplyFromMessage(msg)
            }}
          >
            Ответить
          </button>
          {messages.find((m) => m.id === msgMenu.messageId)?.from === "me" ? (
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            onClick={async () => {
              const msg = messages.find((m) => m.id === msgMenu.messageId)
              setMsgMenu(null)
              if (!msg || msg.deletedAt) return
              setEditing({ messageId: msg.id, originalText: msg.text })
              setInputText(msg.text)
              setAttachedFile(null)
              setReplying(null)
              queueMicrotask(() => inputRef.current?.focus())
            }}
          >
            Изменить
          </button>
          ) : null}
          {messages.find((m) => m.id === msgMenu.messageId)?.from === "me" ? (
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            onClick={async () => {
              const msg = messages.find((m) => m.id === msgMenu.messageId)
              setMsgMenu(null)
              if (!msg || msg.deletedAt) return
              setDeleteConfirmMessageId(msg.id)
            }}
          >
            Удалить
          </button>
          ) : null}
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            onClick={() => {
              const msg = messages.find((m) => m.id === msgMenu.messageId)
              setMsgMenu(null)
              if (!msg || msg.deletedAt) return
              setForwardingMessageId(msg.id)
            }}
          >
            Переслать
          </button>
        </div>
      ) : null}
      {forwardingMessageId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl bg-ds-surface p-4 shadow-xl dark:border dark:border-white/10">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ds-ink">Переслать сообщение</p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-ds-text-tertiary hover:bg-black/10 dark:hover:bg-white/10"
                onClick={() => setForwardingMessageId(null)}
                aria-label="Закрыть пересылку"
              >
                <X size={16} />
              </button>
            </div>
            {forwardSourceAuthor ? (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl bg-black/[0.04] px-3 py-2.5 dark:bg-white/[0.06]">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  {forwardSourceAuthor.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={forwardSourceAuthor.avatarUrl}
                      alt={forwardSourceAuthor.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-content-center text-[12px] font-semibold text-ds-text-secondary">
                      {(forwardSourceAuthor.name[0] ?? "U").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-ds-text-secondary">Исходное сообщение от</p>
                  <p className="truncate text-[14px] font-semibold text-ds-ink">{forwardSourceAuthor.name}</p>
                  <div className="mt-1.5 border-l-2 border-black/25 pl-2.5 dark:border-white/35">
                    <p className="line-clamp-3 break-words text-[13px] leading-snug text-ds-text-secondary">
                      {forwardSourceMessage?.text?.trim()
                        ? forwardSourceMessage.text
                        : forwardSourceMessage?.mediaUrl
                          ? "Вложение"
                          : "Сообщение"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {sidebarItems.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
                    row.id === activeId ? "bg-black/[0.04] dark:bg-white/[0.06]" : ""
                  )}
                  onClick={async () => {
                    if (!myId || !forwardSourceMessage) return
                    const supabase = createBrowserSupabaseClient()
                    const { error } = await sendChatMessage(
                      supabase,
                      row.id,
                      myId,
                      forwardSourceMessage.text,
                      {
                        mediaUrl: forwardSourceMessage.mediaUrl,
                        mediaType: forwardSourceMessage.mediaType,
                        mediaSize: forwardSourceMessage.mediaSize,
                        mediaDurationSec: forwardSourceMessage.mediaDurationSec,
                        forwarded: true
                      }
                    )
                    if (error) {
                      setSendError(error.message)
                      return
                    }
                    setForwardingMessageId(null)
                    setSendError(null)
                    if (row.id !== activeId) {
                      await refreshList()
                    }
                  }}
                >
                  <span className="truncate font-medium text-ds-ink">
                    {row.type === "group" ? row.title : row.peer.name}
                  </span>
                  {row.id === activeId ? (
                    <span className="shrink-0 text-[11px] text-ds-text-tertiary">Текущий чат</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {canManageGroup && participantsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-ds-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-ds-ink">Участники</p>
              <button type="button" onClick={() => setParticipantsOpen(false)} className="text-[12px] text-ds-text-secondary">
                Закрыть
              </button>
            </div>
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px]">
                  <span className="truncate">{p.name}</span>
                  {(myRole === "curator" || p.role === "student") && p.id !== myId ? (
                    <button
                      type="button"
                      className="text-[12px] text-destructive"
                      onClick={async () => {
                        if (!activeId) return
                        const supabase = createBrowserSupabaseClient()
                        await removeParticipantFromConversation(supabase, activeId, p.id)
                        const { participants: rows } = await loadConversationParticipants(supabase, activeId)
                        setParticipants(rows)
                      }}
                    >
                      Удалить
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-black/10 px-3 py-1 text-[12px] dark:border-white/15"
                onClick={() => {
                  setAddParticipantInput("")
                  setAddParticipantOpen(true)
                }}
              >
                Добавить ученика
              </button>
              <button
                type="button"
                className="rounded-full border border-black/10 px-3 py-1 text-[12px] dark:border-white/15"
                onClick={() => {
                  setRenameInput(activeTitle)
                  setRenameOpen(true)
                }}
              >
                Переименовать
              </button>
              {myRole === "curator" ? (
                <button
                  type="button"
                  className="rounded-full border border-black/10 px-3 py-1 text-[12px] dark:border-white/15"
                  onClick={() => {
                    setMoveStudentInput("")
                    setMoveTargetConversationInput("")
                    setMoveOpen(true)
                  }}
                >
                  Перенести ученика
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <Dialog
        open={deleteConfirmMessageId !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleteConfirmMessageId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить сообщение?</DialogTitle>
            <DialogDescription asChild>
              <div className="text-[15px] leading-relaxed text-ds-text-secondary">
                Сообщение будет скрыто в чате и заменено на пометку об удалении.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmMessageId(null)}
              disabled={deleteBusy}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy || !deleteConfirmMessageId}
              onClick={async () => {
                if (!deleteConfirmMessageId) return
                setDeleteBusy(true)
                const supabase = createBrowserSupabaseClient()
                const res = await deleteChatMessage(supabase, deleteConfirmMessageId)
                setDeleteBusy(false)
                if (res.error) {
                  setSendError(res.error.message)
                  return
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === deleteConfirmMessageId
                      ? {
                          ...m,
                          text: "",
                          mediaUrl: null,
                          mediaType: null,
                          mediaSize: null,
                          deletedAt: new Date().toISOString()
                        }
                      : m
                  )
                )
                setDeleteConfirmMessageId(null)
              }}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addParticipantOpen} onOpenChange={(open) => !groupActionBusy && setAddParticipantOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить ученика в группу</DialogTitle>
            <DialogDescription asChild>
              <div className="text-[14px] leading-relaxed text-ds-text-secondary">
                Укажите UUID ученика из `public.profiles.id`.
              </div>
            </DialogDescription>
          </DialogHeader>
          <input
            value={addParticipantInput}
            onChange={(e) => setAddParticipantInput(e.target.value)}
            placeholder="UUID ученика"
            className="h-11 w-full rounded-xl border border-black/10 bg-ds-surface px-3 text-[14px] text-ds-ink outline-none focus:ring-2 focus:ring-ds-ink/15 dark:border-white/15"
          />
          <DialogFooter className="gap-3 sm:gap-3">
            <Button type="button" variant="outline" onClick={() => setAddParticipantOpen(false)} disabled={groupActionBusy}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={groupActionBusy || !addParticipantInput.trim() || !activeId}
              onClick={async () => {
                if (!activeId) return
                setGroupActionBusy(true)
                const supabase = createBrowserSupabaseClient()
                const added = await addParticipantsToConversation(supabase, activeId, [addParticipantInput])
                setGroupActionBusy(false)
                if (added.error) {
                  setSendError(added.error.message)
                  return
                }
                const { participants: rows } = await loadConversationParticipants(supabase, activeId)
                setParticipants(rows)
                setAddParticipantOpen(false)
              }}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={renameOpen} onOpenChange={(open) => !groupActionBusy && setRenameOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переименовать группу</DialogTitle>
            <DialogDescription asChild>
              <div className="text-[14px] leading-relaxed text-ds-text-secondary">Новое название группового чата.</div>
            </DialogDescription>
          </DialogHeader>
          <input
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            placeholder="Новое название"
            className="h-11 w-full rounded-xl border border-black/10 bg-ds-surface px-3 text-[14px] text-ds-ink outline-none focus:ring-2 focus:ring-ds-ink/15 dark:border-white/15"
          />
          <DialogFooter className="gap-3 sm:gap-3">
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={groupActionBusy}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={groupActionBusy || !renameInput.trim() || !activeId}
              onClick={async () => {
                if (!activeId) return
                setGroupActionBusy(true)
                const supabase = createBrowserSupabaseClient()
                const renamed = await renameConversation(supabase, activeId, renameInput)
                setGroupActionBusy(false)
                if (renamed.error) {
                  setSendError(renamed.error.message)
                  return
                }
                await refreshList()
                setRenameOpen(false)
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={moveOpen} onOpenChange={(open) => !groupActionBusy && setMoveOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Перенести ученика</DialogTitle>
            <DialogDescription asChild>
              <div className="text-[14px] leading-relaxed text-ds-text-secondary">
                Укажите UUID ученика и UUID целевого группового чата.
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              value={moveStudentInput}
              onChange={(e) => setMoveStudentInput(e.target.value)}
              placeholder="UUID ученика"
              className="h-11 w-full rounded-xl border border-black/10 bg-ds-surface px-3 text-[14px] text-ds-ink outline-none focus:ring-2 focus:ring-ds-ink/15 dark:border-white/15"
            />
            <input
              value={moveTargetConversationInput}
              onChange={(e) => setMoveTargetConversationInput(e.target.value)}
              placeholder="UUID целевого group-чата"
              className="h-11 w-full rounded-xl border border-black/10 bg-ds-surface px-3 text-[14px] text-ds-ink outline-none focus:ring-2 focus:ring-ds-ink/15 dark:border-white/15"
            />
          </div>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button type="button" variant="outline" onClick={() => setMoveOpen(false)} disabled={groupActionBusy}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                groupActionBusy || !moveStudentInput.trim() || !moveTargetConversationInput.trim() || !activeId
              }
              onClick={async () => {
                if (!activeId) return
                setGroupActionBusy(true)
                const supabase = createBrowserSupabaseClient()
                const moved = await moveStudentToAnotherConversation(supabase, {
                  studentId: moveStudentInput.trim(),
                  fromConversationId: activeId,
                  toConversationId: moveTargetConversationInput.trim()
                })
                setGroupActionBusy(false)
                if (moved.error) {
                  setSendError(moved.error.message)
                  return
                }
                const { participants: rows } = await loadConversationParticipants(supabase, activeId)
                setParticipants(rows)
                setMoveOpen(false)
              }}
            >
              Перенести
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
