"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { ArrowRight, BookOpen, Headphones, Mic2, PenLine, Sparkles } from "lucide-react"

import type { LessonPayload } from "@/lib/courses/types"

import { AudioPlayer } from "@/components/school/audio-player"
import { DialoguePanel } from "@/components/school/dialogue-panel"
import { HomeworkChecklist } from "@/components/school/homework-checklist"
import { LessonCharacter } from "@/components/school/lesson-character"
import { LessonVisualizer } from "@/components/school/lesson-visualizer"
import { QuizBlocks } from "@/components/school/quiz-blocks"
import { VocabTabs } from "@/components/school/vocab-tabs"
import { LessonHskChrome, lessonSectionIndex, lessonSectionKeyAt, type HskLessonSectionKey } from "@/components/school/lesson-hsk-chrome"

type Props = {
  data: LessonPayload
  courseHref: string
  /** e.g. "HSK 1" — shown compact in the lesson top bar */
  courseLevelLabel: string
}

function vocabWordCount(data: LessonPayload): number {
  return data.vocabTabs.reduce((n, t) => n + t.cards.length, 0)
}

const SECTION_NEXT_CTA: Partial<Record<HskLessonSectionKey, string>> = {
  audio: "К словарю",
  vocab: "К пиньиню",
  pinyin: "К речи",
  speech: "К письму",
  writing: "К игре",
  game: "К практике",
  practice: "К финалу",
}

