"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DailyAudio,
  DailyProvider,
  DailyVideo,
  useCallObject,
  useDaily,
  useLocalParticipant,
  useLocalSessionId,
  useMeetingState,
  useParticipant,
  useParticipantIds,
  useScreenShare,
} from "@daily-co/daily-react"
import {
  LoaderCircle,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DailyTrackStateLike = {
  state?: string | null
}

type DailyParticipantLike = {
  local?: boolean
  user_name?: string | null
  tracks?: {
    audio?: DailyTrackStateLike
    video?: DailyTrackStateLike
    screenVideo?: DailyTrackStateLike
  }
}

type VideoRoomProps = {
  roomUrl: string
  meetingToken: string
  lessonTitle: string
  courseTitle?: string | null
  displayName?: string
  onLeave?: () => void
}

function isTrackEnabled(track: DailyTrackStateLike | undefined): boolean {
  return track?.state != null && track.state !== "off" && track.state !== "blocked"
}

function prettifyMeetingState(meetingState: string): string {
  if (meetingState === "loading" || meetingState === "joining-meeting") return "Connecting to the lesson room..."
  if (meetingState === "error") return "The lesson call ran into an error."
  return "Preparing the lesson room..."
}

function ParticipantTile({
  sessionId,
  type = "video",
  className,
  labelClassName
}: {
  sessionId: string
  type?: "video" | "screenVideo"
  className?: string
  labelClassName?: string
}) {
  const participant = (useParticipant(sessionId) as DailyParticipantLike | undefined) ?? undefined
  const isVideoEnabled =
    type === "screenVideo"
      ? isTrackEnabled(participant?.tracks?.screenVideo)
      : isTrackEnabled(participant?.tracks?.video)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <DailyVideo
        sessionId={sessionId}
        type={type}
        fit="cover"
        automirror
        className="h-full w-full bg-transparent object-cover"
        playableStyle={{ objectFit: "cover" }}
      />
      {!isVideoEnabled ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1225]">
          <div className="flex flex-col items-center gap-3 text-white/80">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <Users className="h-7 w-7" aria-hidden />
            </div>
            <p className="text-sm font-medium">Camera is off</p>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-4 pt-10 text-sm text-white",
          labelClassName
        )}
      >
        <span className="truncate font-medium">{participant?.user_name?.trim() || "Guest"}</span>
        {participant?.local ? (
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
            You
          </span>
        ) : null}
      </div>
    </div>
  )
}

