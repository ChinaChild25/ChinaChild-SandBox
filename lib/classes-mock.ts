import { mockLessons } from "@/lib/mock-data"

export type ClassDisplayType = "Урок" | "Тест"

export type ClassListItem = {
  id: string
  dateLabel: string
  monthShort: string
  timeRange: string
  title: string
  description: string
  type: ClassDisplayType
  status: "upcoming" | "completed"
  teacher: string
  bgColor: string
  textColor: string
  grade?: number | null
  slug?: string
}

const ONLINE_TEACHER = "Чжао Ли"

function lessonTitleToType(title: string, lessonType: string): ClassDisplayType {
  if (title.includes("Тест") || title.toLowerCase().includes("тест")) return "Тест"
  if (lessonType === "Quiz") return "Тест"
  return "Урок"
}

const visualByType: Record<ClassDisplayType, { bg: string; text: string }> = {
  Урок: { bg: "#d8d9e0", text: "#1a1a1a" },
  Тест: { bg: "#f4c4c4", text: "#1a1a1a" }
}

/** Предстоящие и прошедшие — только онлайн-уроки и при необходимости тесты */
export function getClassesForStudent(): ClassListItem[] {
  const fromLessons: ClassListItem[] = mockLessons.map((l) => {
    const d = new Date(l.scheduledDate)
    const type = lessonTitleToType(l.title, l.type)
    const vis = visualByType[type]
    const day = d.getDate()
    const monthShort = d.toLocaleString("ru-RU", { month: "short" }).replace(".", "")
    return {
      id: l.id,
      dateLabel: String(day),
      monthShort,
      timeRange: l.duration,
      title: l.title,
      description: l.titleChinese,
      type,
      status: l.status === "completed" ? "completed" : "upcoming",
      teacher: ONLINE_TEACHER,
      bgColor: vis.bg,
      textColor: vis.text,
      slug: l.slug
    }
  })

  const completed: ClassListItem[] = [
    {
      id: "past-1",
      dateLabel: "5",
      monthShort: "апр",
      timeRange: "19:00–20:00",
      title: "Урок №9",
      description: "Приветствия и прощания. Повторение пиньинь.",
      type: "Урок",
      status: "completed",
      teacher: ONLINE_TEACHER,
      bgColor: "#f5f5f5",
      textColor: "#888888",
      grade: 95,
      slug: "hsk1-tema9"
    },
    {
      id: "past-2",
      dateLabel: "4",
      monthShort: "апр",
      timeRange: "19:00–20:00",
      title: "Урок №8",
      description: "Самопрезентация и простые вопросы.",
      type: "Урок",
      status: "completed",
      teacher: ONLINE_TEACHER,
      bgColor: "#f5f5f5",
      textColor: "#888888",
      grade: null,
      slug: "hsk1-tema8"
    }
  ]

  return [...fromLessons, ...completed]
}
