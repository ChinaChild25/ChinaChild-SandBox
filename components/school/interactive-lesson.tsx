"use client"

import type { LessonPayload } from "@/lib/courses/types"

import { AudioPlayer } from "@/components/school/audio-player"
import { DialoguePanel } from "@/components/school/dialogue-panel"
import { HomeworkChecklist } from "@/components/school/homework-checklist"
import { LessonBlock } from "@/components/school/lesson-block"
import { LessonCharacter } from "@/components/school/lesson-character"
import { LessonVisualizer } from "@/components/school/lesson-visualizer"
import { LessonWhimsy } from "@/components/school/lesson-whimsy"
import { QuizBlocks } from "@/components/school/quiz-blocks"
import { VocabTabs } from "@/components/school/vocab-tabs"

type HeroItem = { alt: string; url: string }

type Props = {
  data: LessonPayload
  heroMedia?: HeroItem[]
}

export function InteractiveLesson({ data, heroMedia = [] }: Props) {
  const { meta, roadmap, presentationSlides, audioTracks, vocabTabs, visualizerModes, dialogueTabs, dialogueTexts, character, games, homeworkTasks } = data

  return (
    <div className="cc-lesson-flow">
      <header className="cc-lesson-card cc-lesson-card--glass cc-lesson-hero">
        <div className="cc-lesson-hero-main">
          <div className="cc-lesson-head">
            <span className="cc-lesson-eyebrow">{meta.badge ?? "Урок"}</span>
            <p className="cc-lesson-module-line">{meta.module}</p>
            <h1>{meta.title}</h1>
            {meta.chinese ? (
              <p className="cc-lesson-chinese-line">{meta.chinese}</p>
            ) : null}
            <p className="cc-lesson-lead">{meta.lead}</p>
          </div>

          {heroMedia.length > 0 ? (
            <div className="cc-lesson-hero-grid">
              {heroMedia.map((img) => (
                <figure key={img.url} className="min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash URLs; avoids image config */}
                  <img
                    src={img.url}
                    alt={img.alt}
                    width={1200}
                    height={800}
                    className="cc-lesson-hero-img"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption className="cc-lesson-hero-caption">{img.alt}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="cc-lesson-roadmap cc-lesson-roadmap--scroll" aria-label="Разделы урока">
          {roadmap.map((r) => (
            <a key={r.id} href={`#${r.id}`}>
              {r.label}
              <span>{r.text}</span>
            </a>
          ))}
        </nav>
      </header>

      <div className="cc-lesson-track">
        <LessonBlock id="cc-l1-slides" eyebrow="Маршрут" title="С чего начнём" intro={<p className="cc-lesson-block-intro">Короткий план: сначала опоры, потом слух и слова, затем речь и письмо.</p>} className="cc-lesson-card--veil">
          <div className="cc-lesson-grid-2">
            {presentationSlides.map((s, i) => (
              <div key={i} className="cc-lesson-pillcard">
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="sound" />
        </div>

        <LessonBlock id="cc-l1-audio" eyebrow="Слух" title="Повторяй за диктором" className="cc-lesson-card--veil">
          <AudioPlayer tracks={audioTracks} />
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="memo" />
        </div>

        <LessonBlock id="cc-l1-vocab" eyebrow="Лексика" title="Слова, которые пригодятся сразу" className="cc-lesson-card--veil">
          <VocabTabs tabs={vocabTabs} />
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="spark" />
        </div>

        <LessonBlock id="cc-l1-visualizer" eyebrow="Пиньинь" title="Собери произношение" className="cc-lesson-card--veil">
          <LessonVisualizer modes={visualizerModes} />
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="speech" />
        </div>

        <LessonBlock id="cc-l1-dialogue" eyebrow="Речь" title="Живые фразы и интонация" className="cc-lesson-card--veil">
          <DialoguePanel tabs={dialogueTabs} texts={dialogueTexts} />
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="pencil" />
        </div>

        <LessonBlock id="cc-l1-character" eyebrow="Письмо" title="Черты и иероглиф 妈" className="cc-lesson-card--veil">
          <LessonCharacter character={character} />
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="star" />
        </div>

        <LessonBlock id="cc-l1-games" eyebrow="Проверка" title="Быстрые вопросы" className="cc-lesson-card--veil">
          <QuizBlocks games={games} />
        </LessonBlock>

        <div className="cc-lesson-whimsy-wrap">
          <LessonWhimsy kind="memo" />
        </div>

        <LessonBlock id="cc-l1-homework" eyebrow="Самостоятельно" title="Закрепи материал" className="cc-lesson-card--veil">
          <HomeworkChecklist tasks={homeworkTasks} />
        </LessonBlock>
      </div>

      <section className="cc-lesson-card cc-lesson-card--glass" id="cc-l1-finish">
        <span className="cc-lesson-eyebrow">Финал</span>
        <h2 className="cc-lesson-section-title">Итог урока</h2>
        <p className="cc-lesson-note mt-3">
          Ты уверенно держишь слух, пиньинь и письмо. Для первого урока это уже очень крепкий результат.
        </p>
      </section>
    </div>
  )
}