export function InteractiveLesson({ data, courseHref, courseLevelLabel }: Props) {
  const { meta, presentationSlides, audioTracks, vocabTabs, visualizerModes, dialogueTabs, dialogueTexts, character, games, homeworkTasks } = data

  const [activeKey, setActiveKey] = useState<HskLessonSectionKey>("intro")

  const navLabel = useMemo(() => courseLevelLabel.replace(/\s+/g, ""), [courseLevelLabel])

  const activeIndex = lessonSectionIndex(activeKey)

  const goPrev = useCallback(() => {
    setActiveKey(lessonSectionKeyAt(activeIndex - 1))
  }, [activeIndex])

  const goNext = useCallback(() => {
    setActiveKey(lessonSectionKeyAt(activeIndex + 1))
  }, [activeIndex])

  const startLesson = useCallback(() => setActiveKey("audio"), [])

  const moduleCards = useMemo(
    () => [
      {
        key: "audio" as const,
        title: "Аудио",
        sub: `${audioTracks.length} треков`,
        Icon: Headphones,
      },
      {
        key: "vocab" as const,
        title: "Словарь",
        sub: `${vocabWordCount(data)} слов`,
        Icon: BookOpen,
      },
      {
        key: "speech" as const,
        title: "Речь",
        sub: "Диалоги",
        Icon: Mic2,
      },
      {
        key: "game" as const,
        title: "Игра",
        sub: "Закрепление",
        Icon: Sparkles,
      },
    ],
    [audioTracks.length, data],
  )

  const sectionFooter = (key: HskLessonSectionKey) => {
    const next = SECTION_NEXT_CTA[key]
    if (!next) return null
    return (
      <div className="cc-hsk-panel-footer">
        <span />
        <button type="button" className="cc-hsk-btn-next" onClick={goNext}>
          {next}
          <ArrowRight className="cc-hsk-btn-next-arrow" aria-hidden />
        </button>
      </div>
    )
  }

  const sectionIntro = (title: string, subtitle: string) => (
    <header className="cc-hsk-section-head">
      <h2 className="cc-hsk-section-title">{title}</h2>
      <p className="cc-hsk-section-sub">{subtitle}</p>
    </header>
  )

  let body: React.ReactNode = null

  switch (activeKey) {
    case "intro":
      body = (
        <div className="cc-hsk-intro-stack">
          <section className="cc-hsk-hero">
            <div className="cc-hsk-hero-copy">
              <span className="cc-hsk-hero-tag">{navLabel} • Урок</span>
              <p className="cc-hsk-hero-module">{meta.module}</p>
              <h1 className="cc-hsk-hero-title">{meta.title}</h1>
              {meta.chinese ? <p className="cc-hsk-hero-han">{meta.chinese}</p> : null}
              {meta.lead ? <p className="cc-hsk-hero-lead">{meta.lead}</p> : null}
              <button type="button" className="cc-hsk-hero-cta" onClick={startLesson}>
                Начать урок
                <ArrowRight className="cc-hsk-hero-cta-arrow" aria-hidden />
              </button>
            </div>
            <div className="cc-hsk-hero-art" aria-hidden>
              <div className="cc-hsk-hero-art-inner">
                <svg viewBox="0 0 120 120" className="cc-hsk-hero-art-svg">
                  <path
                    d="M24 88 Q60 24 96 88"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M32 40 H88 M60 40 V96"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity={0.45}
                  />
                </svg>
              </div>
            </div>
          </section>

          <div className="cc-hsk-module-grid">
            {moduleCards.map(({ key, title, sub, Icon }) => (
              <button key={key} type="button" className="cc-hsk-module-card" onClick={() => setActiveKey(key)}>
                <Icon className="cc-hsk-module-icon" strokeWidth={1.5} aria-hidden />
                <span className="cc-hsk-module-title">{title}</span>
                <span className="cc-hsk-module-sub">{sub}</span>
              </button>
            ))}
          </div>

          <section className="cc-hsk-goals">
            <h2 className="cc-hsk-goals-title">Цели урока</h2>
            <ol className="cc-hsk-goals-list">
              {presentationSlides.map((s, i) => (
                <li key={i} className="cc-hsk-goals-item">
                  <span className="cc-hsk-goals-num">{i + 1}</span>
                  <div className="cc-hsk-goals-text">
                    <strong>{s.title}</strong>
                    <span>{s.text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )
      break

    case "audio":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Повторяй за диктором", "Слушай внимательно и повторяй вслух — так легче запомнить звуки.")}
          <div className="cc-hsk-panel-inset">
            <AudioPlayer tracks={audioTracks} />
          </div>
          {sectionFooter("audio")}
        </div>
      )
      break

    case "vocab":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Словарь урока", "Нажми на карточку — увидишь перевод")}
          <VocabTabs tabs={vocabTabs} onContinue={goNext} continueLabel="К пиньиню" />
        </div>
      )
      break

    case "pinyin":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Система пиньиня", "Собери слог, потренируй тоны и закрепи произношение.")}
          <div className="cc-hsk-panel-inset cc-hsk-panel-inset--flush">
            <LessonVisualizer modes={visualizerModes} />
          </div>
          {sectionFooter("pinyin")}
        </div>
      )
      break

    case "speech":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Речевая практика", "Произноси каждую фразу вслух и отмечай прогресс.")}
          <DialoguePanel tabs={dialogueTabs} texts={dialogueTexts} variant="hsk" />
          {sectionFooter("speech")}
        </div>
      )
      break

    case "writing":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Система письма", "Базовые черты китайского иероглифа и порядок штрихов.")}
          <LessonCharacter character={character} />
          {sectionFooter("writing")}
        </div>
      )
      break

    case "game":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Найди пары", "Соедини китайское слово с переводом")}
          <QuizBlocks games={games} variant="hsk" />
          {sectionFooter("game")}
        </div>
      )
      break

    case "practice":
      body = (
        <div className="cc-hsk-panel">
          {sectionIntro("Домашняя практика", "Выполни задания для закрепления материала")}
          <HomeworkChecklist tasks={homeworkTasks} onContinue={goNext} continueLabel="К финалу" />
        </div>
      )
      break

    case "finish":
      body = (
        <div className="cc-hsk-finish">
          <section className="cc-hsk-finish-hero">
            <div className="cc-hsk-finish-trophy" aria-hidden>
              <Sparkles className="h-7 w-7 text-white/90" strokeWidth={1.25} />
            </div>
            <h2 className="cc-hsk-finish-title">Урок завершён!</h2>
            <div className="cc-hsk-finish-stars" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i === 0 ? "cc-hsk-finish-star cc-hsk-finish-star--on" : "cc-hsk-finish-star"} />
              ))}
            </div>
            <p className="cc-hsk-finish-score">100%</p>
            <p className="cc-hsk-finish-score-label">результат</p>
          </section>

          <div className="cc-hsk-finish-stats">
            <div className="cc-hsk-stat-card">
              <BookOpen className="cc-hsk-stat-icon" strokeWidth={1.35} aria-hidden />
              <p className="cc-hsk-stat-value">{vocabWordCount(data)} слов</p>
              <p className="cc-hsk-stat-label">Словарь</p>
            </div>
            <div className="cc-hsk-stat-card">
              <Headphones className="cc-hsk-stat-icon" strokeWidth={1.35} aria-hidden />
              <p className="cc-hsk-stat-value">{audioTracks.length} треков</p>
              <p className="cc-hsk-stat-label">Аудио</p>
            </div>
            <div className="cc-hsk-stat-card">
              <PenLine className="cc-hsk-stat-icon" strokeWidth={1.35} aria-hidden />
              <p className="cc-hsk-stat-value">{character.strokes.length} черт</p>
              <p className="cc-hsk-stat-label">Письмо</p>
            </div>
          </div>

          <div className="cc-hsk-finish-actions">
            <Link href={courseHref} className="cc-hsk-btn-next cc-hsk-btn-next--link">
              К списку тем
              <ArrowRight className="cc-hsk-btn-next-arrow" aria-hidden />
            </Link>
          </div>
        </div>
      )
      break

    default:
      body = null
  }

  return (
    <LessonHskChrome
      courseHref={courseHref}
      courseNavLabel={navLabel}
      activeKey={activeKey}
      onSelect={setActiveKey}
      onPrev={goPrev}
      onNext={goNext}
    >
      {body}
    </LessonHskChrome>
  )
}
