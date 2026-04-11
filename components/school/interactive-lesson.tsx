"use client"

import type { LessonPayload } from "@/lib/courses/types"

import { AudioPlayer } from "@/components/school/audio-player"
import { DialoguePanel } from "@/components/school/dialogue-panel"
import { HomeworkChecklist } from "@/components/school/homework-checklist"
import { LessonBlock } from "@/components/school/lesson-block"
import { LessonCharacter } from "@/components/school/lesson-character"
import { LessonVisualizer } from "@/components/school/lesson-visualizer"
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
    <>
      <header className="cc-lesson-card">
        <div className="cc-lesson-head">
          <span className="cc-lesson-eyebrow">{meta.badge ?? "Урок"}</span>
          <p className="mt-3 text-sm font-semibold text-[var(--cc-hsk-muted)]">{meta.module}</p>
          <h1>{meta.title}</h1>
          {meta.chinese ? (
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cc-hsk-text)]">{meta.chinese}</p>
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
                  className="max-h-[220px] w-full rounded-[var(--cc-radius-lg)] object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="mt-2 text-xs text-[var(--cc-hsk-muted)]">{img.alt}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}

        <nav className="cc-lesson-roadmap mt-6" aria-label="Разделы урока">
          {roadmap.map((r) => (
            <a key={r.id} href={`#${r.id}`}>
              {r.label}
              <span>{r.text}</span>
            </a>
          ))}
        </nav>
      </header>

      <LessonBlock id="cc-l1-slides" eyebrow="План" title="Ключевые тезисы">
        <div className="cc-lesson-grid-2">
          {presentationSlides.map((s, i) => (
            <div key={i} className="cc-lesson-pillcard">
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </LessonBlock>

      <LessonBlock id="cc-l1-audio" eyebrow="Аудио" title="Повторяй за диктором">
        <AudioPlayer tracks={audioTracks} />
      </LessonBlock>

      <LessonBlock id="cc-l1-vocab" eyebrow="Слова" title="Быстрый словарь урока">
        <VocabTabs tabs={vocabTabs} />
      </LessonBlock>

      <LessonBlock id="cc-l1-visualizer" eyebrow="Пиньинь" title="Конструктор пиньиня">
        <LessonVisualizer modes={visualizerModes} />
      </LessonBlock>

      <LessonBlock id="cc-l1-dialogue" eyebrow="Речь" title="Тексты и речевая практика">
        <DialoguePanel tabs={dialogueTabs} texts={dialogueTexts} />
      </LessonBlock>

      <LessonBlock id="cc-l1-character" eyebrow="Письмо" title="Черты и иероглиф 妈">
        <LessonCharacter character={character} />
      </LessonBlock>

      <LessonBlock id="cc-l1-games" eyebrow="Игра" title="Закрепление">
        <QuizBlocks games={games} />
      </LessonBlock>

      <LessonBlock id="cc-l1-homework" eyebrow="Практика" title="Самостоятельно">
        <HomeworkChecklist tasks={homeworkTasks} />
      </LessonBlock>

      <section className="cc-lesson-card" id="cc-l1-finish">
        <span className="cc-lesson-eyebrow">Финал</span>
        <h2 className="cc-lesson-section-title">Итог урока</h2>
        <p className="cc-lesson-note mt-3">
          Ты уверенно держишь слух, пиньинь и письмо. Для первого урока это уже очень крепкий результат.
        </p>
      </section>
    </>
  )
}
