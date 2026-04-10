import type { User, Course, Lesson, Notification, Achievement, LearningResource } from "./types"

export const mockUser: User = {
  id: "user-1",
  email: "yana@chinachild.ru",
  name: "Яна",
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
    instructor: "Чэнь Мэй",
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
    title: "Урок #10",
    titleChinese: "Китайские числительные. Как использовать 是.",
    duration: "9:00–12:00",
    scheduledDate: "2026-04-10",
    scheduledTime: "10:00 AM",
    type: "Live",
    status: "upcoming"
  },
  {
    id: "lesson-2",
    courseId: "course-3",
    title: "Разговорный клуб",
    titleChinese: "Обсуждение фильма MALMOE",
    duration: "16:00–18:00",
    scheduledDate: "2026-04-10",
    scheduledTime: "2:00 PM",
    type: "Video",
    status: "upcoming"
  },
  {
    id: "lesson-3",
    courseId: "course-4",
    title: "Тест #2",
    titleChinese: "Контроль прогресса. Тест по прошлым темам.",
    duration: "9:00–10:00",
    scheduledDate: "2026-04-11",
    scheduledTime: "11:00 AM",
    type: "Video",
    status: "upcoming"
  },
  {
    id: "lesson-4",
    courseId: "course-2",
    title: "Разговорный клуб",
    titleChinese: "Обсуждение любимых книг",
    duration: "11:00–12:00",
    scheduledDate: "2026-04-12",
    scheduledTime: "9:30 AM",
    type: "Practice",
    status: "upcoming"
  },
  {
    id: "lesson-5",
    courseId: "course-3",
    title: "Посещение Гугуна",
    titleChinese: "Экскурсия по Запретному городу. Билет: 30 CNY",
    duration: "9:00–14:00",
    scheduledDate: "2026-04-13",
    scheduledTime: "3:00 PM",
    type: "Quiz",
    status: "upcoming"
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