function VideoRoomInner({
  roomUrl,
  meetingToken,
  lessonTitle,
  courseTitle,
  displayName,
  onLeave
}: VideoRoomProps) {
  const daily = useDaily()
  const meetingState = useMeetingState()
  const localSessionId = useLocalSessionId()
  const localParticipant = useLocalParticipant() as DailyParticipantLike | undefined
  const participantIds = useParticipantIds({ sort: "joined_at" }) ?? []
  const { isSharingScreen, screens, startScreenShare, stopScreenShare } = useScreenShare()
  const [joinAttempt, setJoinAttempt] = useState(0)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!daily) return
    const call = daily

    let cancelled = false

    async function joinRoom() {
      setJoinError(null)
      try {
        await call.join({
          url: roomUrl,
          token: meetingToken,
          userName: displayName
        })
      } catch (error) {
        if (!cancelled) {
          setJoinError(error instanceof Error ? error.message : "Unable to join the lesson call.")
        }
      }
    }

    void joinRoom()

    return () => {
      cancelled = true
      void call.leave().catch(() => undefined)
    }
  }, [daily, displayName, joinAttempt, meetingToken, roomUrl])

  const orderedParticipantIds = useMemo(() => {
    const ids = [...participantIds].filter((value): value is string => typeof value === "string" && value.length > 0)
    if (!localSessionId) return ids
    return ids.sort((left, right) => {
      if (left === localSessionId) return -1
      if (right === localSessionId) return 1
      return left.localeCompare(right)
    })
  }, [localSessionId, participantIds])

  const activeScreenSessionId = screens[0]?.session_id ?? null
  const cameraParticipantIds = orderedParticipantIds.filter((sessionId) => sessionId !== activeScreenSessionId)
  const isMicEnabled = isTrackEnabled(localParticipant?.tracks?.audio)
  const isCameraEnabled = isTrackEnabled(localParticipant?.tracks?.video)

  async function runAction(action: () => unknown | Promise<unknown>) {
    if (isBusy) return
    setIsBusy(true)
    try {
      await Promise.resolve(action())
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to update the lesson call.")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleToggleAudio() {
    if (!daily) return
    await runAction(() => daily.setLocalAudio(!isMicEnabled))
  }

  async function handleToggleVideo() {
    if (!daily) return
    await runAction(() => daily.setLocalVideo(!isCameraEnabled))
  }

  async function handleToggleScreenShare() {
    await runAction(() => (isSharingScreen ? stopScreenShare() : startScreenShare()))
  }

  async function handleLeave() {
    if (!daily) {
      onLeave?.()
      return
    }

    await runAction(async () => {
      await daily.leave()
      onLeave?.()
    })
  }

  const showLoading =
    meetingState !== "joined-meeting" && meetingState !== "left-meeting" && joinError == null
  const effectiveMeetingState = meetingState ?? "new"

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <DailyAudio />

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050816]/90 px-4 py-4 backdrop-blur lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm uppercase tracking-[0.24em] text-white/45">
                {courseTitle?.trim() || "Live Lesson"}
              </p>
              <h1 className="truncate text-xl font-semibold text-white lg:text-2xl">{lessonTitle}</h1>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-full px-4"
              onClick={handleLeave}
              disabled={isBusy}
            >
              <PhoneOff aria-hidden />
              Leave lesson
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6">
          {showLoading ? (
            <div className="flex h-[calc(100vh-11rem)] items-center justify-center rounded-[32px] border border-white/10 bg-white/[0.04]">
              <div className="flex flex-col items-center gap-4 text-center">
                <LoaderCircle className="h-10 w-10 animate-spin text-white/85" aria-hidden />
                <div className="space-y-1">
                  <p className="text-lg font-medium">{prettifyMeetingState(effectiveMeetingState)}</p>
                  <p className="text-sm text-white/55">Please keep this tab open while we connect the call.</p>
                </div>
              </div>
            </div>
          ) : null}

          {joinError ? (
            <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-xl items-center justify-center">
              <div className="w-full rounded-[32px] border border-[#8f4355] bg-[#2a1520] p-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <p className="text-sm uppercase tracking-[0.22em] text-[#ff9db1]">Lesson call unavailable</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">We couldn&apos;t open the Daily room.</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">{joinError}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setJoinAttempt((value) => value + 1)}>
                    Retry
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onLeave?.()}>
                    Back to lesson
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {!showLoading && !joinError ? (
            <div className="grid min-h-[calc(100vh-11rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-h-[60vh] space-y-4">
                {activeScreenSessionId ? (
                  <ParticipantTile
                    sessionId={activeScreenSessionId}
                    type="screenVideo"
                    className="h-[48vh] min-h-[320px]"
                    labelClassName="pb-5 pt-16"
                  />
                ) : null}

                <div
                  className={cn(
                    "grid gap-4",
                    cameraParticipantIds.length <= 1
                      ? "grid-cols-1"
                      : cameraParticipantIds.length === 2
                        ? "grid-cols-1 md:grid-cols-2"
                        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  )}
                >
                  {cameraParticipantIds.map((sessionId) => (
                    <ParticipantTile
                      key={sessionId}
                      sessionId={sessionId}
                      className={cn(cameraParticipantIds.length <= 1 ? "h-[56vh]" : "h-[28vh] min-h-[220px]")}
                    />
                  ))}
                </div>
              </section>

              <aside className="flex flex-col justify-between gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-4 lg:p-5">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">Call status</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {effectiveMeetingState === "joined-meeting" ? "Live now" : prettifyMeetingState(effectiveMeetingState)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      {orderedParticipantIds.length} participant{orderedParticipantIds.length === 1 ? "" : "s"} connected
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">You</p>
                    <p className="mt-2 truncate text-lg font-medium text-white">{displayName?.trim() || "Guest"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {isMicEnabled ? "Mic on" : "Mic off"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {isCameraEnabled ? "Camera on" : "Camera off"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {isSharingScreen ? "Sharing screen" : "Screen idle"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant={isMicEnabled ? "secondary" : "destructive"} onClick={handleToggleAudio} disabled={isBusy}>
                    {isMicEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
                    {isMicEnabled ? "Mute" : "Unmute"}
                  </Button>
                  <Button type="button" variant={isCameraEnabled ? "secondary" : "destructive"} onClick={handleToggleVideo} disabled={isBusy}>
                    {isCameraEnabled ? <Video aria-hidden /> : <VideoOff aria-hidden />}
                    {isCameraEnabled ? "Stop video" : "Start video"}
                  </Button>
                  <Button type="button" variant={isSharingScreen ? "default" : "outline"} onClick={handleToggleScreenShare} disabled={isBusy} className="col-span-2">
                    <MonitorUp aria-hidden />
                    {isSharingScreen ? "Stop screen share" : "Share screen"}
                  </Button>
                </div>
              </aside>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}

export function VideoRoom(props: VideoRoomProps) {
  const callObject = useCallObject({})

  return (
    <DailyProvider callObject={callObject}>
      <VideoRoomInner {...props} />
    </DailyProvider>
  )
}
