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
  /** Куратор и преподаватель — разные сущности для ученика */
  staffKind: "curator" | "teacher"
  /** Логин Telegram без @ (ссылка https://t.me/…) */
  telegramUsername: string
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
  /** Карточка «Ваша группа» (как на макете профиля) */
  group?: {
    name: string
    description: string
    ctaHref: string
  }
  /** Только куратор: текст о сопровождении (если нет — на странице куратора используется about) */
  curatorIntro?: string
  /** Только куратор: зоны ответственности */
  curatorFocus?: string[]
}

/** Профили: куратор / преподаватель (имена и фото — FIGMA_TEACHERS) */
export const mentorsBySlug: Record<string, MentorProfile> = {
  "eo-mi-ran": {
    slug: "eo-mi-ran",
    name: FIGMA_TEACHERS[0].name,
    staffKind: "curator",
    telegramUsername: "chinachild_curator_demo",
    role: FIGMA_TEACHERS[0].role,
    titleLine: "Куратор группы · сопровождение учёбы",
    initials: "ДГ",
    photo: FIGMA_TEACHERS[0].photo,
    stats: {
      rating: "4,9",
      students: 120,
      lessons: 430,
      yearsExperience: 10
    },
    about:
      "Сопровождает учеников ChinaChild по вопросам расписания, платформы и прогресса. Помогает не потеряться в дедлайнах и быстро связаться с преподавателем, если нужна отдельная обратная связь. Уроки и методику ведёт ваш преподаватель — зона куратора это организация и поддержка.",
    curatorIntro:
      "Помогаю не потеряться в расписании и дедлайнах: отвечаю в чате, напоминаю о важном и связываю с преподавателем, если нужна отдельная обратная связь. Уроки и методику ведёт ваш преподаватель — моя зона это сопровождение и организация.",
    curatorFocus: [
      "Расписание, переносы и напоминания о занятиях",
      "Вопросы по прогрессу, домашним заданиям и платформе",
      "Оплата, документы и доступы к материалам"
    ],
    education: "Сопровождение образовательных программ, работа со студентами онлайн",
    reviews: [
      {
        author: "Мария К.",
        text: "Денис всегда на связи: подсказал, как распланировать неделю перед экзаменом, очень спокойно и по делу.",
        stars: 5
      },
      {
        author: "Антон В.",
        text: "После его обратной связи по организации занятий стало понятно, куда смотреть в первую очередь. Рекомендую!",
        stars: 5
      }
    ],
    subjects: ["Разговорный клуб", "Произношение", "Культура Китая", "HSK1", "HSK2"],
    languages: ["Китайский", "Русский", "Английский"],
    /** Fallback; при mentor_page_slug = "eo-mi-ran" и шаблоне в БД подставляется weekly_template. */
    scheduleSlots: [
      { day: "Понедельник", time: "09:00–22:00 (МСК)" },
      { day: "Вторник", time: "09:00–22:00 (МСК)" },
      { day: "Среда", time: "09:00–22:00 (МСК)" },
      { day: "Четверг", time: "09:00–22:00 (МСК)" },
      { day: "Пятница", time: "09:00–22:00 (МСК)" }
    ],
    group: {
      name: "Группа HSK1",
      description: "Утренние занятия по понедельникам и средам. Материалы и домашние задания — в разделе «Занятия».",
      ctaHref: "/classes"
    }
  },
  "zhao-li": {
    slug: "zhao-li",
    name: FIGMA_TEACHERS[1].name,
    staffKind: "teacher",
    telegramUsername: "chinachild_teacher_demo",
    role: FIGMA_TEACHERS[1].role,
    titleLine: "Преподаватель · Методист",
    initials: "ЧЛ",
    photo: FIGMA_TEACHERS[1].photo,
    stats: {
      rating: "4,8",
      students: 95,
      lessons: 360,
      yearsExperience: 8
    },
    about:
      "Выпускница Шанхайского университета иностранных языков, специализируется на подготовке к HSK и развитии навыков аудирования. Объясняет грамматику через примеры из повседневной жизни и медиа; на уроках много практики с таймингом, как на реальном экзамене.",
    education: "Шанхайский университет иностранных языков, магистратура",
    reviews: [
      {
        author: "Дмитрий Р.",
        text: "С Чжао Ли разобрали аудирование HSK4 — стало заметно легче улавливать цифры и даты в диалогах.",
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
    /** Fallback, если в БД нет строки шаблона или не задан profiles.mentor_page_slug = "zhao-li". */
    scheduleSlots: [
      { day: "Понедельник", time: "10:00–12:00" },
      { day: "Пятница", time: "14:00–16:00" },
      { day: "Суббота", time: "09:00–11:00" }
    ],
    group: {
      name: "Группа HSK2",
      description: "Вечерние слоты, упор на аудирование и лексику по учебнику.",
      ctaHref: "/classes"
    }
  }
}

export const mentorSlugs = Object.keys(mentorsBySlug)
