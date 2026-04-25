"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, LoaderCircle, Video } from "lucide-react"
import { VideoRoom } from "@/components/lessons/VideoRoom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

type LiveRoomResponse = {
  roomUrl?: string
  token?: string
  error?: string
}

type Props = {
  lessonId: string
  lessonTitle: string
  courseTitle?: string | null
}

export function LessonLiveSession({ lessonId, lessonTitle, courseTitle }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [session, setSession] = useState<{ roomUrl: string; token: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

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
          body: JSON.stringify({ lessonId })
        })

        const payload = (await response.json().catch(() => null)) as LiveRoomResponse | null
        if (!response.ok || !payload?.roomUrl || !payload?.token) {
          if (!cancelled) {
            setSession(null)
            setError(payload?.error ?? "Unable to load the lesson room.")
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          setSession({ roomUrl: payload.roomUrl, token: payload.token })
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setSession(null)
          setError("Unable to load the lesson room.")
          setLoading(false)
        }
      }
    }

    void loadRoom()

    return () => {
      cancelled = true
    }
  }, [attempt, lessonId])

  if (loading || !session) {
    return (
      <div className="-mx-[0.875rem] -my-[0.875rem] min-h-screen bg-[#050816] px-4 py-10 text-white md:-m-10 lg:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-white/45">
              <Video className="h-4 w-4" aria-hidden />
              Lesson call
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">{lessonTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">{courseTitle?.trim() || "Daily room"}</p>

            {loading ? (
              <div className="mt-8 flex items-center gap-3 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/75">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                Preparing your room...
              </div>
            ) : (
              <div className="mt-8 rounded-[24px] border border-[#8f4355] bg-[#2a1520] px-4 py-4 text-sm leading-6 text-white/75">
                {error ?? "Unable to load the lesson room."}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {!loading ? (
                <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  Retry room setup
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => router.push(`/lesson/${lessonId}`)}>
                <ArrowLeft aria-hidden />
                Back to lesson
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
        lessonTitle={lessonTitle}
        courseTitle={courseTitle}
        displayName={user?.profileFullName || user?.name || undefined}
        onLeave={() => router.push(`/lesson/${lessonId}`)}
      />
    </div>
  )
}
