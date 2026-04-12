import type { User, Course, Lesson, Notification, Achievement, LearningResource } from "./types"

export const mockUser: User = {
  id: "user-1",
  email: "yana@example.com",
  name: "Яна",
  assignedCuratorSlug: "eo-mi-ran",
  assignedTeacherSlug: "kim-ji-hun",
  phone: "+7 999 123-45-67",
  profileSubtitle: "студентка 1 степени",
  avatar: undefined,
  dashboardStats: {
    attendedLessons: 9,
    lessonGoal: 48,
    completedHomework: 8,
    homeworkGoal: 48,
    averageScore: 93
  },
  level: "Intermediate",
  joinDate: "2025-09-15",
  learningStreak: 12,
  totalLessonsCompleted: 47,
  totalStudyHours: 126
}

export const mockCourses: Course[] = [
  {
    id: "course-1",
    title: "Основы китайского языка",
    titleChinese: "汉语基础",
    description: "Освойте основы: тоны, пиньинь и базовую лексику.",
    level: "Beginner",
    totalLessons: 24,
    completedLessons: 24,
    progress: 100,
    instructor: "Ли Вэй",
    thumbnail: "/courses/fundamentals.jpg",
    category: "Speaking",
    enrolled: true
  },
  {
    id: "course-2",
    title: "Деловой китайский",
    titleChinese: "商务汉语",
    description: "Китайский для переговоров, рабочих встреч и деловой переписки.",
    level: "Intermediate",
    totalLessons: 20,
    completedLessons: 12,
    progress: 60,
    instructor: "Чжан Мин",
    thumbnail: "/courses/business.jpg",
    category: "Speaking",
    enrolled: true
  },
  {
    id: "course-3",
    title: "Иероглифика: продвинутый блок",
    titleChinese: "汉字精通",
    description: "Чтение и письмо ключевых иероглифов, порядок черт и практика.",
    level: "Elementary",
    totalLessons: 30,
    completedLessons: 18,
    progress: 60,
    instructor: "Ван Фан",
    thumbnail: "/courses/characters.jpg",
    category: "Writing",
    enrolled: true
  },
  {
    id: "course-4",
    title: "Культура и традиции Китая",
    titleChinese: "中国文化与传统",
    description: "Изучение традиций, праздников и культурных контекстов через язык.",
    level: "Intermediate",
    totalLessons: 16,
    completedLessons: 4,
    progress: 25,
    instructor: "Денис Гасенко",
    thumbnail: "/courses/culture.jpg",
    category: "Culture",
    enrolled: true
  },
  {
    id: "course-5",
    title: "Подготовка к HSK 4",
    titleChinese: "HSK四级备考",
    description: "Комплексная подготовка к международному экзамену HSK 4.",
    level: "Intermediate",
    totalLessons: 40,
    completedLessons: 0,
    progress: 0,
    instructor: "Лю Хуа",
    thumbnail: "/courses/hsk.jpg",
    category: "Grammar",
    enrolled: false
  },
  {
    id: "course-6",
    title: "Продвинутое чтение",
    titleChinese: "高级阅读理解",
    description: "Работа со сложными текстами: новости, статьи и учебные материалы.",
    level: "Advanced",
    totalLessons: 25,
    completedLessons: 0,
    progress: 0,
    instructor: "Чжао Цзин",
    thumbnail: "/courses/reading.jpg",
    category: "Reading",
    enrolled: false
  }
]

