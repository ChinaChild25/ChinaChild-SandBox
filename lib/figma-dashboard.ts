/**
 * Копирайт и данные как на https://chinachild.figma.site/ (светлый макет).
 */

export const FIGMA_STUDENT_AVATAR =
  "https://images.unsplash.com/photo-1758270705555-015de348a48a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFzaWFuJTIwd29tYW4lMjBzdHVkZW50JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzc1ODM4NjkzfDA&ixlib=rb-4.1.0&q=80&w=400"

export const FIGMA_TEACHERS = [
  {
    slug: "eo-mi-ran" as const,
    name: "Денис Гасенко",
    role: "куратор группы",
    photo: "/staff/denis-gasenko-curator.png"
  },
  {
    slug: "kim-ji-hun" as const,
    name: "Ли Вэй",
    role: "преподаватель",
    photo:
      "https://images.unsplash.com/photo-1544168190-79c17527004f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbGUlMjB0ZWFjaGVyJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzc1Nzg3NjAwfDA&ixlib=rb-4.1.0&q=80&w=200"
  }
] as const

export const FIGMA_UPCOMING_LESSONS = [
  {
    id: "figma-1",
    date: 7,
    time: "19:00–20:00",
    title: "Урок №10",
    description: "Числа на китайском. Как использовать 是.",
    bgColor: "#1a1a1a",
    textColor: "#ffffff",
    href: "/hsk1-tema10" as const
  },
  {
    id: "figma-2",
    date: 11,
    time: "19:00–20:00",
    title: "Урок №11",
    description: "Повседневный распорядок и время суток.",
    bgColor: "#1a1a1a",
    textColor: "#ffffff",
    href: "/hsk1-tema11" as const
  },
  {
    id: "figma-3",
    date: 14,
    time: "19:00–20:00",
    title: "Урок №12",
    description: "Транспорт и дорога до школы.",
    bgColor: "#1a1a1a",
    textColor: "#ffffff",
    href: "/hsk1-tema12" as const
  },
  {
    id: "figma-4",
    date: 18,
    time: "19:00–20:00",
    title: "Урок №13",
    description: "Цвета и простые описания.",
    bgColor: "#1a1a1a",
    textColor: "#ffffff",
    href: "/hsk1-tema13" as const
  },
  {
    id: "figma-5",
    date: 21,
    time: "19:00–20:00",
    title: "Урок №14",
    description: "Одежда и погода.",
    bgColor: "#1a1a1a",
    textColor: "#ffffff",
    href: "/hsk1-tema14" as const
  }
] as const

export const FIGMA_CALENDAR = {
  monthTitle: "апрель",
  year: 2026,
  startOffset: 3,
  /** Пн/пт с занятиями в апреле */
  eventDays: [3, 7, 10, 14, 17, 21, 24, 28] as const,
  today: 12
} as const

/** Первые 4 пункта в блоке «Предстоящие занятия» на главной */
export const FIGMA_DASHBOARD_LESSONS = FIGMA_UPCOMING_LESSONS.slice(0, 4)

export const FIGMA_CONTINUE_LESSON = {
  title: "HSK1 — Тема №8: Самопрезентация",
  subtitle: "Продолжить с того места, где остановились",
  href: "/hsk1-tema8" as const
} as const
