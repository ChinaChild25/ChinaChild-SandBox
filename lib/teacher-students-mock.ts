/**
 * Ученики преподавателя (демо): журнал, прогресс, статичные слоты расписания до зеркала из кабинета ученика.
 */

import type { ScheduledLesson } from "@/lib/schedule-lessons"
import { SCHEDULE_DEFAULT_TEACHER } from "@/lib/schedule-lessons"

export type HskBand = "HSK 1" | "HSK 2" | "HSK 3" | "HSK 4"

export type TeacherStudentMock = {
  /** Демо-id в URL `/teacher/students/:id`, не UUID Supabase. */
  id: string
  name: string
  avatar: string
  group: string
  /**
   * Реальный `public.profiles.id` ученика в Supabase — тогда на карточке появится кнопка «Написать».
   * Оставьте пустым для чисто демо-учеников.
   */
  chatProfileId?: string
  homeworks: { done: number; total: number }
  attendance: { done: number; total: number }
  tests: { score: number; max: number }
  grade: { value: number; max: number }
  hskTarget: HskBand
  levelLabel: string
  strengths: string[]
  weaknesses: string[]
  tracks: { title: string; percent: number }[]
  lastTests: { title: string; score: number }[]
  /** Базовые слоты, если нет зеркала из localStorage */
  seedLessons: ScheduledLesson[]
}

const T = SCHEDULE_DEFAULT_TEACHER

function L(id: string, dateKey: string, time: string, title: string): ScheduledLesson {
  return {
    id,
    dateKey,
    time,
    title,
    type: "lesson",
    teacher: T
  }
}

/** Демо-расписание: пн/пт 19:00 в апреле 2026 для части учеников */
function seedAprilMonFri(prefix: string, days: number[]): ScheduledLesson[] {
  const out: ScheduledLesson[] = []
  for (const d of days) {
    const dateKey = `2026-04-${String(d).padStart(2, "0")}`
    out.push(L(`${prefix}-${d}-19`, dateKey, "19:00", "Урок китайского"))
  }
  return out
}