export const mockLessons: Lesson[] = [
  {
    id: "lesson-1",
    courseId: "course-2",
    title: "Урок №10",
    titleChinese: "Числа на китайском. Как использовать 是.",
    duration: "19:00–20:00",
    scheduledDate: "2026-04-07",
    scheduledTime: "7:00 PM",
    type: "Live",
    status: "upcoming",
    slug: "hsk1-tema10"
  },
  {
    id: "lesson-2",
    courseId: "course-2",
    title: "Урок №11",
    titleChinese: "Повседневный распорядок и время суток.",
    duration: "19:00–20:00",
    scheduledDate: "2026-04-11",
    scheduledTime: "7:00 PM",
    type: "Live",
    status: "upcoming",
    slug: "hsk1-tema11"
  },
  {
    id: "lesson-3",
    courseId: "course-2",
    title: "Урок №12",
    titleChinese: "Транспорт и дорога до школы.",
    duration: "19:00–20:00",
    scheduledDate: "2026-04-14",
    scheduledTime: "7:00 PM",
    type: "Live",
    status: "upcoming",
    slug: "hsk1-tema12"
  },
  {
    id: "lesson-4",
    courseId: "course-2",
    title: "Урок №13",
    titleChinese: "Цвета и простые описания.",
    duration: "19:00–20:00",
    scheduledDate: "2026-04-18",
    scheduledTime: "7:00 PM",
    type: "Live",
    status: "upcoming",
    slug: "hsk1-tema13"
  },
  {
    id: "lesson-5",
    courseId: "course-2",
    title: "Урок №14",
    titleChinese: "Одежда и погода.",
    duration: "19:00–20:00",
    scheduledDate: "2026-04-21",
    scheduledTime: "7:00 PM",
    type: "Live",
    status: "upcoming",
    slug: "hsk1-tema14"
  }
]

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    title: "Скоро начнётся занятие",
    message: "Ваш урок «Китайские числительные» начнётся через 1 час.",
    type: "lesson",
    read: false,
    createdAt: "2026-04-10T09:00:00"
  },
  {
    id: "notif-2",
    title: "Новое достижение!",
    message: "Вы получили значок «Недельный ритм» за серию из 7 дней.",
    type: "achievement",
    read: false,
    createdAt: "2026-04-09T18:00:00"
  },
  {
    id: "notif-3",
    title: "Доступен новый курс",
    message: "Открылся курс подготовки к HSK 5 — старт на следующей неделе.",
    type: "system",
    read: true,
    createdAt: "2026-04-08T10:00:00"
  },
  {
    id: "notif-4",
    title: "Напоминание о практике",
    message: "Сегодня вы ещё не делали разговорную практику. Поддержите серию!",
    type: "reminder",
    read: true,
    createdAt: "2026-04-07T20:00:00"
  }
]

export const mockAchievements: Achievement[] = [
  {
    id: "achieve-1",
    title: "Первые шаги",
    description: "Завершите первый урок",
    icon: "footprints",
    unlockedAt: "2025-09-16"
  },
  {
    id: "achieve-2",
    title: "Недельный ритм",
    description: "Поддерживайте серию занятий 7 дней подряд",
    icon: "flame",
    unlockedAt: "2025-09-22"
  },
  {
    id: "achieve-3",
    title: "Чемпион иероглифов",
    description: "Выучите 100 китайских иероглифов",
    icon: "pen-tool",
    unlockedAt: "2025-11-10"
  },
  {
    id: "achieve-4",
    title: "Мастер тонов",
    description: "Получите максимальный балл в тесте на тоны",
    icon: "music",
    unlockedAt: "2025-10-05"
  },
  {
    id: "achieve-5",
    title: "Клуб 100+",
    description: "Наберите более 100 часов обучения",
    icon: "clock",
    unlockedAt: "2026-03-15"
  },
  {
    id: "achieve-6",
    title: "Путь полиглота",
    description: "Достигните продвинутого уровня",
    icon: "trophy",
    progress: 75
  }
]

export const mockResources: LearningResource[] = [
  {
    id: "resource-1",
    title: "Справочник по пиньиню",
    titleChinese: "拼音参考指南",
    type: "PDF",
    category: "Произношение",
    downloadUrl: "/resources/pinyin-guide.pdf"
  },
  {
    id: "resource-2",
    title: "Аудио для тренировки тонов",
    titleChinese: "声调练习音频",
    type: "Audio",
    category: "Произношение",
    downloadUrl: "/resources/tones.mp3"
  },
  {
    id: "resource-3",
    title: "Карточки лексики HSK 4",
    titleChinese: "HSK四级词汇卡",
    type: "Flashcards",
    category: "Лексика",
    downloadUrl: "/resources/hsk4-vocab.json"
  },
  {
    id: "resource-4",
    title: "Анимация порядка черт",
    titleChinese: "笔画顺序动画",
    type: "Video",
    category: "Письмо",
    downloadUrl: "/resources/strokes.mp4"
  },
  {
    id: "resource-5",
    title: "Таблица распространённых ключей",
    titleChinese: "常用部首表",
    type: "PDF",
    category: "Письмо",
    downloadUrl: "/resources/radicals.pdf"
  },
  {
    id: "resource-6",
    title: "Аудио деловых фраз",
    titleChinese: "商务短语音频",
    type: "Audio",
    category: "Деловой китайский",
    downloadUrl: "/resources/business-audio.mp3"
  }
]
