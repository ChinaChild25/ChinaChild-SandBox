import { FIGMA_TEACHERS } from "@/lib/figma-dashboard"

export type MentorReview = {
  author: string
  text: string
  stars: number
}

export type MentorScheduleSlot = {
  day: string
  time: string
}

export type MentorProfile = {
  slug: string
  name: string
  /** Короткая роль (чаты, списки) */
  role: string
  /** Подзаголовок под именем, напр. «Куратор группы · Преподаватель» */
  titleLine: string
  initials: string
  photo: string
  stats: {
    rating: string
    students: number
    lessons: number
    yearsExperience: number
  }
  about: string
  education: string
  reviews: MentorReview[]
  subjects: string[]
  languages: string[]
  scheduleSlots: MentorScheduleSlot[]
}

/** Профили как на макетах Figma (Чэнь Мэйлин / Ли Вэй) */
export const mentorsBySlug: Record<string, MentorProfile> = {
  "eo-mi-ran": {
    slug: "eo-mi-ran",
    name: FIGMA_TEACHERS[0].name,
    role: FIGMA_TEACHERS[0].role,
    titleLine: "Куратор группы · Преподаватель",
    initials: "ЧМ",
    photo: FIGMA_TEACHERS[0].photo,
    stats: {
      rating: "4,9",
      students: 120,
      lessons: 430,
      yearsExperience: 10
    },
    about:
      "Родилась и выросла в Пекине, свободно говорит на путунхуа и северном диалекте. Более десяти лет сопровождает группы по HSK: от постановки произношения до разбора письменных работ. На занятиях делает акцент на живой речи и культурном контексте — так проще запоминать лексику и не бояться говорить.",
    education: "Пекинский педагогический университет, факультет преподавания китайского как иностранного",
    reviews: [
      {
        author: "Мария К.",
        text: "Чэнь Мэйлин всегда на связи: подсказала, как распланировать неделю перед экзаменом, очень спокойно и по делу.",
        stars: 5
      },
      {
        author: "Антон В.",
        text: "После её обратной связи по эссе стало понятно, где именно я ошибаюсь в порядке слов. Рекомендую!",
        stars: 5
      }
    ],
    subjects: ["Разговорный клуб", "Произношение", "Культура Китая", "HSK1", "HSK2"],
    languages: ["Китайский", "Русский", "Английский"],
    scheduleSlots: [
      { day: "Вторник", time: "16:00–18:00" },
      { day: "Четверг", time: "18:00–20:00" },
      { day: "Суббота", time: "11:00–13:00" }
    ]
  },
  "kim-ji-hun": {
    slug: "kim-ji-hun",
    name: FIGMA_TEACHERS[1].name,
    role: FIGMA_TEACHERS[1].role,
    titleLine: "Преподаватель · Методист",
    initials: "ЛВ",
    photo: FIGMA_TEACHERS[1].photo,
    stats: {
      rating: "4,8",
      students: 95,
      lessons: 360,
      yearsExperience: 8
    },
    about:
      "Выпускник Шанхайского университета иностранных языков, специализируется на подготовке к HSK и развитии навыков аудирования. Объясняет грамматику через примеры из повседневной жизни и медиа; на уроках много практики с таймингом, как на реальном экзамене.",
    education: "Шанхайский университет иностранных языков, магистратура",
    reviews: [
      {
        author: "Дмитрий Р.",
        text: "С Ли Вэем разобрали аудирование HSK4 — стало заметно легче улавливать цифры и даты в диалогах.",
        stars: 5
      },
      {
        author: "Ольга М.",
        text: "Чёткая структура урока и много говорения. Чувствую прогресс уже через месяц.",
        stars: 5
      }
    ],
    subjects: ["Грамматика", "Иероглифы", "Подготовка к HSK", "HSK1", "HSK2", "Аудирование"],
    languages: ["Китайский", "Русский"],
    scheduleSlots: [
      { day: "Понедельник", time: "10:00–12:00" },
      { day: "Пятница", time: "14:00–16:00" },
      { day: "Суббота", time: "09:00–11:00" }
    ]
  }
}

export const mentorSlugs = Object.keys(mentorsBySlug)
