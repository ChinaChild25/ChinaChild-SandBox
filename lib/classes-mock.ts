import { mockLessons } from "@/lib/mock-data"
import { mentorsBySlug } from "@/lib/mentors"

export type ClassDisplayType = "Урок" | "Разговорный клуб" | "Тест"

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

function lessonTitleToType(title: string, lessonType: string): ClassDisplayType {
  if (title.includes("Тест") || title.toLowerCase().includes("тест")) return "Тест"
  if (title.includes("Разговорный") || title.includes("клуб")) return "Разговорный клуб"
  if (title.includes("Посещение") || title.includes("Экскурсия")) return "Урок"
  if (lessonType === "Quiz") return "Тест"
  return "Урок"
}

const visualByType: Record<ClassDisplayType, { bg: string; text: string }> = {
  Урок: { bg: "#1a1a1a", text: "#ffffff" },
  "Разговорный клуб": { bg: "#e5e5e5", text: "#1a1a1a" },
  Тест: { bg: "#f4c4c4", text: "#1a1a1a" }
}

const teacherPool = [mentorsBySlug["kim-ji-hun"]?.name ?? "Преподаватель", mentorsBySlug["eo-mi-ran"]?.name ?? "Куратор"]

function pickTeacher(i: number) {
  return teacherPool[i % teacherPool.length]
}

/** Upcoming + sample past rows aligned with Figma «Занятия» structure. */
export function getClassesForStudent(): ClassListItem[] {
  const fromLessons: ClassListItem[] = mockLessons.map((l, i) => {
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
      teacher: pickTeacher(i),
      bgColor: l.title.includes("Посещение") || l.title.includes("Гугун") ? "#d4e7b0" : vis.bg,
      textColor: l.title.includes("Посещение") || l.title.includes("Гугун") ? "#1a1a1a" : vis.text,
      slug: l.slug
    }
  })

  const completed: ClassListItem[] = [
    {
      id: "past-1",
      dateLabel: "5",
      monthShort: "апр",
      timeRange: "9:00–12:00",
      title: "Урок №9",
      description: "Приветствия и прощания. Повторение пиньинь.",
      type: "Урок",
      status: "completed",
      teacher: pickTeacher(0),
      bgColor: "#f5f5f5",
      textColor: "#888888",
      grade: 95,
      slug: "hsk1-tema9"
    },
    {
      id: "past-2",
      dateLabel: "7",
      monthShort: "апр",
      timeRange: "16:00–18:00",
      title: "Разговорный клуб",
      description: "Разговор о семье и профессиях",
      type: "Разговорный клуб",
      status: "completed",
      teacher: pickTeacher(1),
      bgColor: "#f5f5f5",
      textColor: "#888888",
      grade: null,
      slug: "hsk1-tema8"
    }
  ]

  return [...fromLessons, ...completed]
}
