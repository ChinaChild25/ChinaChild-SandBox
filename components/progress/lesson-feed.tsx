"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BookOpenText,
  CheckCheck,
  CircleAlert,
  Languages,
  Sparkles,
  Target,
} from "lucide-react"
import type { LessonFeedItem } from "@/lib/lesson-analytics/server"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type LessonFeedProps = {
  sessions: LessonFeedItem[]
}

function formatSessionDate(value: string | null): string {
  if (!value) return "Дата уточняется"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Дата уточняется"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function analyticsReady(session: LessonFeedItem): boolean {
  return (
    Boolean(session.summary?.trim()) ||
    session.mistakes.length > 0 ||
    session.strengths.length > 0 ||
    session.recommendations.length > 0 ||
    session.topicsPracticed.length > 0 ||
    session.averageScore !== null
  )
}

function statusBadge(session: LessonFeedItem): { label: string; tone: string } {
  if (session.status === "failed") {
    return {
      label: "Разбор не завершён",
      tone: "border-[#f3c2cb] bg-[#fff2f4] text-[#a43b4f] dark:border-[#4e222c] dark:bg-[#2a1419] dark:text-[#ffbcc7]",
    }
  }

  if (analyticsReady(session)) {
    return {
      label: "Отчёт готов",
      tone: "border-[#bbdfc5] bg-[#eef8f1] text-[#21693f] dark:border-[#1e4a2b] dark:bg-[#13261a] dark:text-[#b9efc8]",
    }
  }

  return {
    label: "Анализ готовится...",
    tone: "border-[#f0d3a0] bg-[#fff6e9] text-[#8a5a10] dark:border-[#5a4118] dark:bg-[#302312] dark:text-[#ffd08a]",
  }
}

function formatSpeakingRatio(value: number | null): string {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}

function TranscriptTone({ speakerRole }: { speakerRole: LessonFeedItem["transcript"][number]["speakerRole"] }) {
  if (speakerRole === "student") {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#F5C542]" aria-hidden />
  }

  if (speakerRole === "teacher") {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#93C5FD]" aria-hidden />
  }

  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-black/20 dark:bg-white/20" aria-hidden />
}

function ScoreTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[22px] bg-[var(--ds-neutral-row)] px-4 py-4">
      <p className="text-[12px] font-medium text-ds-text-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ds-ink">{value}</p>
    </div>
  )
}

