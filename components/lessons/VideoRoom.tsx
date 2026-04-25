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
import { humanizeDailyError } from "@/lib/daily/errors"
import { useUiLocale } from "@/lib/ui-locale"
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
  if (meetingState === "loading" || meetingState === "joining-meeting") return "connecting"
  if (meetingState === "error") return "error"
  return "preparing"
}

function useVideoRoomCopy() {
  const { locale } = useUiLocale()

  return useMemo(() => {
    if (locale === "en") {
      return {
        fallbackCourseTitle: "Live lesson",
        fallbackGuest: "Guest",
        fallbackCameraOff: "Camera is off",
        localBadge: "You",
        leaveLesson: "Leave lesson",
        loadingConnecting: "Connecting to the call...",
        loadingPreparing: "Preparing the call room...",
        loadingError: "The call ran into an error.",
        keepTabOpen: "Please keep this tab open while we connect the call.",
        errorEyebrow: "Lesson call unavailable",
        errorTitle: "We couldn't open the call room.",
        retry: "Retry",
        back: "Back",
        callStatus: "Call status",
        liveNow: "Live now",
        participantSingle: "participant connected",
        participantPlural: "participants connected",
        youLabel: "You",
        micOn: "Mic on",
        micOff: "Mic off",
        cameraOn: "Camera on",
        cameraOff: "Camera off",
        screenSharing: "Sharing screen",
        screenIdle: "Screen idle",
        mute: "Mute",
        unmute: "Unmute",
        stopVideo: "Stop video",
        startVideo: "Start video",
        stopScreenShare: "Stop screen share",
        startScreenShare: "Share screen",
        defaultJoinError: "Unable to join the call.",
      }
    }

    if (locale === "zh") {
      return {
        fallbackCourseTitle: "直播课堂",
        fallbackGuest: "访客",
        fallbackCameraOff: "摄像头已关闭",
        localBadge: "你",
        leaveLesson: "离开课堂",
        loadingConnecting: "正在连接通话...",
        loadingPreparing: "正在准备通话教室...",
        loadingError: "通话出现错误。",
        keepTabOpen: "连接通话期间请保持此页面打开。",
        errorEyebrow: "课堂通话不可用",
        errorTitle: "无法打开通话教室。",
        retry: "重试",
        back: "返回",
        callStatus: "通话状态",
        liveNow: "通话中",
        participantSingle: "位参与者在线",
        participantPlural: "位参与者在线",
        youLabel: "你",
        micOn: "麦克风开启",
        micOff: "麦克风关闭",
        cameraOn: "摄像头开启",
        cameraOff: "摄像头关闭",
        screenSharing: "正在共享屏幕",
        screenIdle: "未共享屏幕",
        mute: "静音",
        unmute: "取消静音",
        stopVideo: "关闭视频",
        startVideo: "开启视频",
        stopScreenShare: "停止共享",
        startScreenShare: "共享屏幕",
        defaultJoinError: "无法加入通话。",
      }
    }

    return {
      fallbackCourseTitle: "Онлайн-занятие",
      fallbackGuest: "Гость",
      fallbackCameraOff: "Камера выключена",
      localBadge: "Вы",
      leaveLesson: "Выйти из урока",
      loadingConnecting: "Подключаем звонок...",
      loadingPreparing: "Готовим комнату звонка...",
      loadingError: "Во время подключения произошла ошибка.",
      keepTabOpen: "Не закрывайте вкладку, пока подключается звонок.",
      errorEyebrow: "Звонок недоступен",
      errorTitle: "Не удалось открыть комнату звонка.",
      retry: "Повторить",
      back: "Назад к уроку",
      callStatus: "Статус звонка",
      liveNow: "Идет занятие",
      participantSingle: "участник в комнате",
      participantPlural: "участников в комнате",
      youLabel: "Вы",
      micOn: "Микрофон включен",
      micOff: "Микрофон выключен",
      cameraOn: "Камера включена",
      cameraOff: "Камера выключена",
      screenSharing: "Экран транслируется",
      screenIdle: "Экран не транслируется",
      mute: "Выключить микрофон",
      unmute: "Включить микрофон",
      stopVideo: "Выключить камеру",
      startVideo: "Включить камеру",
      stopScreenShare: "Остановить показ экрана",
      startScreenShare: "Показать экран",
      defaultJoinError: "Не удалось подключиться к звонку.",
    }
  }, [locale])
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
  const copy = useVideoRoomCopy()
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
            <p className="text-sm font-medium">{copy.fallbackCameraOff}</p>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-4 pt-10 text-sm text-white",
          labelClassName
        )}
      >
        <span className="truncate font-medium">{participant?.user_name?.trim() || copy.fallbackGuest}</span>
        {participant?.local ? (
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
            {copy.localBadge}
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
  const { locale } = useUiLocale()
  const copy = useVideoRoomCopy()
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
    const handleError = (event: unknown) => {
      if (!cancelled) {
        setJoinError(humanizeDailyError(event, locale, copy.defaultJoinError))
      }
    }

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
          setJoinError(humanizeDailyError(error, locale, copy.defaultJoinError))
        }
      }
    }

    call.on("error", handleError)
    call.on("camera-error", handleError)
    call.on("nonfatal-error", handleError)
    void joinRoom()

    return () => {
      cancelled = true
      call.off("error", handleError)
      call.off("camera-error", handleError)
      call.off("nonfatal-error", handleError)
      void call.leave().catch(() => undefined)
    }
  }, [copy.defaultJoinError, daily, displayName, joinAttempt, locale, meetingToken, roomUrl])

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
      setJoinError(humanizeDailyError(error, locale, copy.defaultJoinError))
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
  const meetingStateLabel =
    prettifyMeetingState(effectiveMeetingState) === "connecting"
      ? copy.loadingConnecting
      : prettifyMeetingState(effectiveMeetingState) === "error"
        ? copy.loadingError
        : copy.loadingPreparing
  const participantCountLabel =
    orderedParticipantIds.length === 1 ? copy.participantSingle : copy.participantPlural

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <DailyAudio />

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050816]/90 px-4 py-4 backdrop-blur lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm uppercase tracking-[0.24em] text-white/45">
                {courseTitle?.trim() || copy.fallbackCourseTitle}
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
              {copy.leaveLesson}
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6">
          {showLoading ? (
            <div className="flex h-[calc(100vh-11rem)] items-center justify-center rounded-[32px] border border-white/10 bg-white/[0.04]">
              <div className="flex flex-col items-center gap-4 text-center">
                <LoaderCircle className="h-10 w-10 animate-spin text-white/85" aria-hidden />
                <div className="space-y-1">
                  <p className="text-lg font-medium">{meetingStateLabel}</p>
                  <p className="text-sm text-white/55">{copy.keepTabOpen}</p>
                </div>
              </div>
            </div>
          ) : null}

          {joinError ? (
            <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-xl items-center justify-center">
              <div className="w-full rounded-[32px] border border-[#8f4355] bg-[#2a1520] p-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <p className="text-sm uppercase tracking-[0.22em] text-[#ff9db1]">{copy.errorEyebrow}</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{copy.errorTitle}</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">{joinError}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setJoinAttempt((value) => value + 1)}>
                    {copy.retry}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onLeave?.()}>
                    {copy.back}
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
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">{copy.callStatus}</p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {effectiveMeetingState === "joined-meeting" ? copy.liveNow : meetingStateLabel}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      {orderedParticipantIds.length} {participantCountLabel}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">{copy.youLabel}</p>
                    <p className="mt-2 truncate text-lg font-medium text-white">{displayName?.trim() || copy.fallbackGuest}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {isMicEnabled ? copy.micOn : copy.micOff}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {isCameraEnabled ? copy.cameraOn : copy.cameraOff}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {isSharingScreen ? copy.screenSharing : copy.screenIdle}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant={isMicEnabled ? "secondary" : "destructive"} onClick={handleToggleAudio} disabled={isBusy}>
                    {isMicEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
                    {isMicEnabled ? copy.mute : copy.unmute}
                  </Button>
                  <Button type="button" variant={isCameraEnabled ? "secondary" : "destructive"} onClick={handleToggleVideo} disabled={isBusy}>
                    {isCameraEnabled ? <Video aria-hidden /> : <VideoOff aria-hidden />}
                    {isCameraEnabled ? copy.stopVideo : copy.startVideo}
                  </Button>
                  <Button type="button" variant={isSharingScreen ? "default" : "outline"} onClick={handleToggleScreenShare} disabled={isBusy} className="col-span-2">
                    <MonitorUp aria-hidden />
                    {isSharingScreen ? copy.stopScreenShare : copy.startScreenShare}
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
