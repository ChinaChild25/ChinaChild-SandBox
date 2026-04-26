"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, LoaderCircle, Video } from "lucide-react"
import { humanizeDailyError } from "@/lib/daily/errors"
import { useAuth } from "@/lib/auth-context"
import { useUiLocale } from "@/lib/ui-locale"
import { Button } from "@/components/ui/button"
import { VideoRoom } from "@/components/lessons/VideoRoom"

type RoomRequestPayload = {
  lessonId?: string
  scheduleSlotId?: string
}

type LiveRoomResponse = {
  roomUrl?: string
  token?: string
  error?: string
  context?: {
    title?: string
    subtitle?: string | null
  }
}

type DailyCallSessionProps = {
  roomRequest: RoomRequestPayload
  initialTitle: string
  initialSubtitle?: string | null
  backHref: string
  variant?: "page" | "floating"
  onDismiss?: () => void
}

type LessonLiveSessionProps = {
  lessonId: string
  lessonTitle: string
  courseTitle?: string | null
  onDismiss?: () => void
}

function useDailyCallCopy() {
  const { locale } = useUiLocale()

  return useMemo(() => {
    if (locale === "en") {
      return {
        eyebrow: "Lesson call",
        fallbackSubtitle: "Live room",
        loading: "Preparing the call room...",
        retry: "Retry",
        back: "Back",
        defaultError: "Unable to open the call room.",
      }
    }

    if (locale === "zh") {
      return {
        eyebrow: "课堂通话",
        fallbackSubtitle: "直播教室",
        loading: "正在准备通话教室...",
        retry: "重试",
        back: "返回",
        defaultError: "无法打开通话教室。",
      }
    }

    return {
      eyebrow: "Звонок урока",
      fallbackSubtitle: "Онлайн-комната",
      loading: "Готовим комнату для звонка...",
      retry: "Повторить",
      back: "Назад",
      defaultError: "Не удалось открыть комнату звонка.",
    }
  }, [locale])
}

export function DailyCallSession({
  roomRequest,
  initialTitle,
  initialSubtitle,
  backHref,
  variant = "page",
  onDismiss
}: DailyCallSessionProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { locale } = useUiLocale()
  const copy = useDailyCallCopy()
  const [session, setSession] = useState<{ roomUrl: string; token: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [title, setTitle] = useState(initialTitle)
  const [subtitle, setSubtitle] = useState(initialSubtitle?.trim() || "")
  const lessonId = roomRequest.lessonId?.trim() || undefined
  const scheduleSlotId = roomRequest.scheduleSlotId?.trim() || undefined
  const requestKey = `${roomRequest.lessonId ?? ""}::${roomRequest.scheduleSlotId ?? ""}`
  const isFloating = variant === "floating"
  const handleBack = onDismiss ?? (() => router.push(backHref))

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  useEffect(() => {
    setSubtitle(initialSubtitle?.trim() || "")
  }, [initialSubtitle])

  useEffect(() => {
    let cancelled = false

    async function loadRoom() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/create-room", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ lessonId, scheduleSlotId })
        })

        const payload = (await response.json().catch(() => null)) as LiveRoomResponse | null
        if (!response.ok || !payload?.roomUrl || !payload?.token) {
          if (!cancelled) {
            setSession(null)
            setError(humanizeDailyError(payload?.error, locale, copy.defaultError))
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          setSession({ roomUrl: payload.roomUrl, token: payload.token })
          setTitle(payload.context?.title?.trim() || initialTitle)
          setSubtitle(payload.context?.subtitle?.trim() || initialSubtitle?.trim() || "")
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setSession(null)
          setError(copy.defaultError)
          setLoading(false)
        }
      }
    }

    void loadRoom()

    return () => {
      cancelled = true
    }
  }, [attempt, copy.defaultError, initialSubtitle, initialTitle, lessonId, locale, requestKey, scheduleSlotId])

  if (loading || !session) {
    if (isFloating) {
      return (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div className="pointer-events-auto fixed right-3 bottom-3 w-[min(calc(100vw-1.5rem),28rem)] rounded-[28px] bg-[rgba(255,255,255,0.96)] p-5 text-ds-ink shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:right-6 md:bottom-6 dark:bg-[#171717]/96 dark:text-white">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-ds-text-tertiary dark:text-white/45">
              <Video className="h-4 w-4" aria-hidden />
              {copy.eyebrow}
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-ds-ink dark:text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-ds-text-secondary dark:text-white/62">{subtitle || copy.fallbackSubtitle}</p>

            {loading ? (
              <div className="mt-6 flex items-center gap-3 rounded-[24px] bg-black/[0.04] px-4 py-4 text-sm text-ds-text-secondary dark:bg-white/[0.05] dark:text-white/72">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                {copy.loading}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] bg-[#fff4f5] px-4 py-4 text-sm leading-6 text-[#8d4150] dark:bg-[#2a1c21] dark:text-white/72">
                {error ?? copy.defaultError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {!loading ? (
                <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  {copy.retry}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft aria-hidden />
                {copy.back}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-ds-canvas px-4 py-10 text-ds-ink md:px-6 dark:bg-ds-canvas dark:text-white">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[32px] bg-[rgba(255,255,255,0.96)] p-8 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:bg-[#171717]/96">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-ds-text-tertiary dark:text-white/45">
              <Video className="h-4 w-4" aria-hidden />
              {copy.eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-ds-ink dark:text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-ds-text-secondary dark:text-white/62">{subtitle || copy.fallbackSubtitle}</p>

            {loading ? (
              <div className="mt-8 flex items-center gap-3 rounded-[24px] bg-black/[0.04] px-4 py-4 text-sm text-ds-text-secondary dark:bg-white/[0.05] dark:text-white/72">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                {copy.loading}
              </div>
            ) : (
              <div className="mt-8 rounded-[24px] bg-[#fff4f5] px-4 py-4 text-sm leading-6 text-[#8d4150] dark:bg-[#2a1c21] dark:text-white/72">
                {error ?? copy.defaultError}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {!loading ? (
                <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  {copy.retry}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft aria-hidden />
                {copy.back}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <VideoRoom
      roomUrl={session.roomUrl}
      meetingToken={session.token}
      lessonTitle={title}
      courseTitle={subtitle || null}
      displayName={user?.profileFullName || user?.name || undefined}
      onLeave={handleBack}
      variant={variant}
    />
  )
}

export function LessonLiveSession({ lessonId, lessonTitle, courseTitle, onDismiss }: LessonLiveSessionProps) {
  return (
    <DailyCallSession
      roomRequest={{ lessonId }}
      initialTitle={lessonTitle}
      initialSubtitle={courseTitle}
      backHref={`/lesson/${lessonId}`}
      variant="floating"
      onDismiss={onDismiss}
    />
  )
}
