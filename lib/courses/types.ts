export type ContentStatus = "ready" | "pending_extraction"

export type LessonSource = {
  note?: string
  htmlBlocks?: string[]
  markdown?: string[]
  repoAudio?: string
}

export type LessonMeta = {
  id: string
  module: string
  title: string
  chinese?: string
  lead?: string
  badge?: string
  googleSlidesEmbed?: string
  googleSlidesEmbedHtml?: string
}

export type RoadmapItem = { id: string; label: string; text: string }

export type PresentationSlide = { title: string; text: string }

export type AudioTrack = {
  id: string
  title: string
  author: string
  url: string
}

export type VocabTab = {
  id: string
  label: string
  cards: { hanzi: string; pinyin: string; meaning: string }[]
}

export type VisualizerMode = { id: string; label: string }

export type DialogueTabDef = { id: string; label: string }

export type DialogueTexts = {
  text1: { title: string; lead: string; body: string }
  text2: { title: string; lead: string; body: string }
  soundladder: {
    title: string
    lead: string
    items: { text: string; note: string }[]
  }
  repeat: { title: string; lead: string; items: { text: string; note: string }[] }
}

export type CharacterLesson = {
  strokes: { id: string; label: string; path: string; text: string }[]
  steps: string[]
  tracePaths: string[]
}

export type GamesData = {
  toneQuiz: { id: string; prompt: string; options: string[]; correct: string }[]
  syllableQuiz: {
    id: string
    prompt: string
    initial: string
    finals: string[]
    correct: string
  }[]
  wordPairs: { left: string; right: string }[]
}

export type LessonPayload = {
  meta: LessonMeta
  roadmap: RoadmapItem[]
  presentationSlides: PresentationSlide[]
  audioTracks: AudioTrack[]
  vocabTabs: VocabTab[]
  visualizerModes: VisualizerMode[]
  dialogueTabs: DialogueTabDef[]
  dialogueTexts: DialogueTexts
  character: CharacterLesson
  speakingPrompts: { text: string; note: string }[]
  games: GamesData
  homeworkTasks: string[]
}

export type CourseLessonFile = {
  schemaVersion: 1
  slug: string
  courseId: "hsk1" | "hsk2"
  kind: "lesson" | "final_test"
  contentStatus: ContentStatus
  source?: LessonSource
  /** Optional hero imagery (lesson 1: reference photos). */
  heroMedia?: { alt: string; url: string }[]
  data: LessonPayload | null
  /** When data is null, mirrors course-catalog title for UI. */
  catalogTitle?: string
  catalogTopicNumber?: number
}
