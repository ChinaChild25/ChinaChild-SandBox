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
}

type LessonLiveSessionProps = {
  lessonId: string
  lessonTitle: string
  courseTitle?: string | null
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
  backHref
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
    return (
      <div className="-mx-[0.875rem] -my-[0.875rem] min-h-screen bg-[#050816] px-4 py-10 text-white md:-m-10 lg:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-white/45">
              <Video className="h-4 w-4" aria-hidden />
              {copy.eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">{subtitle || copy.fallbackSubtitle}</p>

            {loading ? (
              <div className="mt-8 flex items-center gap-3 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/75">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                {copy.loading}
              </div>
            ) : (
              <div className="mt-8 rounded-[24px] border border-[#8f4355] bg-[#2a1520] px-4 py-4 text-sm leading-6 text-white/75">
                {error ?? copy.defaultError}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {!loading ? (
                <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  {copy.retry}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
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
    <div className="-mx-[0.875rem] -my-[0.875rem] md:-m-10">
      <VideoRoom
        roomUrl={session.roomUrl}
        meetingToken={session.token}
        lessonTitle={title}
        courseTitle={subtitle || null}
        displayName={user?.profileFullName || user?.name || undefined}
        onLeave={() => router.push(backHref)}
      />
    </div>
  )
}

export function LessonLiveSession({ lessonId, lessonTitle, courseTitle }: LessonLiveSessionProps) {
  return (
    <DailyCallSession
      roomRequest={{ lessonId }}
      initialTitle={lessonTitle}
      initialSubtitle={courseTitle}
      backHref={`/lesson/${lessonId}`}
    />
  )
}
