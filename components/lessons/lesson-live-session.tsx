"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, LoaderCircle, Video } from "lucide-react"
import { humanizeDailyError } from "@/lib/daily/errors"
import { useAuth } from "@/lib/auth-context"
import { useUiLocale } from "@/lib/ui-locale"
import { Button } from "@/components/ui/button"
import { LessonWhiteboard } from "@/components/lessons/lesson-whiteboard"
import { VideoRoom } from "@/components/lessons/VideoRoom"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type RoomRequestPayload = {
  lessonId?: string
  scheduleSlotId?: string
}

type LiveRoomResponse = {
  roomUrl?: string
  token?: string
  sessionId?: string
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
        boardPreview: "Open board",
        boardPreviewTitle: "Lesson board",
        boardPreviewSubtitle: "A local MVP canvas to test handwriting and quick explanations without joining the call.",
        boardPreviewHint: "This preview board is local to your current browser tab.",
        pen: "Pen",
        eraser: "Eraser",
        clear: "Clear",
        undo: "Undo",
        thinner: "Thinner stroke",
        thicker: "Thicker stroke",
        gridOn: "Show grid",
        gridOff: "Hide grid",
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
        boardPreview: "打开白板",
        boardPreviewTitle: "课堂白板",
        boardPreviewSubtitle: "一个本地 MVP 画布，可以在不进入通话时先测试书写和示意。",
        boardPreviewHint: "当前预览白板只保存在本浏览器标签页内。",
        pen: "画笔",
        eraser: "橡皮",
        clear: "清空",
        undo: "撤销",
        thinner: "变细",
        thicker: "变粗",
        gridOn: "显示网格",
        gridOff: "隐藏网格",
        defaultError: "无法打开通话教室。",
      }
    }

    return {
      eyebrow: "Звонок урока",
      fallbackSubtitle: "Онлайн-комната",
      loading: "Готовим комнату для звонка...",
      retry: "Повторить",
      back: "Назад",
      boardPreview: "Открыть доску",
      boardPreviewTitle: "Доска урока",
      boardPreviewSubtitle: "Локальный MVP-холст: можно проверить письмо и быстрые объяснения даже без входа в звонок.",
      boardPreviewHint: "Эта тестовая доска работает локально только в текущей вкладке браузера.",
      pen: "Кисть",
      eraser: "Ластик",
      clear: "Очистить",
      undo: "Отменить",
      thinner: "Сделать линию тоньше",
      thicker: "Сделать линию толще",
      gridOn: "Показать сетку",
      gridOff: "Скрыть сетку",
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
  const [session, setSession] = useState<{ roomUrl: string; token: string; sessionId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [title, setTitle] = useState(initialTitle)
  const [subtitle, setSubtitle] = useState(initialSubtitle?.trim() || "")
  const [isBoardPreviewOpen, setIsBoardPreviewOpen] = useState(false)
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
        if (!response.ok || !payload?.roomUrl || !payload?.token || !payload?.sessionId) {
          if (!cancelled) {
            setSession(null)
            setError(humanizeDailyError(payload?.error, locale, copy.defaultError))
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          setSession({ roomUrl: payload.roomUrl, token: payload.token, sessionId: payload.sessionId })
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
        <>
          <div className="pointer-events-none fixed inset-0 z-50">
            <div className="pointer-events-auto fixed right-3 bottom-3 w-[min(calc(100vw-1.5rem),28rem)] rounded-[28px] bg-[rgba(255,255,255,0.96)] p-5 text-ds-ink shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:right-6 md:bottom-6 dark:bg-[#171717]/96 dark:text-white">
              <div className="flex items-center gap-3 text-sm font-medium text-ds-text-tertiary dark:text-white/45">
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
                  <>
                    <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                      {copy.retry}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsBoardPreviewOpen(true)}>
                      {copy.boardPreview}
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft aria-hidden />
                  {copy.back}
                </Button>
              </div>
            </div>
          </div>

          <Sheet open={isBoardPreviewOpen} onOpenChange={setIsBoardPreviewOpen}>
            <SheetContent
              side="right"
              className="flex h-full w-full flex-col gap-0 border-l border-black/10 bg-[var(--ds-surface)] p-0 sm:max-w-[720px] dark:border-white/10 dark:bg-[#141414]"
              sheetTitle={copy.boardPreviewTitle}
              sheetDescription={copy.boardPreviewSubtitle}
            >
              <SheetHeader className="border-b border-black/8 px-5 py-4 dark:border-white/8">
                <SheetTitle>{copy.boardPreviewTitle}</SheetTitle>
                <SheetDescription>{copy.boardPreviewSubtitle}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 p-5">
                <LessonWhiteboard
                  copy={{
                    title: copy.boardPreviewTitle,
                    subtitle: copy.boardPreviewSubtitle,
                    localHint: copy.boardPreviewHint,
                    pen: copy.pen,
                    eraser: copy.eraser,
                    clear: copy.clear,
                    undo: copy.undo,
                    thinner: copy.thinner,
                    thicker: copy.thicker,
                    gridOn: copy.gridOn,
                    gridOff: copy.gridOff,
                  }}
                  className="h-full"
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )
    }

    return (
      <div className="min-h-screen bg-ds-canvas px-4 py-10 text-ds-ink md:px-6 dark:bg-ds-canvas dark:text-white">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[32px] bg-[rgba(255,255,255,0.96)] p-8 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:bg-[#171717]/96">
            <div className="flex items-center gap-3 text-sm font-medium text-ds-text-tertiary dark:text-white/45">
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
      sessionId={session.sessionId}
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
