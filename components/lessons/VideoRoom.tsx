"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  ArrowDownRight,
  ArrowUpLeft,
  ChevronsDownUp,
  LoaderCircle,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
  VideoOff,
  Waves,
} from "lucide-react"
import { humanizeDailyError } from "@/lib/daily/errors"
import { useUiLocale } from "@/lib/ui-locale"
import { Button } from "@/components/ui/button"
import { LessonWhiteboard } from "@/components/lessons/lesson-whiteboard"
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
  variant?: "page" | "floating"
}

type FloatingDock = "top-left" | "bottom-right"

const FLOATING_DOCK_STORAGE_KEY = "chinachild-daily-floating-dock"

function isTrackEnabled(track: DailyTrackStateLike | undefined): boolean {
  return track?.state != null && track.state !== "off" && track.state !== "blocked"
}

function prettifyMeetingState(meetingState: string): string {
  if (meetingState === "loading" || meetingState === "joining-meeting") return "connecting"
  if (meetingState === "error") return "error"
  if (meetingState === "joined-meeting") return "joined"
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
        micOff: "Mic muted",
        cameraOn: "Camera on",
        cameraOff: "Camera off",
        screenSharing: "Sharing screen",
        screenIdle: "Screen idle",
        mute: "Mute",
        unmute: "Unmute",
        stopVideo: "Stop video",
        startVideo: "Start video",
        stopScreenShare: "Stop sharing",
        startScreenShare: "Share screen",
        defaultJoinError: "Unable to join the call.",
        callTab: "Call",
        boardTab: "Board",
        collapse: "Collapse",
        returnToCall: "Return to call",
        moveToTopLeft: "Move to top left",
        moveToBottomRight: "Move to bottom right",
        boardHint: "Use the board to sketch characters, tones, or examples while staying in the call.",
        boardLocalHint: "MVP board: this drawing stays in your current browser tab.",
        boardTitle: "Whiteboard",
        boardSubtitle: "A quick shared-workspace style canvas for character practice.",
        pen: "Pen",
        eraser: "Eraser",
        clear: "Clear",
        undo: "Undo",
        thinner: "Thinner stroke",
        thicker: "Thicker stroke",
        gridOn: "Show grid",
        gridOff: "Hide grid",
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
        micOn: "麦克风已开启",
        micOff: "麦克风已关闭",
        cameraOn: "摄像头已开启",
        cameraOff: "摄像头已关闭",
        screenSharing: "正在共享屏幕",
        screenIdle: "未共享屏幕",
        mute: "关闭麦克风",
        unmute: "打开麦克风",
        stopVideo: "关闭摄像头",
        startVideo: "打开摄像头",
        stopScreenShare: "停止共享",
        startScreenShare: "共享屏幕",
        defaultJoinError: "无法加入通话。",
        callTab: "通话",
        boardTab: "白板",
        collapse: "收起",
        returnToCall: "返回通话",
        moveToTopLeft: "移动到左上角",
        moveToBottomRight: "移动到右下角",
        boardHint: "可在通话过程中练习汉字、笔画和临时示意。",
        boardLocalHint: "MVP 白板：当前版本只保存在本浏览器标签页内。",
        boardTitle: "白板",
        boardSubtitle: "一个轻量级练字和示意画布。",
        pen: "画笔",
        eraser: "橡皮",
        clear: "清空",
        undo: "撤销",
        thinner: "变细",
        thicker: "变粗",
        gridOn: "显示网格",
        gridOff: "隐藏网格",
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
      liveNow: "Идёт занятие",
      participantSingle: "участник в комнате",
      participantPlural: "участников в комнате",
      youLabel: "Вы",
      micOn: "Микрофон включён",
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
      callTab: "Звонок",
      boardTab: "Доска",
      collapse: "Свернуть",
      returnToCall: "Вернуться в звонок",
      moveToTopLeft: "Перенести в левый верхний угол",
      moveToBottomRight: "Перенести в правый нижний угол",
      boardHint: "Можно быстро рисовать иероглифы, тоновые схемы и короткие пояснения прямо во время занятия.",
      boardLocalHint: "MVP-доска: рисунок пока сохраняется только в этой вкладке браузера.",
      boardTitle: "Доска",
      boardSubtitle: "Простой холст для иероглифов, стрелок и быстрых объяснений.",
      pen: "Кисть",
      eraser: "Ластик",
      clear: "Очистить",
      undo: "Отменить",
      thinner: "Сделать линию тоньше",
      thicker: "Сделать линию толще",
      gridOn: "Показать сетку",
      gridOff: "Скрыть сетку",
    }
  }, [locale])
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1.5 text-[12px] font-medium text-ds-ink dark:bg-white/[0.09] dark:text-white/80">
      {label}
    </span>
  )
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
        "relative overflow-hidden rounded-[24px] bg-[#111215] shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
        className
      )}
    >
      <DailyVideo
        sessionId={sessionId}
        type={type}
        fit="cover"
        automirror={type !== "screenVideo"}
        className="h-full w-full bg-transparent object-cover"
        playableStyle={{ objectFit: "cover" }}
      />
      {!isVideoEnabled ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#101114]">
          <div className="flex flex-col items-center gap-3 px-6 text-center text-white/82">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <Users className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm font-medium">{copy.fallbackCameraOff}</p>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/75 via-black/20 to-transparent px-4 pb-4 pt-10 text-sm text-white",
          labelClassName
        )}
      >
        <span className="truncate font-medium">{participant?.user_name?.trim() || copy.fallbackGuest}</span>
        {participant?.local ? (
          <span className="rounded-full bg-white/12 px-2 py-1 text-[11px] font-semibold">
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
  onLeave,
  variant = "page"
}: VideoRoomProps) {
  const daily = useDaily()
  const { locale } = useUiLocale()
  const copy = useVideoRoomCopy()
  const meetingState = useMeetingState()
  const localSessionId = useLocalSessionId()
  const localParticipant = useLocalParticipant() as DailyParticipantLike | undefined
  const participantIds = useParticipantIds({ sort: "joined_at" }) ?? []
  const { isSharingScreen, screens, startScreenShare, stopScreenShare } = useScreenShare()
  const isFloating = variant === "floating"
  const [joinAttempt, setJoinAttempt] = useState(0)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [activePanel, setActivePanel] = useState<"call" | "board">("call")
  const [dock, setDock] = useState<FloatingDock>("bottom-right")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const hasInitializedFloatingState = useRef(false)

  useEffect(() => {
    if (!isFloating) return

    const storedDock =
      typeof window !== "undefined" ? window.localStorage.getItem(FLOATING_DOCK_STORAGE_KEY) : null
    if (storedDock === "top-left" || storedDock === "bottom-right") {
      setDock(storedDock)
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const syncCompactState = () => {
      setIsCompactViewport(mediaQuery.matches)
      if (!hasInitializedFloatingState.current) {
        setIsCollapsed(false)
        hasInitializedFloatingState.current = true
      }
    }

    syncCompactState()
    mediaQuery.addEventListener("change", syncCompactState)

    return () => mediaQuery.removeEventListener("change", syncCompactState)
  }, [isFloating])

  useEffect(() => {
    if (!isFloating) return

    const handleReturnToCall = () => {
      setIsCollapsed(false)
      setActivePanel("call")
    }

    window.addEventListener("chinachild:return-to-call", handleReturnToCall)
    return () => window.removeEventListener("chinachild:return-to-call", handleReturnToCall)
  }, [isFloating])

  useEffect(() => {
    if (!isFloating || typeof window === "undefined") return
    window.localStorage.setItem(FLOATING_DOCK_STORAGE_KEY, dock)
  }, [dock, isFloating])

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
  const showLoading =
    meetingState !== "joined-meeting" && meetingState !== "left-meeting" && joinError == null
  const effectiveMeetingState = meetingState ?? "new"
  const meetingStateLabel =
    prettifyMeetingState(effectiveMeetingState) === "connecting"
      ? copy.loadingConnecting
      : prettifyMeetingState(effectiveMeetingState) === "error"
        ? copy.loadingError
        : prettifyMeetingState(effectiveMeetingState) === "joined"
          ? copy.liveNow
          : copy.loadingPreparing
  const participantCountLabel =
    orderedParticipantIds.length === 1 ? copy.participantSingle : copy.participantPlural
  const titleLine = courseTitle?.trim() || copy.fallbackCourseTitle

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

  function toggleDockPosition() {
    setDock((current) => (current === "bottom-right" ? "top-left" : "bottom-right"))
  }

  const floatingPositionClass =
    dock === "bottom-right"
      ? "bottom-3 right-3 md:bottom-6 md:right-6"
      : "left-3 top-[calc(env(safe-area-inset-top)+4.75rem)] md:left-4 lg:left-[calc(280px+2rem)] lg:top-6"

  const shellClassName = cn(
    "overflow-hidden rounded-[28px] bg-[rgba(255,255,255,0.96)] text-ds-ink shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:bg-[#171717]/96 dark:text-white"
  )
  const chromeButtonClass =
    "grid h-10 w-10 place-items-center rounded-full bg-black/[0.05] text-ds-ink transition-colors hover:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12] dark:focus-visible:ring-white/20"
  const tabButtonBase =
    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors"
  const idleTabButtonClass =
    "bg-black/[0.05] text-ds-text-secondary hover:bg-black/[0.08] hover:text-ds-ink dark:bg-white/[0.08] dark:text-white/68 dark:hover:bg-white/[0.12] dark:hover:text-white"
  const activeTabButtonClass =
    "bg-black text-white hover:bg-black/92 dark:bg-white dark:text-black dark:hover:bg-white/92"
  const controlButtonClass =
    "h-auto min-h-11 whitespace-normal rounded-[16px] bg-black/[0.05] px-4 py-3 text-left text-[14px] font-semibold text-ds-ink shadow-none hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12]"

  const callPanel = (
    <div className={cn("min-h-0", isFloating ? "flex min-h-0 flex-col gap-3" : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]")}>
      <section className="min-h-0 space-y-3">
        {activeScreenSessionId ? (
          <ParticipantTile
            sessionId={activeScreenSessionId}
            type="screenVideo"
            className={cn(isFloating ? "h-[220px] sm:h-[240px]" : "h-[48vh] min-h-[320px]")}
            labelClassName="pb-5 pt-16"
          />
        ) : null}

        <div
          className={cn(
            "grid gap-3",
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
              className={cn(
                cameraParticipantIds.length <= 1
                  ? isFloating
                    ? "h-[240px] sm:h-[280px]"
                    : "h-[56vh]"
                  : isFloating
                    ? "h-[160px] sm:h-[180px]"
                    : "h-[28vh] min-h-[220px]"
              )}
            />
          ))}
        </div>
      </section>

      <aside className={cn("flex flex-col gap-3", isFloating && "min-h-0")}>
        <div className="rounded-[24px] bg-black/[0.04] p-4 dark:bg-white/[0.05]">
          <p className="text-[11px] font-medium text-ds-text-tertiary dark:text-white/45">
            {copy.callStatus}
          </p>
          <p className="mt-2 text-lg font-semibold text-ds-ink dark:text-white">{meetingStateLabel}</p>
          <p className="mt-2 text-sm leading-6 text-ds-text-secondary dark:text-white/65">
            {orderedParticipantIds.length} {participantCountLabel}
          </p>
        </div>

        <div className="rounded-[24px] bg-black/[0.04] p-4 dark:bg-white/[0.05]">
          <p className="text-[11px] font-medium text-ds-text-tertiary dark:text-white/45">
            {copy.youLabel}
          </p>
          <p className="mt-2 truncate text-base font-semibold text-ds-ink dark:text-white">
            {displayName?.trim() || copy.fallbackGuest}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill label={isMicEnabled ? copy.micOn : copy.micOff} />
            <StatusPill label={isCameraEnabled ? copy.cameraOn : copy.cameraOff} />
            <StatusPill label={isSharingScreen ? copy.screenSharing : copy.screenIdle} />
          </div>
        </div>

        {!isFloating ? (
          <p className="text-sm leading-6 text-ds-text-secondary dark:text-white/62">{copy.boardHint}</p>
        ) : null}
      </aside>
    </div>
  )

  const boardPanel = (
    <div className={cn("min-h-0", isFloating ? "flex min-h-0 flex-col gap-3" : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]")}>
      <section className="min-h-0 overflow-hidden rounded-[24px] bg-black/[0.04] p-4 dark:bg-white/[0.05]">
        <LessonWhiteboard
          copy={{
            title: copy.boardTitle,
            subtitle: copy.boardSubtitle,
            localHint: copy.boardLocalHint,
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
      </section>

      <aside className="flex flex-col gap-3">
        <div className="rounded-[24px] bg-black/[0.04] p-4 dark:bg-white/[0.05]">
          <div className="flex items-center gap-2 text-[11px] font-medium text-ds-text-tertiary dark:text-white/45">
            <Waves className="h-4 w-4" aria-hidden />
            {copy.callStatus}
          </div>
          <p className="mt-2 text-lg font-semibold text-ds-ink dark:text-white">{meetingStateLabel}</p>
          <p className="mt-2 text-sm leading-6 text-ds-text-secondary dark:text-white/65">
            {orderedParticipantIds.length} {participantCountLabel}
          </p>
        </div>

        <div className="rounded-[24px] bg-black/[0.04] p-4 dark:bg-white/[0.05]">
          <p className="text-sm leading-6 text-ds-text-secondary dark:text-white/65">{copy.boardHint}</p>
        </div>

        <div className="rounded-[24px] bg-black/[0.04] p-4 dark:bg-white/[0.05]">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={isMicEnabled ? copy.micOn : copy.micOff} />
            <StatusPill label={isCameraEnabled ? copy.cameraOn : copy.cameraOff} />
            <StatusPill label={isSharingScreen ? copy.screenSharing : copy.screenIdle} />
          </div>
        </div>
      </aside>
    </div>
  )

  const contentPanel = showLoading ? (
    <div
      className={cn(
        "flex min-h-[260px] items-center justify-center rounded-[24px] bg-black/[0.04] px-6 py-10 dark:bg-white/[0.05]",
        !isFloating && "min-h-[60vh]"
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <LoaderCircle className="h-10 w-10 animate-spin text-ds-ink dark:text-white/85" aria-hidden />
        <div className="space-y-1">
          <p className="text-lg font-semibold text-ds-ink dark:text-white">{meetingStateLabel}</p>
          <p className="text-sm leading-6 text-ds-text-secondary dark:text-white/62">{copy.keepTabOpen}</p>
        </div>
      </div>
    </div>
  ) : joinError ? (
    <div
      className={cn(
        "flex min-h-[260px] items-center justify-center rounded-[24px] bg-[#fff4f5] p-6 text-left shadow-[inset_0_0_0_1px_rgba(155,57,72,0.08)] dark:bg-[#2a1c21]",
        !isFloating && "min-h-[60vh]"
      )}
    >
      <div className="w-full max-w-xl">
        <p className="text-sm font-medium text-[#b15462] dark:text-[#ffb6c3]">{copy.errorEyebrow}</p>
        <h2 className="mt-3 text-2xl font-semibold text-[#7e2031] dark:text-white">{copy.errorTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-[#8d4150] dark:text-white/72">{joinError}</p>
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
  ) : activePanel === "call" ? callPanel : boardPanel

  const controlBar = (
    <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
      <Button type="button" className={controlButtonClass} onClick={handleToggleAudio} disabled={isBusy}>
        {isMicEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
        {isMicEnabled ? copy.mute : copy.unmute}
      </Button>
      <Button type="button" className={controlButtonClass} onClick={handleToggleVideo} disabled={isBusy}>
        {isCameraEnabled ? <Video aria-hidden /> : <VideoOff aria-hidden />}
        {isCameraEnabled ? copy.stopVideo : copy.startVideo}
      </Button>
      <Button type="button" className={cn(controlButtonClass, "min-[480px]:col-span-2")} onClick={handleToggleScreenShare} disabled={isBusy}>
        <MonitorUp aria-hidden />
        {isSharingScreen ? copy.stopScreenShare : copy.startScreenShare}
      </Button>
    </div>
  )

  if (isFloating && isCollapsed) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50">
        <DailyAudio />
        <div className={cn("pointer-events-auto fixed", floatingPositionClass)}>
          <div className="flex items-center gap-2 rounded-full bg-black px-2 py-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
              onClick={() => setIsCollapsed(false)}
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
              {copy.returnToCall}
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              onClick={toggleDockPosition}
              aria-label={dock === "bottom-right" ? copy.moveToTopLeft : copy.moveToBottomRight}
            >
              {dock === "bottom-right" ? <ArrowUpLeft className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isFloating) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50">
        <DailyAudio />
        <section
          className={cn(
            "pointer-events-auto fixed flex w-[min(calc(100vw-1.5rem),30rem)] flex-col",
            "max-h-[calc(100vh-1.5rem)] min-h-[24rem] md:w-[28rem]",
            floatingPositionClass
          )}
        >
          <div className={cn(shellClassName, "flex min-h-0 flex-1 flex-col p-4 sm:p-5")}>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-ds-text-tertiary dark:text-white/45">
                  {titleLine}
                </p>
                <h1 className="mt-1 text-lg font-semibold text-ds-ink dark:text-white">{lessonTitle}</h1>
                <p className="mt-1 text-sm text-ds-text-secondary dark:text-white/62">{meetingStateLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={chromeButtonClass}
                  onClick={toggleDockPosition}
                  aria-label={dock === "bottom-right" ? copy.moveToTopLeft : copy.moveToBottomRight}
                >
                  {dock === "bottom-right" ? <ArrowUpLeft className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
                </button>
                <button
                  type="button"
                  className={chromeButtonClass}
                  onClick={() => setIsCollapsed(true)}
                  aria-label={copy.collapse}
                >
                  <ChevronsDownUp className="h-4 w-4" aria-hidden />
                </button>
                <Button type="button" variant="destructive" size="sm" className="rounded-full px-4" onClick={handleLeave} disabled={isBusy}>
                  <PhoneOff aria-hidden />
                  {copy.leaveLesson}
                </Button>
              </div>
            </header>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(tabButtonBase, activePanel === "call" ? activeTabButtonClass : idleTabButtonClass)}
                onClick={() => setActivePanel("call")}
              >
                <Video className="h-4 w-4" aria-hidden />
                {copy.callTab}
              </button>
              <button
                type="button"
                className={cn(tabButtonBase, activePanel === "board" ? activeTabButtonClass : idleTabButtonClass)}
                onClick={() => setActivePanel("board")}
              >
                <Waves className="h-4 w-4" aria-hidden />
                {copy.boardTab}
              </button>
            </div>

            <div className={cn("mt-4 min-h-0 flex-1 overflow-y-auto", isCompactViewport && "pb-1")}>
              {contentPanel}
            </div>

            <div className="mt-4">{controlBar}</div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ds-canvas text-ds-ink dark:bg-ds-canvas dark:text-white">
      <DailyAudio />

      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
        <section className={cn(shellClassName, "flex min-h-screen flex-col p-4 md:p-6")}>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ds-text-tertiary dark:text-white/45">
                {titleLine}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-ds-ink dark:text-white md:text-3xl">{lessonTitle}</h1>
            </div>
            <Button type="button" variant="destructive" size="sm" className="rounded-full px-4" onClick={handleLeave} disabled={isBusy}>
              <PhoneOff aria-hidden />
              {copy.leaveLesson}
            </Button>
          </header>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(tabButtonBase, activePanel === "call" ? activeTabButtonClass : idleTabButtonClass)}
              onClick={() => setActivePanel("call")}
            >
              <Video className="h-4 w-4" aria-hidden />
              {copy.callTab}
            </button>
            <button
              type="button"
              className={cn(tabButtonBase, activePanel === "board" ? activeTabButtonClass : idleTabButtonClass)}
              onClick={() => setActivePanel("board")}
            >
              <Waves className="h-4 w-4" aria-hidden />
              {copy.boardTab}
            </button>
          </div>

          <div className="mt-5 flex-1">{contentPanel}</div>

          <div className="mt-5">{controlBar}</div>
        </section>
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
