"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Headphones, ImageIcon, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { TeacherLessonBlock } from "@/lib/types"
import {
  asRecord,
  asString,
  ensureLessonHasHeroBlock,
  extractBracketAnswers,
  getNormalizedBlockSubtitle,
  normalizeTeacherLessonBlock
} from "@/lib/lesson-builder-blocks"
import { BLOCK_ICON_REGISTRY } from "@/components/lesson-builder/block-registry"
import { BlockRenderer, evaluateBlockAssessment, type BlockAssessment, type LessonResponseState } from "@/components/lesson-builder/block-renderer"
import { getLessonBlockDisplayTitle } from "@/lib/lesson-block-display"
import { courseAccentForTheme, courseAccentFromCourse } from "@/lib/teacher-custom-course-form"
import { useUiLocale } from "@/lib/ui-locale"
import { cn } from "@/lib/utils"

type Props = {
  lessonId: string
  lessonTitle: string
  courseTitle?: string
  courseCoverColor?: string
  courseCoverStyle?: string
  courseCoverImageUrl?: string
  backHref: string
  backLabel: string
  blocks: TeacherLessonBlock[]
}

type LessonSection = {
  id: string
  label: string
  summary: string
  block: TeacherLessonBlock
  Icon: LucideIcon
  index: number
}

type PersistedLessonProgress = {
  completed: boolean
  scorePercent: number | null
  answeredCount: number
  totalCount: number
}

type PersistedSectionProgress = Record<string, { visited: boolean; completed: boolean }>

function pluralizeRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function sectionSummary(block: TeacherLessonBlock) {
  const data = asRecord(block.data)

  if (block.type === "text") {
    const items = Array.isArray(asRecord(data.text).items) ? (asRecord(data.text).items as unknown[]) : []
    const questionCount = items.reduce<number>((total, item) => {
      const questions = Array.isArray(asRecord(item).questions) ? (asRecord(item).questions as unknown[]) : []
      return total + questions.length
    }, 0)
    return questionCount > 0 ? `${questionCount} ${pluralizeRu(questionCount, "вопрос", "вопроса", "вопросов")}` : "Текстовый материал"
  }

  if (block.type === "audio") {
    const items = asRecord(data.audio).items
    const count = Array.isArray(items) ? items.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "трек", "трека", "треков")}` : "Аудиопрактика"
  }

  if (block.type === "flashcards") {
    const cards = asRecord(data.flashcards).cards
    const count = Array.isArray(cards) ? cards.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "карточка", "карточки", "карточек")}` : "Слова и выражения"
  }

  if (block.type === "matching") {
    const pairs = asRecord(data.matching).pairs
    const count = Array.isArray(pairs) ? pairs.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "пара", "пары", "пар")}` : "Сопоставление"
  }

  if (block.type === "fill_gaps") {
    const items = asRecord(data.fill_gaps).items
    const count = Array.isArray(items) ? items.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "упражнение", "упражнения", "упражнений")}` : "Заполнение пропусков"
  }

  if (block.type === "quiz_single" || block.type === "quiz_multi") {
    const key = block.type === "quiz_single" ? "quiz_single" : "quiz_multi"
    const questions = asRecord(data[key]).questions
    const count = Array.isArray(questions) ? questions.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "вопрос", "вопроса", "вопросов")}` : "Проверка понимания"
  }

  if (block.type === "sentence_builder") {
    const sentences = asRecord(data.sentence_builder).sentences
    const count = Array.isArray(sentences) ? sentences.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "задание", "задания", "заданий")}` : "Сборка фраз"
  }

  if (block.type === "image" || block.type === "video" || block.type === "pdf") {
    const key = block.type
    const items = asRecord(data[key]).items
    const count = Array.isArray(items) ? items.length : 0
    return count > 0 ? `${count} ${pluralizeRu(count, "материал", "материала", "материалов")}` : getNormalizedBlockSubtitle(block)
  }

  return getNormalizedBlockSubtitle(block)
}

