import { getBlockMeta, normalizeTeacherLessonBlock } from "@/lib/lesson-builder-blocks"
import type { LessonBlockType, TeacherLessonBlock } from "@/lib/types"
import type { UiLocale } from "@/lib/ui-messages"

const BLOCK_LABELS_BY_LOCALE: Record<UiLocale, Record<LessonBlockType, string>> = {
  ru: {
    hero: "Введение",
    text: "Текст",
    video: "Видео",
    image: "Картинка",
    quiz_single: "Тест",
    quiz_multi: "Тест",
    matching: "Сопоставление",
    fill_gaps: "Пропуски",
    sentence_builder: "Порядок слов",
    flashcards: "Словарь",
    homework: "Домашнее задание",
    audio: "Аудио",
    pdf: "PDF",
    speaking: "Речь",
    note: "Заметка",
    link: "Ссылка",
    divider: "Раздел",
  },
  en: {
    hero: "Intro",
    text: "Text",
    video: "Video",
    image: "Image",
    quiz_single: "Quiz",
    quiz_multi: "Quiz",
    matching: "Matching",
    fill_gaps: "Fill gaps",
    sentence_builder: "Word order",
    flashcards: "Vocabulary",
    homework: "Homework",
    audio: "Audio",
    pdf: "PDF",
    speaking: "Speaking",
    note: "Note",
    link: "Link",
    divider: "Section",
  },
  zh: {
    hero: "导入",
    text: "文本",
    video: "视频",
    image: "图片",
    quiz_single: "测验",
    quiz_multi: "测验",
    matching: "配对",
    fill_gaps: "填空",
    sentence_builder: "语序",
    flashcards: "词汇",
    homework: "作业",
    audio: "音频",
    pdf: "PDF",
    speaking: "口语",
    note: "备注",
    link: "链接",
    divider: "分区",
  },
}

function containsLatin(text: string) {
  return /[A-Za-z]/.test(text)
}

export function localizedLessonBlockLabel(type: LessonBlockType, locale: UiLocale = "ru") {
  return BLOCK_LABELS_BY_LOCALE[locale][type]
}

export function getLessonBlockDisplayTitle(block: TeacherLessonBlock, locale: UiLocale = "ru") {
  const normalized = normalizeTeacherLessonBlock(block)
  const rawTitle = getBlockMeta(normalized).title.trim()
  const fallback = localizedLessonBlockLabel(normalized.type, locale)

  if (!rawTitle) return fallback
  if (containsLatin(rawTitle)) return fallback
  return rawTitle
}
