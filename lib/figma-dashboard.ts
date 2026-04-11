/**
 * Pixel-aligned copy & assets with published Figma site + Figmadasboard reference.
 * https://chinachild.figma.site/
 */

export const FIGMA_STUDENT_AVATAR =
  "https://images.unsplash.com/photo-1758270705555-015de348a48a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFzaWFuJTIwd29tYW4lMjBzdHVkZW50JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzc1ODM4NjkzfDA&ixlib=rb-4.1.0&q=80&w=400"

export const FIGMA_TEACHERS = [
  {
    slug: "eo-mi-ran" as const,
    name: "Чэнь Мэйлин",
    role: "куратор группы",
    photo:
      "https://images.unsplash.com/photo-1758873268174-1f1d6a919a2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMHRlYWNoZXIlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzc1ODM4Njk0fDA&ixlib=rb-4.1.0&q=80&w=200"
  },
  {
    slug: "kim-ji-hun" as const,
    name: "Ли Вэй",
    role: "преподаватель",
    photo:
      "https://images.unsplash.com/photo-1544168190-79c17527004f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbGUlMjB0ZWFjaGVyJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzc1Nzg3NjAwfDA&ixlib=rb-4.1.0&q=80&w=200"
  }
] as const

/** Same rows as Figmadasboard Dashboard.tsx / chinachild.figma.site */
export const FIGMA_UPCOMING_LESSONS = [
  {
    id: "figma-1",
    date: 11,
    time: "9:00–12:00",
    title: "Урок №10",
    description: "Числа на китайском. Как использовать 是.",
    bgColor: "#1a1a1a",
    textColor: "#ffffff",
    href: "/hsk1-tema10" as const
  },
  {
    id: "figma-2",
    date: 11,
    time: "16:00–18:00",
    title: "Разговорный клуб",
    description: "Обсуждение фильма «Прощай, моя наложница»",
    bgColor: "#e5e5e5",
    textColor: "#1a1a1a",
    hasIndicator: true,
    href: "/schedule" as const
  },
  {
    id: "figma-3",
    date: 12,
    time: "9:00–10:00",
    title: "Тест №2",
    description: "Контроль знаний по всем предыдущим темам.",
    bgColor: "#f4c4c4",
    textColor: "#1a1a1a",
    href: "/hsk-1" as const
  },
  {
    id: "figma-4",
    date: 12,
    time: "11:00–12:00",
    title: "Разговорный клуб",
    description: "Обсуждение любимых книг",
    bgColor: "#e5e5e5",
    textColor: "#1a1a1a",
    href: "/schedule" as const
  },
  {
    id: "figma-5",
    date: 13,
    time: "9:00–14:00",
    title: "Экскурсия в Запретный город",
    description: "Посещение дворцового комплекса. Билет: 60 юаней",
    bgColor: "#d4e7b0",
    textColor: "#1a1a1a",
    href: "/schedule" as const
  }
] as const

/** April 2025 — Tuesday 1st → offset 2 (вс=0), как в Figmadasboard */
export const FIGMA_CALENDAR = {
  monthTitle: "апрель",
  year: 2025,
  startOffset: 2,
  eventDays: [11, 15, 18, 22, 24, 25, 29, 30] as const,
  today: 11
} as const

export const FIGMA_CONTINUE_LESSON = {
  title: "HSK1 — Тема №8: Самопрезентация",
  subtitle: "Продолжить с того места, где остановились",
  href: "/hsk1-tema8" as const
} as const