function countAssessableItems(block: TeacherLessonBlock) {
  const normalized = normalizeTeacherLessonBlock(block)
  const data = asRecord(normalized.data)

  if (normalized.type === "text") {
    const items = Array.isArray(asRecord(data.text).items) ? (asRecord(data.text).items as unknown[]) : []
    return items.reduce<number>((total, item) => {
      const questions = Array.isArray(asRecord(item).questions) ? (asRecord(item).questions as unknown[]) : []
      return total + questions.length
    }, 0)
  }

  if (normalized.type === "matching") {
    const pairs = Array.isArray(asRecord(data.matching).pairs) ? (asRecord(data.matching).pairs as unknown[]) : []
    return pairs.length
  }

  if (normalized.type === "fill_gaps") {
    const items = Array.isArray(asRecord(data.fill_gaps).items) ? (asRecord(data.fill_gaps).items as unknown[]) : []
    return items.reduce<number>((total, item) => {
      const textAnswers = extractBracketAnswers(asString(asRecord(item).text))
      const fallbackAnswers = Array.isArray(asRecord(item).answers) ? (asRecord(item).answers as unknown[]).map((answer) => asString(answer).trim()).filter(Boolean) : []
      const answers = textAnswers.length > 0 ? textAnswers : fallbackAnswers
      return total + answers.length
    }, 0)
  }

  if (normalized.type === "quiz_single" || normalized.type === "quiz_multi") {
    const key = normalized.type === "quiz_single" ? "quiz_single" : "quiz_multi"
    const questions = Array.isArray(asRecord(data[key]).questions) ? (asRecord(data[key]).questions as unknown[]) : []
    return questions.length
  }

  return 0
}

function normalizeResponseState(value: unknown): LessonResponseState {
  const raw = asRecord(value)
  const normalizeStringMap = (input: unknown) => {
    const record = asRecord(input)
    return Object.fromEntries(
      Object.entries(record)
        .filter(([, entry]) => typeof entry === "string")
        .map(([key, entry]) => [key, String(entry)])
    )
  }
  const normalizeNumberArrayMap = (input: unknown) => {
    const record = asRecord(input)
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [
        key,
        Array.isArray(entry)
          ? entry.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
          : []
      ])
    )
  }

  return {
    singleAnswers: normalizeStringMap(raw.singleAnswers),
    multiAnswers: normalizeNumberArrayMap(raw.multiAnswers),
    matchAnswers: normalizeStringMap(raw.matchAnswers),
    fillAnswers: normalizeStringMap(raw.fillAnswers),
  }
}

function normalizeSectionProgress(value: unknown): PersistedSectionProgress {
  const raw = asRecord(asRecord(value).sectionProgress)
  return Object.fromEntries(
    Object.entries(raw).map(([key, entry]) => {
      const normalized = asRecord(entry)
      return [
        key,
        {
          visited: Boolean(normalized.visited),
          completed: Boolean(normalized.completed),
        }
      ]
    })
  )
}

function hasResponseState(state: LessonResponseState, sectionProgress: PersistedSectionProgress = {}) {
  return (
    Object.keys(state.singleAnswers).length > 0 ||
    Object.keys(state.multiAnswers).length > 0 ||
    Object.keys(state.matchAnswers).length > 0 ||
    Object.keys(state.fillAnswers).length > 0 ||
    Object.values(sectionProgress).some((entry) => entry.visited || entry.completed)
  )
}

