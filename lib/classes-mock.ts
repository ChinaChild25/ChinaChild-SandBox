import { getAppNow } from "@/lib/app-time"
import { mockLessons } from "@/lib/mock-data"

export type ClassDisplayType = "Урок" | "Тест"

export type ClassListItem = {
  id: string
  /** YYYY-MM-DD — для логики «сегодня» и сортировки */
  isoDate: string
  /** Время начала урока для сортировки */
  sortKey: number
  /** Читаемая дата, напр. «7 апреля 2026 г.» */
  dateLineRu: string
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

/** Границы урока по дате и строке вида «19:00–20:00» (тире или дефис) */
export function lessonBoundsFromScheduled(isoDate: string, duration: string): { start: Date; end: Date } {
  const [rawA, rawB] = duration.split(/\s*[–-]\s*/)
  const parseHm = (s: string) => {
    const [h, m] = s.trim().split(":").map((x) => parseInt(x, 10))
    return { h: h || 0, m: Number.isFinite(m) ? m : 0 }
  }
  const a = parseHm(rawA ?? "0:0")
  const b = parseHm(rawB ?? rawA ?? "0:0")
  const [y, mo, d] = isoDate.split("-").map((x) => parseInt(x, 10))
  const start = new Date(y, mo - 1, d, a.h, a.m, 0, 0)
  const end = new Date(y, mo - 1, d, b.h, b.m, 0, 0)
  return { start, end }
}

function formatClassDateRu(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10))
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

function classListItemFromMockLesson(l: (typeof mockLessons)[0]): ClassListItem {
  const d = new Date(l.scheduledDate + "T12:00:00")
  const type = lessonTitleToType(l.title, l.type)
  const vis = visualByType[type]
  const day = d.getDate()
  const monthShort = d.toLocaleString("ru-RU", { month: "short" }).replace(".", "")
  const { start, end } = lessonBoundsFromScheduled(l.scheduledDate, l.duration)
  const now = getAppNow().getTime()
  const status: "upcoming" | "completed" = now >= end.getTime() ? "completed" : "upcoming"
  return {
    id: l.id,
    isoDate: l.scheduledDate,
    sortKey: start.getTime(),
    dateLineRu: formatClassDateRu(l.scheduledDate),
    dateLabel: String(day),
    monthShort,
    timeRange: l.duration,
    title: l.title,
    description: l.titleChinese,
    type,
    status,
    teacher: ONLINE_TEACHER,
    bgColor: vis.bg,
    textColor: vis.text,
    slug: l.slug
  }
}

/** Онлайн-подключение: только в календарный день занятия (логика приложения) и до окончания слота */
export function canJoinOnlineClass(isoDate: string, timeRange: string): boolean {
  const { start, end } = lessonBoundsFromScheduled(isoDate, timeRange)
  const now = getAppNow()
  const sameDay =
    now.getFullYear() === start.getFullYear() &&
    now.getMonth() === start.getMonth() &&
    now.getDate() === start.getDate()
  if (!sameDay) return false
  if (now.getTime() >= end.getTime()) return false
  return true
}

/** Предстоящие и прошедшие — статус по «сейчас» приложения, порядок по дате урока */
export function getClassesForStudent(): ClassListItem[] {
  const fromLessons = mockLessons.map(classListItemFromMockLesson)

  const completedStatic: ClassListItem[] = [
    {
      id: "past-1",
      isoDate: "2026-04-05",
      sortKey: lessonBoundsFromScheduled("2026-04-05", "19:00–20:00").start.getTime(),
      dateLineRu: formatClassDateRu("2026-04-05"),
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
      isoDate: "2026-04-04",
      sortKey: lessonBoundsFromScheduled("2026-04-04", "19:00–20:00").start.getTime(),
      dateLineRu: formatClassDateRu("2026-04-04"),
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

  const all = [...fromLessons, ...completedStatic]
  const upcoming = all.filter((c) => c.status === "upcoming").sort((a, b) => a.sortKey - b.sortKey)
  const done = all.filter((c) => c.status === "completed").sort((a, b) => b.sortKey - a.sortKey)
  return [...upcoming, ...done]
}