export function LessonFeed({ sessions }: LessonFeedProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.sessionId ?? "")

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("")
      return
    }

    const selectedStillExists = sessions.some((session) => session.sessionId === selectedSessionId)
    if (!selectedStillExists) {
      setSelectedSessionId(sessions[0].sessionId)
    }
  }, [sessions, selectedSessionId])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) ?? sessions[0] ?? null,
    [selectedSessionId, sessions]
  )

  if (sessions.length === 0 || !selectedSession) {
    return (
      <Card className="border-black/[0.08] bg-white/[0.95] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle>История уроков</CardTitle>
          <CardDescription>Как только появятся разобранные live-занятия, здесь откроется история прогресса.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const selectedStatus = statusBadge(selectedSession)

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-black/[0.08] bg-white/[0.95] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <CardHeader className="pb-0">
          <CardTitle>История занятий</CardTitle>
          <CardDescription>Выберите урок, чтобы открыть подробный разбор, ошибки и транскрипцию.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-3">
              {sessions.map((session) => {
                const status = statusBadge(session)
                const selected = session.sessionId === selectedSession.sessionId

                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    onClick={() => setSelectedSessionId(session.sessionId)}
                    className={cn(
                      "w-full rounded-[24px] border px-4 py-4 text-left transition-all",
                      selected
                        ? "border-[#f5d98c] bg-[#fffaf0] shadow-[0_16px_40px_rgba(245,197,66,0.16)] dark:border-[#5e4c18] dark:bg-[#241d10]"
                        : "border-black/[0.08] bg-[var(--ds-neutral-row)] hover:border-black/[0.14] hover:bg-white dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[15px] font-semibold leading-6 text-ds-ink">{session.title}</p>
                        <p className="mt-1 text-[13px] text-ds-text-secondary">
                          {formatSessionDate(session.endedAt ?? session.startedAt)}
                        </p>
                        {session.teacherName ? (
                          <p className="mt-1 text-[12px] text-ds-text-tertiary">Преподаватель: {session.teacherName}</p>
                        ) : null}
                      </div>
                      {session.averageScore !== null ? (
                        <div className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ds-ink shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:bg-white/10 dark:text-white">
                          {session.averageScore}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn("border px-2.5 py-1 text-[11px] font-semibold", status.tone)}
                      >
                        {status.label}
                      </Badge>
                      {session.topicsPracticed.slice(0, 2).map((topic) => (
                        <Badge
                          key={topic}
                          variant="outline"
                          className="border-black/[0.08] bg-white/[0.75] px-2.5 py-1 text-[11px] text-ds-ink dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-black/[0.08] bg-white/[0.95] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-[28px] leading-tight">{selectedSession.title}</CardTitle>
              <CardDescription className="mt-2 text-[15px] leading-6">
                {formatSessionDate(selectedSession.endedAt ?? selectedSession.startedAt)}
                {selectedSession.teacherName ? ` · ${selectedSession.teacherName}` : ""}
              </CardDescription>
            </div>
            <Badge variant="outline" className={cn("border px-3 py-1.5 text-sm font-semibold", selectedStatus.tone)}>
              {selectedStatus.label}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScoreTile label="Грамматика" value={selectedSession.grammarScore ?? "—"} />
            <ScoreTile label="Лексика" value={selectedSession.vocabularyScore ?? "—"} />
            <ScoreTile label="Беглость" value={selectedSession.fluencyScore ?? "—"} />
            <ScoreTile label="Говорил ученик" value={formatSpeakingRatio(selectedSession.speakingRatio)} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <section className="rounded-[28px] bg-[linear-gradient(135deg,rgba(245,197,66,0.14),rgba(147,197,253,0.12))] p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ds-ink">
              <BookOpenText className="h-4 w-4" aria-hidden />
              Краткий итог урока
            </div>
            <p className="mt-3 text-[15px] leading-7 text-ds-text-secondary">
              {selectedSession.summary?.trim() ||
                "Аналитика ещё в обработке. Как только разбор завершится, здесь появится короткое summary по уроку."}
            </p>
            {selectedSession.topicsPracticed.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedSession.topicsPracticed.map((topic) => (
                  <Badge
                    key={topic}
                    variant="outline"
                    className="border-black/[0.08] bg-white/[0.80] px-3 py-1.5 text-xs font-semibold text-ds-ink dark:border-white/[0.08] dark:bg-white/[0.08] dark:text-white"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-[26px] bg-[var(--ds-neutral-row)] p-5">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ds-ink">
                <Sparkles className="h-4 w-4 text-[#2d9150]" aria-hidden />
                Что уже получается
              </div>
              {selectedSession.strengths.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {selectedSession.strengths.map((item) => (
                    <div
                      key={item}
                      className="rounded-[20px] border border-[#cbe9d5] bg-[#f3fbf6] px-4 py-3 text-[14px] leading-6 text-[#24543a] dark:border-[#24422d] dark:bg-[#16231b] dark:text-[#c9f0d5]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[14px] leading-6 text-ds-text-secondary">
                  После завершения разбора здесь появятся сильные стороны ученика по этому уроку.
                </p>
              )}
            </section>

            <section className="rounded-[26px] bg-[var(--ds-neutral-row)] p-5">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ds-ink">
                <Target className="h-4 w-4 text-[#4c7fe6]" aria-hidden />
                Что отработать дальше
              </div>
              {selectedSession.recommendations.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {selectedSession.recommendations.map((item) => (
                    <div
                      key={item}
                      className="rounded-[20px] border border-[#cad7f9] bg-[#f2f6ff] px-4 py-3 text-[14px] leading-6 text-[#294a86] dark:border-[#24355f] dark:bg-[#141c2f] dark:text-[#cad9ff]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[14px] leading-6 text-ds-text-secondary">
                  Персональные рекомендации появятся после завершения AI-аналитики урока.
                </p>
              )}
            </section>
          </div>

          <section className="rounded-[26px] bg-[var(--ds-neutral-row)] p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ds-ink">
              <CircleAlert className="h-4 w-4 text-[#d88b17]" aria-hidden />
              Ошибки и исправления
            </div>
            {selectedSession.mistakes.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {selectedSession.mistakes.map((mistake, index) => (
                  <article
                    key={`${mistake.original}-${index}`}
                    className="rounded-[22px] border border-black/[0.08] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.04]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#f1d2a1] bg-[#fff6e8] text-[#8a5a10] dark:border-[#5a4118] dark:bg-[#302312] dark:text-[#ffd08a]">
                        {mistake.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-black/[0.08] bg-white text-ds-ink dark:border-white/[0.08] dark:bg-white/[0.08] dark:text-white"
                      >
                        HSK {mistake.hsk_level}
                      </Badge>
                    </div>
                    <p className="mt-3 text-[15px] font-semibold text-ds-ink">{mistake.original}</p>
                    <p className="mt-2 text-[14px] leading-6 text-ds-text-secondary">
                      Исправление: <span className="font-semibold text-ds-ink">{mistake.correction}</span>
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-ds-text-secondary">{mistake.explanation}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[14px] leading-6 text-ds-text-secondary">
                Явные ошибки пока не выделены. Когда анализ будет готов, здесь появятся проблемные фразы и корректные варианты.
              </p>
            )}
          </section>

          <Separator className="bg-black/[0.06] dark:bg-white/[0.08]" />

          <section>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ds-ink">
              <Languages className="h-4 w-4" aria-hidden />
              Полная транскрипция
            </div>
            {selectedSession.transcript.length > 0 ? (
              <ScrollArea className="mt-4 h-[360px] rounded-[26px] bg-[var(--ds-neutral-row)] px-4 py-4">
                <div className="space-y-3 pr-3">
                  {selectedSession.transcript.map((segment) => (
                    <article
                      key={`${segment.sequence}-${segment.startedAtSec ?? "na"}`}
                      className="rounded-[20px] border border-black/[0.06] bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary">
                        <TranscriptTone speakerRole={segment.speakerRole} />
                        <span>{segment.speakerLabel?.trim() || segment.speakerRole}</span>
                        {segment.startedAtSec !== null ? <span>· {segment.startedAtSec.toFixed(1)}s</span> : null}
                      </div>
                      <div className="mt-2 flex items-start gap-3 text-[14px] leading-6 text-ds-ink">
                        <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-ds-text-tertiary" aria-hidden />
                        <p>{segment.text}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="mt-4 text-[14px] leading-6 text-ds-text-secondary">
                Транскрипция ещё не загружена. После обработки Daily и AI она появится прямо здесь.
              </p>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
