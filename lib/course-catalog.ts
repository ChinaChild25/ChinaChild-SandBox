export type CourseLesson = {
  title: string
  slug: string
}

export type CourseCatalog = {
  id: "hsk1" | "hsk2"
  name: "HSK1" | "HSK2"
  description: string
  /** Основной цвет обложки курса */
  coverColor: string
  /** Более насыщенный акцент для прогресса, иконок и активных элементов */
  accentColor: string
  /** Целевой охват лексики по программе HSK */
  newWordsCount: number
  /** Количество аудиофрагментов в JSON-уроках курса (data.audioTracks) */
  audioCount: number
  lessons: CourseLesson[]
}

export const courseCatalog: CourseCatalog[] = [
  {
    id: "hsk1",
    name: "HSK1",
    description: "Базовый уровень: фонетика, базовая грамматика и повседневные темы.",
    coverColor: "#F4D56E",
    accentColor: "#D29A12",
    newWordsCount: 150,
    audioCount: 5,
    lessons: [
      { title: "Тема №1 — Пиньинь, базовые штрихи", slug: "hsk1-tema1" },
      { title: "Тема №2 — Пиньинь, числа", slug: "hsk1-tema2" },
      { title: "Тема №3 — Приветствия", slug: "hsk1-tema3" },
      { title: "Тема №4 — Даты", slug: "hsk1-tema4" },
      { title: "Тема №5 — Возраст", slug: "hsk1-tema5" },
      { title: "Тема №6 — Телефонные номера", slug: "hsk1-tema6" },
      { title: "Тема №7 — Члены семьи", slug: "hsk1-tema7" },
      { title: "Тема №8 — Самопрезентация", slug: "hsk1-tema8" },
      { title: "Тема №9 — Профессии", slug: "hsk1-tema9" },
      { title: "Тема №10 — Время", slug: "hsk1-tema10" },
      { title: "Тема №11 — Повседневный распорядок", slug: "hsk1-tema11" },
      { title: "Тема №12 — Транспорт", slug: "hsk1-tema12" },
      { title: "Тема №13 — Цвета", slug: "hsk1-tema13" },
      { title: "Тема №14 — Одежда", slug: "hsk1-tema14" },
      { title: "Тема №15 — Части тела", slug: "hsk1-tema15" },
      { title: "Варианты HSK1 1–5", slug: "hsk1-versions1-5" },
      { title: "Варианты HSK1 6–10", slug: "hsk1-versions6-10" },
      { title: "Варианты HSK1 11–15", slug: "hsk1-versions11-15" },
      { title: "Интерактивный диагностический тест HSK 1", slug: "hsk-1" }
    ]
  },
  {
    id: "hsk2",
    name: "HSK2",
    description: "Расширение словаря и практика речевых ситуаций среднего базового уровня.",
    coverColor: "#73D0D7",
    accentColor: "#1597AA",
    newWordsCount: 300,
    audioCount: 0,
    lessons: [
      { title: "Тема №1 — Страны и языки (国家、语言)", slug: "hsk2-tema1" },
      { title: "Тема №2 — Учебные предметы (科目)", slug: "hsk2-tema2" },
      { title: "Тема №3 — Совершение телефонных звонков (打电话)", slug: "hsk2-tema3" },
      { title: "Тема №4 — Погода (天气)", slug: "hsk2-tema4" },
      { title: "Тема №5 — Времена года (季节)", slug: "hsk2-tema5" },
      { title: "Тема №6 — Болезни, здоровье (生病)", slug: "hsk2-tema6" },
      { title: "Тема №7 — Хобби: Музыка (爱好（一）：音乐)", slug: "hsk2-tema7" },
      { title: "Тема №8 — Хобби: Спорт (爱好（二）：运动)", slug: "hsk2-tema8" },
      { title: "Тема №9 — Хобби: Танцы (爱好（三）：舞蹈)", slug: "hsk2-tema9" },
      { title: "Тема №10 — Овощи и фрукты (蔬菜、水果)", slug: "hsk2-tema10" },
      { title: "Тема №11 — Три приёма пищи в день (一日三餐)", slug: "hsk2-tema11" },
      { title: "Тема №12 — Еда вне дома (外出就餐)", slug: "hsk2-tema12" },
      { title: "Тема №13 — Дом (房子)", slug: "hsk2-tema13" },
      { title: "Тема №14 — Мебель (家具)", slug: "hsk2-tema14" },
      { title: "Тема №15 — Окружающий район (社区)", slug: "hsk2-tema15" },
      { title: "Варианты HSK2 1–5", slug: "hsk2-versions1-5" },
      { title: "Варианты HSK2 6–10", slug: "hsk2-versions6-10" },
      { title: "Варианты HSK2 11–15", slug: "hsk2-versions11-15" }
    ]
  }
]

export const lessonBySlug = Object.fromEntries(
  courseCatalog.flatMap((course) =>
    course.lessons.map((lesson, index) => [
      lesson.slug,
      { ...lesson, courseId: course.id, courseName: course.name, index: index + 1 }
    ])
  )
) as Record<
  string,
  CourseLesson & { courseId: CourseCatalog["id"]; courseName: CourseCatalog["name"]; index: number }
>

export const lessonSlugs = Object.keys(lessonBySlug)