export const TEACHER_STUDENTS_MOCK: TeacherStudentMock[] = [
  {
    id: "user-1",
    /** Совпадает с закреплением в БД (profiles.assigned_teacher_id). Имя/фото в UI с Supabase подтягиваются из profiles. */
    chatProfileId: "92bba875-b74e-4836-be1c-9d5aecb574f9",
    name: "Ирина Т.",
    avatar: "/students/yana.png",
    group: "HSK2 · вечер",
    homeworks: { done: 8, total: 48 },
    attendance: { done: 9, total: 48 },
    tests: { score: 90, max: 100 },
    grade: { value: 92, max: 100 },
    hskTarget: "HSK 2",
    levelLabel: "Intermediate",
    strengths: ["Аудирование", "Иероглифика (база)"],
    weaknesses: ["Грамматика порядка слова", "Скорость чтения"],
    tracks: [
      { title: "HSK2 · лексика", percent: 62 },
      { title: "Грамматика B1", percent: 48 },
      { title: "Подготовка к тесту", percent: 55 }
    ],
    lastTests: [
      { title: "Лексика HSK2 — модуль 3", score: 88 },
      { title: "Грамматика: классификаторы", score: 76 }
    ],
    seedLessons: seedAprilMonFri("yana", [7, 11, 14, 18, 21])
  },
  {
    id: "stu-2",
    name: "Артём К.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK1 · утро",
    homeworks: { done: 12, total: 36 },
    attendance: { done: 11, total: 36 },
    tests: { score: 82, max: 100 },
    grade: { value: 85, max: 100 },
    hskTarget: "HSK 1",
    levelLabel: "Beginner",
    strengths: ["Произношение тонов", "Повседневные фразы"],
    weaknesses: ["Письмо иероглифов", "Слушание цифр"],
    tracks: [
      { title: "HSK1 · основы", percent: 72 },
      { title: "Пиньинь", percent: 90 }
    ],
    lastTests: [
      { title: "Урок 4 — приветствия", score: 91 },
      { title: "Мини-тест: числа", score: 74 }
    ],
    seedLessons: seedAprilMonFri("st2", [8, 15, 22])
  },
  {
    id: "stu-3",
    name: "Мария С.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK2 · вечер",
    homeworks: { done: 6, total: 48 },
    attendance: { done: 8, total: 48 },
    tests: { score: 78, max: 100 },
    grade: { value: 80, max: 100 },
    hskTarget: "HSK 2",
    levelLabel: "Elementary",
    strengths: ["Чтение коротких текстов"],
    weaknesses: ["Аудирование на скорости", "Устная связная речь"],
    tracks: [
      { title: "HSK2 · аудирование", percent: 38 },
      { title: "Грамматика", percent: 52 }
    ],
    lastTests: [{ title: "Диалоги бытовые", score: 71 }],
    seedLessons: seedAprilMonFri("st3", [9, 16, 23])
  },
  {
    id: "stu-4",
    name: "Илья В.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK3 · интенсив",
    homeworks: { done: 15, total: 40 },
    attendance: { done: 14, total: 40 },
    tests: { score: 88, max: 100 },
    grade: { value: 89, max: 100 },
    hskTarget: "HSK 3",
    levelLabel: "Intermediate",
    strengths: ["Грамматические конструкции", "Словообразование"],
    weaknesses: ["Идиоматика", "Длинные тексты"],
    tracks: [
      { title: "HSK3 · чтение", percent: 58 },
      { title: "Письмо", percent: 44 }
    ],
    lastTests: [{ title: "Пробный блок HSK3", score: 84 }],
    seedLessons: seedAprilMonFri("st4", [10, 17, 24])
  },
  {
    id: "stu-5",
    name: "Елена П.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK1 · вечер",
    homeworks: { done: 20, total: 36 },
    attendance: { done: 18, total: 36 },
    tests: { score: 94, max: 100 },
    grade: { value: 93, max: 100 },
    hskTarget: "HSK 1",
    levelLabel: "Beginner",
    strengths: ["Домашние задания", "Лексика"],
    weaknesses: ["Устная импровизация"],
    tracks: [
      { title: "HSK1", percent: 88 },
      { title: "Разговорный клуб", percent: 65 }
    ],
    lastTests: [{ title: "Итоговый HSK1", score: 95 }],
    seedLessons: seedAprilMonFri("st5", [4, 11, 25])
  },
  {
    id: "stu-6",
    name: "Дмитрий Н.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK2 · утро",
    homeworks: { done: 5, total: 48 },
    attendance: { done: 7, total: 48 },
    tests: { score: 70, max: 100 },
    grade: { value: 72, max: 100 },
    hskTarget: "HSK 2",
    levelLabel: "Elementary",
    strengths: ["Мотивация", "Словарный запас темы «работа»"],
    weaknesses: ["Систематичность ДЗ", "Грамматика сложных предложений"],
    tracks: [
      { title: "HSK2", percent: 35 },
      { title: "Повторение HSK1", percent: 60 }
    ],
    lastTests: [{ title: "Грамматика: 了", score: 63 }],
    seedLessons: seedAprilMonFri("st6", [14, 21, 28])
  },
  {
    id: "stu-7",
    name: "Ольга Ж.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK4 · подготовка",
    homeworks: { done: 18, total: 52 },
    attendance: { done: 17, total: 52 },
    tests: { score: 86, max: 100 },
    grade: { value: 87, max: 100 },
    hskTarget: "HSK 4",
    levelLabel: "Advanced",
    strengths: ["Чтение СМИ", "Скорость тестов"],
    weaknesses: ["Аудирование с акцентами", "Официальный стиль"],
    tracks: [
      { title: "HSK4 · экзамен", percent: 51 },
      { title: "Письмо 作文", percent: 47 }
    ],
    lastTests: [{ title: "Пробник HSK4 — чтение", score: 82 }],
    seedLessons: seedAprilMonFri("st7", [1, 8, 15, 22])
  },
  {
    id: "stu-8",
    name: "Кирилл Т.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK2 · вечер",
    homeworks: { done: 9, total: 48 },
    attendance: { done: 10, total: 48 },
    tests: { score: 81, max: 100 },
    grade: { value: 83, max: 100 },
    hskTarget: "HSK 2",
    levelLabel: "Intermediate",
    strengths: ["Говорение в парах"],
    weaknesses: ["Иероглифы без контекста"],
    tracks: [
      { title: "HSK2 · иероглифы", percent: 55 },
      { title: "Лексика путешествий", percent: 70 }
    ],
    lastTests: [{ title: "Тест: транспорт", score: 79 }],
    seedLessons: seedAprilMonFri("st8", [3, 10, 17])
  },
  {
    id: "stu-9",
    name: "Анна Л.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK1 · детская",
    homeworks: { done: 14, total: 30 },
    attendance: { done: 13, total: 30 },
    tests: { score: 91, max: 100 },
    grade: { value: 90, max: 100 },
    hskTarget: "HSK 1",
    levelLabel: "Beginner",
    strengths: ["Игровые задания", "Песни и рифмы"],
    weaknesses: ["Длительная концентрация"],
    tracks: [
      { title: "HSK1 детский", percent: 78 },
      { title: "Слух", percent: 85 }
    ],
    lastTests: [{ title: "Квиз: цвета и формы", score: 93 }],
    seedLessons: seedAprilMonFri("st9", [2, 9, 16])
  },
  {
    id: "stu-10",
    name: "Сергей М.",
    avatar: "/placeholders/student-avatar.svg",
    group: "HSK3 · вечер",
    homeworks: { done: 11, total: 44 },
    attendance: { done: 12, total: 44 },
    tests: { score: 79, max: 100 },
    grade: { value: 81, max: 100 },
    hskTarget: "HSK 3",
    levelLabel: "Intermediate",
    strengths: ["Деловая лексика"],
    weaknesses: ["Стилистика письма", "Устные монологи"],
    tracks: [
      { title: "HSK3 · бизнес", percent: 49 },
      { title: "Грамматика усложнённая", percent: 56 }
    ],
    lastTests: [{ title: "Письмо: письмо-клиенту", score: 74 }],
    seedLessons: seedAprilMonFri("st10", [4, 18, 25])
  }
]

export function getTeacherStudentById(id: string): TeacherStudentMock | undefined {
  return TEACHER_STUDENTS_MOCK.find((s) => s.id === id)
}