export function CustomInteractiveLesson({
  lessonId,
  lessonTitle,
  courseTitle,
  courseCoverColor,
  courseCoverStyle,
  courseCoverImageUrl,
  backHref,
  backLabel,
  blocks
}: Props) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { locale } = useUiLocale()
  const isDark =
    resolvedTheme === "dark" ||
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
  const normalizedBlocks = useMemo(() => ensureLessonHasHeroBlock(blocks, lessonId), [blocks, lessonId])
  const heroBlock = normalizedBlocks.find((block) => block.type === "hero") ?? null

  const sections = useMemo<LessonSection[]>(
    () =>
      normalizedBlocks
        .filter((block) => block.type !== "hero")
        .map((block, index) => {
          const normalized = normalizeTeacherLessonBlock(block)
          return {
            id: normalized.id,
            label: getLessonBlockDisplayTitle(normalized, locale),
            summary: sectionSummary(normalized),
            block: normalized,
            Icon: BLOCK_ICON_REGISTRY[normalized.type].icon,
            index
          }
        }),
    [locale, normalizedBlocks]
  )

  const [activeId, setActiveId] = useState<string>("intro")
  const [sectionAssessments, setSectionAssessments] = useState<Record<string, BlockAssessment>>({})
  const [responseState, setResponseState] = useState<LessonResponseState>({
    singleAnswers: {},
    multiAnswers: {},
    matchAnswers: {},
    fillAnswers: {},
  })
  const [completionHydrated, setCompletionHydrated] = useState(false)
  const [lessonCompleted, setLessonCompleted] = useState(false)
  const [completionState, setCompletionState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [savedCompletionSignature, setSavedCompletionSignature] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [savedResponseSignature, setSavedResponseSignature] = useState<string | null>(null)
  const [savedPersistedStateSignature, setSavedPersistedStateSignature] = useState<string | null>(null)
  const [leavingToCourseList, setLeavingToCourseList] = useState(false)
  const [resettingLesson, setResettingLesson] = useState(false)
  const [persistedProgress, setPersistedProgress] = useState<PersistedLessonProgress>({
    completed: false,
    scorePercent: null,
    answeredCount: 0,
    totalCount: 0,
  })
  const [sectionProgress, setSectionProgress] = useState<PersistedSectionProgress>({})
  const isFinishActive = activeId === "finish"
  const activeIndex =
    activeId === "intro"
      ? 0
      : isFinishActive
        ? sections.length + 1
        : Math.max(1, sections.findIndex((section) => section.id === activeId) + 1)
  const activeSection = activeId === "intro" || isFinishActive ? null : sections.find((section) => section.id === activeId) ?? null

  const heroData = asRecord(heroBlock ? asRecord(heroBlock.data).hero : {})
  const heroEyebrow = asString(heroData.eyebrow).trim() || "Индивидуальный урок"
  const heroLead = asString(heroData.lead).trim()
  const heroImageUrl = asString(heroData.imageUrl).trim()
  const heroImagePosition = asString(heroData.imagePosition).trim() || "72% 50%"
  const heroImageScaleRaw = Number(heroData.imageScale)
  const heroImageScale = Number.isFinite(heroImageScaleRaw) ? Math.max(0.5, Math.min(2, heroImageScaleRaw)) : 1
  const heroImageFlipX = heroData.imageFlipX === true
  const heroImageFlipY = heroData.imageFlipY === true
  const heroUseCustomAccent = heroData.useCustomAccent === true
  const heroAccentColor = heroUseCustomAccent ? asString(heroData.accentColor).trim() : ""
  const moduleLabel = courseTitle?.trim() || "Кастомный курс"
  const resolvedLessonAccent =
    heroAccentColor ||
    courseAccentFromCourse({
      cover_color: courseCoverColor ?? null,
      cover_style: courseCoverStyle ?? null,
      cover_image_url: courseCoverImageUrl ?? null,
    }) ||
    "var(--ds-sage-strong)"
  const effectiveAccent = courseAccentForTheme(resolvedLessonAccent, isDark)
  const lessonThemeStyle = useMemo(
    () =>
      ({
        "--cc-hsk-accent": effectiveAccent,
        "--cc-hsk-pill-done": isDark
          ? `color-mix(in srgb, ${effectiveAccent} 34%, #1f2126)`
          : `color-mix(in srgb, ${effectiveAccent} 22%, white)`,
        "--cc-hsk-pill-done-ink": isDark
          ? "#f3f4f6"
          : `color-mix(in srgb, ${effectiveAccent} 78%, black)`,
        "--cc-hsk-line-green": effectiveAccent,
        "--cc-hsk-hero-lime": isDark
          ? `color-mix(in srgb, ${effectiveAccent} 22%, #17181b)`
          : `color-mix(in srgb, ${effectiveAccent} 26%, white)`,
        "--cc-hsk-hero-tag": isDark
          ? `color-mix(in srgb, ${effectiveAccent} 30%, #202228)`
          : `color-mix(in srgb, ${effectiveAccent} 15%, white)`,
        "--cc-hsk-hero-ink": isDark
          ? "#f4f4f5"
          : `color-mix(in srgb, ${effectiveAccent} 58%, black)`,
        "--ds-sage": isDark
          ? `color-mix(in srgb, ${effectiveAccent} 22%, #1b1c20)`
          : `color-mix(in srgb, ${effectiveAccent} 26%, white)`,
        "--ds-sage-strong": effectiveAccent,
        "--ds-sage-hover": isDark
          ? `color-mix(in srgb, ${effectiveAccent} 72%, #0f1012)`
          : `color-mix(in srgb, ${effectiveAccent} 84%, black)`,
      }) as CSSProperties,
    [effectiveAccent, isDark]
  )

  const introCards = sections.slice(0, 4)
  const goals = sections.slice(0, 8)
  const totalSteps = sections.length + 2
  const progressPct = totalSteps <= 1 ? 100 : (activeIndex / (totalSteps - 1)) * 100
  const introCompleted = Boolean(sectionProgress.__intro__?.completed)
  const audioTrackCount = sections
    .filter((section) => section.block.type === "audio")
    .reduce((total, section) => {
      const items = asRecord(asRecord(section.block.data).audio).items
      return total + (Array.isArray(items) ? items.length : 0)
    }, 0)
  const materialCount = sections.filter((section) => ["image", "video", "pdf"].includes(section.block.type)).length
  const resolvedAssessments = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [
          section.id,
          sectionAssessments[section.id] ?? evaluateBlockAssessment(section.block, responseState)
        ])
      ) as Record<string, BlockAssessment>,
    [responseState, sectionAssessments, sections]
  )
  const totalAssessable = useMemo(
    () => sections.reduce((total, section) => total + (resolvedAssessments[section.id]?.totalCount ?? countAssessableItems(section.block)), 0),
    [resolvedAssessments, sections]
  )
  const totalAnswered = useMemo(
    () => sections.reduce((total, section) => total + (resolvedAssessments[section.id]?.answeredCount ?? 0), 0),
    [resolvedAssessments, sections]
  )
  const totalCorrect = useMemo(
    () => sections.reduce((total, section) => total + (resolvedAssessments[section.id]?.correctCount ?? 0), 0),
    [resolvedAssessments, sections]
  )
  const responseSignature = JSON.stringify(responseState)
  const persistedStateSignature = JSON.stringify({
    ...responseState,
    sectionProgress,
  })
  const liveScorePercent = totalAssessable > 0 ? Math.round((totalCorrect / totalAssessable) * 100) : null
  const usePersistedProgress =
    completionHydrated &&
    savedResponseSignature !== null &&
    responseSignature === savedResponseSignature &&
    (persistedProgress.completed || persistedProgress.scorePercent !== null || persistedProgress.answeredCount > 0)
  const effectiveTotalAssessable = totalAssessable > 0 ? totalAssessable : persistedProgress.totalCount
  const effectiveAnswered = usePersistedProgress ? persistedProgress.answeredCount : totalAnswered
  const scorePercent = usePersistedProgress ? persistedProgress.scorePercent : liveScorePercent
  const effectiveCorrect =
    usePersistedProgress && scorePercent !== null && effectiveTotalAssessable > 0
      ? Math.round((scorePercent / 100) * effectiveTotalAssessable)
      : totalCorrect
  const unansweredCount = Math.max(effectiveTotalAssessable - effectiveAnswered, 0)
  const completionEligible = isFinishActive && (effectiveTotalAssessable === 0 || effectiveAnswered > 0)
  const completionSignature = `${lessonId}:${scorePercent ?? "na"}:${effectiveAnswered}:${effectiveTotalAssessable}:${Number(completionEligible)}`
  const finishMessage =
    effectiveTotalAssessable === 0
      ? "Урок можно засчитать после просмотра всех разделов."
      : effectiveAnswered === 0
        ? "Ответьте хотя бы на часть заданий, чтобы сохранить результат."
        : effectiveAnswered < effectiveTotalAssessable
          ? "Результат сохранён. Можно вернуться позже и улучшить его."
          : "Урок завершён. Результат сохранён в прогрессе."
  const finishStars = scorePercent === null ? 0 : Math.max(1, Math.min(5, Math.round(scorePercent / 20)))
  const sectionDoneMap = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => {
          const assessment = resolvedAssessments[section.id]
          const assessableCount = assessment?.totalCount ?? 0
          const completed =
            assessableCount > 0
              ? (assessment?.answeredCount ?? 0) >= assessableCount
              : section.block.type === "audio"
                ? Boolean(sectionProgress[section.id]?.completed)
                : Boolean(sectionProgress[section.id]?.visited)
          return [section.id, completed]
        })
      ) as Record<string, boolean>,
    [resolvedAssessments, sectionProgress, sections]
  )

  useEffect(() => {
    let cancelled = false

    async function loadCompletion() {
      try {
        const response = await fetch(`/api/student/lessons/${lessonId}/completion`, { cache: "no-store" })
        const json = (await response.json().catch(() => null)) as
          | {
              completed?: boolean
              scorePercent?: number | null
              answeredCount?: number
              totalCount?: number
              responseState?: unknown
            }
          | null
        if (cancelled) return
        setLessonCompleted(Boolean(json?.completed))
        setPersistedProgress({
          completed: Boolean(json?.completed),
          scorePercent: typeof json?.scorePercent === "number" ? json.scorePercent : null,
          answeredCount: typeof json?.answeredCount === "number" ? json.answeredCount : 0,
          totalCount: typeof json?.totalCount === "number" ? json.totalCount : 0,
        })
        const nextResponseState = normalizeResponseState(json?.responseState)
        const nextSectionProgress = normalizeSectionProgress(json?.responseState)
        setResponseState(nextResponseState)
        setSectionProgress(nextSectionProgress)
        setSavedResponseSignature(JSON.stringify(nextResponseState))
        setSavedPersistedStateSignature(
          JSON.stringify({
            ...nextResponseState,
            sectionProgress: nextSectionProgress,
          })
        )
        if (json?.completed) {
          setSavedCompletionSignature(
            `${lessonId}:${json?.scorePercent ?? "na"}:${json?.answeredCount ?? 0}:${json?.totalCount ?? 0}:1`
          )
        }
      } finally {
        if (!cancelled) setCompletionHydrated(true)
      }
    }

    void loadCompletion()

    return () => {
      cancelled = true
    }
  }, [lessonId])

  useEffect(() => {
    if (!activeSection) return
    setSectionProgress((prev) => {
      const current = prev[activeSection.id]
      if (current?.visited) return prev
      return {
        ...prev,
        [activeSection.id]: {
          visited: true,
          completed: current?.completed ?? false,
        }
      }
    })
  }, [activeSection])

  useEffect(() => {
    if (activeId === "intro") return
    setSectionProgress((prev) => {
      const current = prev.__intro__
      if (current?.completed && current.visited) return prev
      return {
        ...prev,
        __intro__: {
          visited: true,
          completed: true,
        },
      }
    })
  }, [activeId])

  const handleAssessmentChange = useCallback((blockId: string, assessment: BlockAssessment) => {
    setSectionAssessments((prev) => {
      const current = prev[blockId]
      if (
        current &&
        current.totalCount === assessment.totalCount &&
        current.answeredCount === assessment.answeredCount &&
        current.correctCount === assessment.correctCount
      ) {
        return prev
      }
      return {
        ...prev,
        [blockId]: assessment
      }
    })
  }, [])

  const persistProgress = useCallback(
    async ({
      completed,
      force,
      nextResponseState,
      nextSectionProgress,
    }: {
      completed?: boolean
      force?: boolean
      nextResponseState?: LessonResponseState
      nextSectionProgress?: PersistedSectionProgress
    }) => {
      const payloadState = nextResponseState ?? responseState
      const payloadSectionProgress = nextSectionProgress ?? sectionProgress
      const payloadSignature = JSON.stringify({
        ...payloadState,
        sectionProgress: payloadSectionProgress,
      })
      const shouldPersistState = hasResponseState(payloadState, payloadSectionProgress)

      if (!force && !shouldPersistState) return true
      if (!force && payloadSignature === savedPersistedStateSignature && completed === undefined) return true

      if (completed === true) {
        setCompletionState("saving")
      } else {
        setProgressState("saving")
      }

      const response = await fetch(`/api/student/lessons/${lessonId}/completion`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          completed,
          scorePercent,
          answeredCount: totalAnswered,
          totalCount: totalAssessable,
          responseState: {
            ...payloadState,
            sectionProgress: payloadSectionProgress,
          },
        })
      })

      const json = (await response.json().catch(() => null)) as
        | {
            completed?: boolean
            scorePercent?: number | null
            answeredCount?: number
            totalCount?: number
            responseState?: unknown
          }
        | null

      if (!response.ok) {
        if (completed === true) {
          setCompletionState("error")
        } else {
          setProgressState("error")
        }
        return false
      }

      const persistedState = normalizeResponseState(json?.responseState ?? payloadState)
      const persistedSectionProgress = normalizeSectionProgress(json?.responseState ?? { sectionProgress: payloadSectionProgress })
      setSavedResponseSignature(JSON.stringify(persistedState))
      setSavedPersistedStateSignature(
        JSON.stringify({
          ...persistedState,
          sectionProgress: persistedSectionProgress,
        })
      )
      setResponseState(persistedState)
      setSectionProgress(persistedSectionProgress)
      setPersistedProgress({
        completed: Boolean(json?.completed ?? completed),
        scorePercent: typeof json?.scorePercent === "number" ? json.scorePercent : scorePercent,
        answeredCount: typeof json?.answeredCount === "number" ? json.answeredCount : effectiveAnswered,
        totalCount: typeof json?.totalCount === "number" ? json.totalCount : effectiveTotalAssessable,
      })
      setProgressState("saved")

      if (json?.completed || completed === true) {
        setLessonCompleted(true)
        setSavedCompletionSignature(
          `${lessonId}:${json?.scorePercent ?? scorePercent ?? "na"}:${json?.answeredCount ?? effectiveAnswered}:${json?.totalCount ?? effectiveTotalAssessable}:1`
        )
        setCompletionState("saved")
      }

      return true
    },
    [
      effectiveAnswered,
      effectiveTotalAssessable,
      lessonId,
      responseState,
      savedPersistedStateSignature,
      scorePercent,
      sectionProgress,
      totalAnswered,
      totalAssessable,
    ]
  )

  useEffect(() => {
    if (!completionHydrated) return
    const signature = persistedStateSignature
    if (!hasResponseState(responseState, sectionProgress)) return
    if (signature === savedPersistedStateSignature) return

    const timeout = window.setTimeout(() => {
      void persistProgress({ nextResponseState: responseState })
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [completionHydrated, persistProgress, persistedStateSignature, responseState, savedPersistedStateSignature, sectionProgress])

  useEffect(() => {
    if (!completionHydrated || !isFinishActive || !completionEligible) return
    if (savedCompletionSignature === completionSignature) return

    let cancelled = false

    async function syncCompletion() {
      const ok = await persistProgress({ completed: true, force: true })
      if (cancelled || !ok) return
      setSavedCompletionSignature(completionSignature)
    }

    void syncCompletion()

    return () => {
      cancelled = true
    }
  }, [
    completionEligible,
    completionHydrated,
    completionSignature,
    isFinishActive,
    persistProgress,
    savedCompletionSignature,
  ])

  const handleReturnToCourseList = useCallback(async () => {
    if (leavingToCourseList) return
    setLeavingToCourseList(true)

    if (completionEligible && savedCompletionSignature !== completionSignature) {
      const ok = await persistProgress({ completed: true, force: true })
      if (ok) {
        setSavedCompletionSignature(completionSignature)
      }
    } else {
      await persistProgress({ force: true })
    }

    router.push(backHref)
    router.refresh()
  }, [
    backHref,
    completionEligible,
    completionSignature,
    leavingToCourseList,
    persistProgress,
    router,
    savedCompletionSignature,
  ])

  const handleResetLesson = useCallback(async () => {
    if (resettingLesson) return
    setResettingLesson(true)
    setCompletionState("saving")

    try {
      const response = await fetch(`/api/student/lessons/${lessonId}/completion`, {
        method: "DELETE",
      })

      if (!response.ok) {
        setCompletionState("error")
        return
      }

      const emptyState: LessonResponseState = {
        singleAnswers: {},
        multiAnswers: {},
        matchAnswers: {},
        fillAnswers: {},
      }

      setResponseState(emptyState)
      setSectionAssessments({})
      setLessonCompleted(false)
      setSavedCompletionSignature(null)
      setSavedResponseSignature(null)
      setSavedPersistedStateSignature(null)
      setPersistedProgress({
        completed: false,
        scorePercent: null,
        answeredCount: 0,
        totalCount: 0,
      })
      setSectionProgress({})
      setProgressState("idle")
      setCompletionState("idle")
      setActiveId("intro")
      router.refresh()
    } finally {
      setResettingLesson(false)
    }
  }, [lessonId, resettingLesson, router])

  const handleBlockCompletionStateChange = useCallback((blockId: string, completed: boolean) => {
    setSectionProgress((prev) => {
      const current = prev[blockId]
      if (current?.completed === completed && current?.visited) return prev
      return {
        ...prev,
        [blockId]: {
          visited: true,
          completed,
        }
      }
    })
  }, [])

  const goPrev = useCallback(() => {
    if (activeId === "intro") return
    if (activeId === "finish") {
      if (sections.length > 0) {
        setActiveId(sections[sections.length - 1]!.id)
      } else {
        setActiveId("intro")
      }
      return
    }
    const currentIndex = sections.findIndex((section) => section.id === activeId)
    if (currentIndex <= 0) {
      setActiveId("intro")
      return
    }
    setActiveId(sections[currentIndex - 1]!.id)
  }, [activeId, sections])

  const goNext = useCallback(() => {
    if (activeId === "intro") {
      if (sections[0]) setActiveId(sections[0].id)
      else setActiveId("finish")
      return
    }
    if (activeId === "finish") return
    const currentIndex = sections.findIndex((section) => section.id === activeId)
    if (currentIndex < 0) return
    if (currentIndex >= sections.length - 1) {
      setActiveId("finish")
      return
    }
    setActiveId(sections[currentIndex + 1]!.id)
  }, [activeId, sections])

  const nextSection = activeSection
    ? sections[activeSection.index + 1]
      ? { id: sections[activeSection.index + 1]!.id, label: sections[activeSection.index + 1]!.label, isFinish: false }
      : { id: "finish", label: "Финал", isFinish: true }
    : sections[0]
      ? { id: sections[0]!.id, label: sections[0]!.label, isFinish: false }
      : { id: "finish", label: "Финал", isFinish: true }

  return (
    <div className="cc-hsk-shell" style={lessonThemeStyle}>
      <div className="cc-hsk-topbar">
        <Link href={backHref} className="cc-hsk-backlink">
          <ChevronLeft className="cc-hsk-backlink-icon" aria-hidden />
          <span>{backLabel}</span>
        </Link>

        <div className="cc-hsk-tabs-scroll ds-hide-scrollbar" role="tablist" aria-label="Разделы урока">
          <button
            type="button"
            role="tab"
            aria-selected={activeId === "intro"}
            className={cn("cc-hsk-tab", activeId === "intro" && "cc-hsk-tab--active", introCompleted && activeId !== "intro" && "cc-hsk-tab--done")}
            onClick={() => setActiveId("intro")}
          >
            {introCompleted && activeId !== "intro" ? (
              <span className="cc-hsk-tab-check" aria-hidden>
                <Check className="cc-hsk-tab-check-icon" strokeWidth={2.5} />
              </span>
            ) : null}
            Введение
          </button>

          {sections.map((section, index) => {
            const isActive = section.id === activeId
            const isDone = Boolean(sectionDoneMap[section.id])
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn("cc-hsk-tab", isActive && "cc-hsk-tab--active", isDone && !isActive && "cc-hsk-tab--done")}
                onClick={() => setActiveId(section.id)}
              >
                {isDone && !isActive ? (
                  <span className="cc-hsk-tab-check" aria-hidden>
                    <Check className="cc-hsk-tab-check-icon" strokeWidth={2.5} />
                  </span>
                ) : null}
                {section.label}
              </button>
            )
          })}

          <button
            type="button"
            role="tab"
            aria-selected={isFinishActive}
            className={cn("cc-hsk-tab", isFinishActive && "cc-hsk-tab--active", lessonCompleted && !isFinishActive && "cc-hsk-tab--done")}
            onClick={() => setActiveId("finish")}
          >
            {lessonCompleted && !isFinishActive ? (
              <span className="cc-hsk-tab-check" aria-hidden>
                <Check className="cc-hsk-tab-check-icon" strokeWidth={2.5} />
              </span>
            ) : null}
            Финал
          </button>
        </div>

        <div className="cc-hsk-arrows">
          <button type="button" className="cc-hsk-round-btn" aria-label="Предыдущий раздел" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="cc-hsk-round-btn" aria-label="Следующий раздел" onClick={goNext}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="cc-hsk-progressbar" aria-hidden>
        <div className="cc-hsk-progressbar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="cc-hsk-body">
        {activeId === "intro" ? (
          <div className="cc-hsk-intro-stack">
            <section className="cc-hsk-hero">
              <div className="cc-hsk-hero-copy">
                <span className="cc-hsk-hero-tag">{heroEyebrow}</span>
                <p className="cc-hsk-hero-module">{moduleLabel}</p>
                <h1 className="cc-hsk-hero-title">{lessonTitle}</h1>
                {heroLead ? <p className="cc-hsk-hero-lead">{heroLead}</p> : null}
                {sections[0] ? (
                  <button type="button" className="cc-hsk-hero-cta" onClick={() => setActiveId(sections[0]!.id)}>
                    Начать урок
                    <ArrowRight className="cc-hsk-hero-cta-arrow" aria-hidden />
                  </button>
                ) : null}
              </div>

              <div className="cc-hsk-hero-art" aria-hidden>
                <div
                  className={cn(
                    "cc-hsk-hero-art-inner overflow-hidden",
                    heroImageUrl ? "cc-hsk-hero-art-inner--image p-0" : "",
                  )}
                >
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt={lessonTitle}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: heroImagePosition,
                      transform: `scale(${heroImageScale}) scaleX(${heroImageFlipX ? -1 : 1}) scaleY(${heroImageFlipY ? -1 : 1})`,
                      transformOrigin: heroImagePosition,
                    }}
                  />
                ) : (
                    <ImageIcon className="h-[58%] w-[58%] opacity-75" strokeWidth={1.8} />
                  )}
                </div>
              </div>
            </section>

            {introCards.length > 0 ? (
              <div className="cc-hsk-module-grid">
                {introCards.map(({ id, label, summary, Icon }) => (
                  <button key={id} type="button" className="cc-hsk-module-card" onClick={() => setActiveId(id)}>
                    <Icon className="cc-hsk-module-icon" strokeWidth={1.5} aria-hidden />
                    <span className="cc-hsk-module-title">{label}</span>
                    <span className="cc-hsk-module-sub">{summary}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {goals.length > 0 ? (
              <section className="cc-hsk-goals">
                <h2 className="cc-hsk-goals-title">План урока</h2>
                <ol className="cc-hsk-goals-list">
                  {goals.map((goal, index) => (
                    <li key={goal.id} className="cc-hsk-goals-item">
                      <span className="cc-hsk-goals-num">{index + 1}</span>
                      <div className="cc-hsk-goals-text">
                        <strong>{goal.label}</strong>
                        <span>{goal.summary}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        ) : isFinishActive ? (
          <div className="cc-hsk-finish">
            <section className="cc-hsk-finish-hero">
              <div className="cc-hsk-finish-trophy" aria-hidden>
                <Sparkles className="h-7 w-7 text-white/90" strokeWidth={1.25} />
              </div>
              <h2 className="cc-hsk-finish-title">Урок завершён!</h2>
              <div className="cc-hsk-finish-stars" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < finishStars ? "cc-hsk-finish-star cc-hsk-finish-star--on" : "cc-hsk-finish-star"} />
                ))}
              </div>
              <p className="cc-hsk-finish-score">{scorePercent === null ? "—" : `${scorePercent}%`}</p>
              <p className="cc-hsk-finish-score-label">{scorePercent === null ? "без оценки" : "результат"}</p>
              <p className="mt-3 text-center text-[15px] leading-7 text-ds-text-secondary">
                {finishMessage}
              </p>
              {completionState === "saving" ? (
                <p className="text-center text-[13px] text-ds-text-tertiary">Сохраняем прохождение…</p>
              ) : null}
              {progressState === "saving" && completionState !== "saving" ? (
                <p className="text-center text-[13px] text-ds-text-tertiary">Сохраняем ответы…</p>
              ) : null}
              {completionState === "error" ? (
                <p className="text-center text-[13px] text-[#b15462]">Не удалось обновить статус урока. Попробуйте ещё раз.</p>
              ) : null}
              {progressState === "error" && completionState !== "error" ? (
                <p className="text-center text-[13px] text-[#b15462]">Не удалось сохранить текущие ответы.</p>
              ) : null}
            </section>

            <div className="cc-hsk-finish-stats">
              <div className="cc-hsk-stat-card">
                <BookOpen className="cc-hsk-stat-icon" strokeWidth={1.35} aria-hidden />
                <p className="cc-hsk-stat-value">
                  {sections.length} {pluralizeRu(sections.length, "раздел", "раздела", "разделов")}
                </p>
                <p className="cc-hsk-stat-label">Структура урока</p>
              </div>
              <div className="cc-hsk-stat-card">
                <Headphones className="cc-hsk-stat-icon" strokeWidth={1.35} aria-hidden />
                <p className="cc-hsk-stat-value">
                  {effectiveCorrect} из {effectiveTotalAssessable || 0}
                </p>
                <p className="cc-hsk-stat-label">Правильных ответов</p>
              </div>
              <div className="cc-hsk-stat-card">
                <ImageIcon className="cc-hsk-stat-icon" strokeWidth={1.35} aria-hidden />
                <p className="cc-hsk-stat-value">
                  {unansweredCount}
                </p>
                <p className="cc-hsk-stat-label">Без ответа</p>
              </div>
            </div>

            <div className="cc-hsk-finish-actions">
              <button type="button" className="cc-hsk-backlink" onClick={() => void handleResetLesson()} disabled={resettingLesson}>
                {resettingLesson ? "Сбрасываем урок…" : "Пройти заново"}
              </button>
              <button type="button" className="cc-hsk-btn-next" onClick={() => void handleReturnToCourseList()} disabled={leavingToCourseList}>
                К списку уроков
                <ArrowRight className="cc-hsk-btn-next-arrow" aria-hidden />
              </button>
            </div>
          </div>
        ) : activeSection ? (
          <div className="cc-hsk-panel">
            <div className="px-6 pt-5 text-right text-[12px] text-ds-text-tertiary sm:px-8">
              {progressState === "saving"
                ? "Сохраняем ответы…"
                : progressState === "saved"
                  ? "Ответы сохранены"
                  : progressState === "error"
                    ? "Не удалось сохранить ответы"
                    : null}
            </div>
            <BlockRenderer
              blocks={[activeSection.block]}
              lessonTitle={lessonTitle}
              indexOffset={activeSection.index}
              onBlockAssessmentChange={handleAssessmentChange}
              initialResponseState={responseState}
              onResponseStateChange={setResponseState}
              onBlockCompletionStateChange={handleBlockCompletionStateChange}
            />

            {nextSection ? (
              <div className="cc-hsk-panel-footer">
                <button type="button" className="cc-hsk-btn-next" onClick={goNext}>
                  {nextSection.isFinish ? "К финалу" : `К разделу «${nextSection.label}»`}
                  <ArrowRight className="cc-hsk-btn-next-arrow" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
