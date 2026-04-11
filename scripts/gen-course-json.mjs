import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const dataRoot = path.join(root, "data", "courses")

const lesson1Data = {
  meta: {
    id: "hsk1_l1",
    module: "Модуль 1",
    title: "Тема №1 — Пиньинь, базовые штрихи",
    chinese: "拼音，基本笔画",
    lead: "Знакомимся с системой пиньиня, слышим разницу между тонами и начинаем писать первые базовые черты.",
    badge: "Фонетический старт",
    googleSlidesEmbed: "",
    googleSlidesEmbedHtml: ""
  },
  roadmap: [
    { id: "cc-l1-audio", label: "Аудио", text: "Повторяй за диктором" },
    { id: "cc-l1-vocab", label: "Слова", text: "Быстрый словарь урока" },
    { id: "cc-l1-visualizer", label: "Пиньинь", text: "Конструктор произношения" },
    { id: "cc-l1-dialogue", label: "Речь", text: "Тексты и речевая практика" },
    { id: "cc-l1-character", label: "Письмо", text: "Черты и иероглиф" },
    { id: "cc-l1-games", label: "Игра", text: "Закрепление" },
    { id: "cc-l1-homework", label: "Практика", text: "Самостоятельно" },
    { id: "cc-l1-finish", label: "Финал", text: "Итог урока" }
  ],
  presentationSlides: [
    {
      title: "Что такое пиньинь",
      text: "Пиньинь помогает записывать китайское произношение латиницей и быстро связывать звук со словом."
    },
    {
      title: "Из чего состоит слог",
      text: "Китайский слог складывается из инициали, финали и тона. Тон нельзя отрывать от слова."
    },
    {
      title: "Четыре тона",
      text: "mā, má, mǎ, mà звучат как одна база ma, но означают разные слова из-за мелодии."
    },
    {
      title: "Базовые черты",
      text: "Перед иероглифами мы осваиваем пять базовых движений: горизонталь, вертикаль, две диагонали и точку."
    },
    {
      title: "Первый иероглиф",
      text: "На уроке мы собираем 妈 по шагам и закрепляем форму через обводку штрихов."
    }
  ],
  audioTracks: [
    {
      id: "track_1",
      title: "Тема №1 — Пиньинь, базовые штрихи. Текст 1",
      author: "ChinaChild",
      url: "https://raw.githubusercontent.com/ChinaChild25/HSK1/main/HSK%201.%20Модуль%201.%20Тема%20№1%20—%20Пиньинь%2C%20базовые%20штрихи.%20Текст%201.mp3"
    },
    {
      id: "track_2",
      title: "Тема №1 — Пиньинь, базовые штрихи. Задание 2",
      author: "ChinaChild",
      url: "https://raw.githubusercontent.com/ChinaChild25/HSK1/main/HSK%201.%20Модуль%201.%20Тема%20№1%20—%20Пиньинь%2C%20базовые%20штрихи.%20Задание%202.mp3"
    },
    {
      id: "track_3",
      title: "Тема №1 — Пиньинь, базовые штрихи. Задание 5",
      author: "ChinaChild",
      url: "https://raw.githubusercontent.com/ChinaChild25/HSK1/main/HSK%201.%20Модуль%201.%20Тема%20№1%20—%20Пиньинь%2C%20базовые%20штрихи.%20Задание%205.mp3"
    },
    {
      id: "track_4",
      title: "Тема №1 — Пиньинь, базовые штрихи. Задание 7",
      author: "ChinaChild",
      url: "https://raw.githubusercontent.com/ChinaChild25/HSK1/main/HSK%201.%20Модуль%201.%20Тема%20№1%20—%20Пиньинь%2C%20базовые%20штрихи.%20Задание%207.mp3"
    },
    {
      id: "track_5",
      title: "Тема №1 — Пиньинь, базовые штрихи. Задание 9",
      author: "ChinaChild",
      url: "https://raw.githubusercontent.com/ChinaChild25/HSK1/main/HSK%201.%20Модуль%201.%20Тема%20№1%20—%20Пиньинь%2C%20базовые%20штрихи.%20Задание%209.mp3"
    }
  ],
  vocabTabs: [
    {
      id: "initials",
      label: "Инициали",
      cards: [
        { hanzi: "b", pinyin: "b", meaning: "Губная согласная" },
        { hanzi: "p", pinyin: "p", meaning: "Губная согласная с придыханием" },
        { hanzi: "m", pinyin: "m", meaning: "Носовой звук" },
        { hanzi: "f", pinyin: "f", meaning: "Губно-зубной звук" }
      ]
    },
    {
      id: "finals",
      label: "Финали",
      cards: [
        { hanzi: "a", pinyin: "a", meaning: "Открытая финаль" },
        { hanzi: "o", pinyin: "o", meaning: "Глубокая округлая финаль" },
        { hanzi: "e", pinyin: "e", meaning: "Нейтральная финаль" },
        { hanzi: "i", pinyin: "i", meaning: "Высокая передняя финаль" },
        { hanzi: "u", pinyin: "u", meaning: "Высокая задняя финаль" },
        { hanzi: "ü", pinyin: "ü", meaning: "Передняя округлая финаль" }
      ]
    },
    {
      id: "tones",
      label: "Тоны",
      cards: [
        { hanzi: "¯", pinyin: "1 тон", meaning: "Ровный высокий" },
        { hanzi: "´", pinyin: "2 тон", meaning: "Восходящий" },
        { hanzi: "ˇ", pinyin: "3 тон", meaning: "Падающе-восходящий" },
        { hanzi: "`", pinyin: "4 тон", meaning: "Резко нисходящий" },
        { hanzi: "·", pinyin: "Нейтральный", meaning: "Короткий и лёгкий" }
      ]
    },
    {
      id: "words",
      label: "Примеры",
      cards: [
        { hanzi: "八", pinyin: "bā", meaning: "восемь" },
        { hanzi: "爸", pinyin: "bà", meaning: "папа" },
        { hanzi: "不", pinyin: "bù", meaning: "нет / не" },
        { hanzi: "妈", pinyin: "mā", meaning: "мама" },
        { hanzi: "马", pinyin: "mǎ", meaning: "лошадь" },
        { hanzi: "米饭", pinyin: "mǐfàn", meaning: "рис" }
      ]
    }
  ],
  visualizerModes: [
    { id: "system", label: "Система" },
    { id: "tones", label: "Тоны" },
    { id: "builder", label: "Собери слог" },
    { id: "articulation", label: "Артикуляция" }
  ],
  dialogueTabs: [
    { id: "text1", label: "Текст 1" },
    { id: "soundladder", label: "Практика слога" },
    { id: "text2", label: "Текст 2" },
    { id: "repeat", label: "Повтори звук" }
  ],
  dialogueTexts: {
    text1: {
      title: "Текст 1",
      lead: "Пиньинь — это способ записывать китайское произношение латиницей.",
      body: "Китайский слог складывается из инициали, финали и тона. Даже если согласная и гласная не меняются, тон меняет слово. Поэтому в начале курса мы тренируем не только форму слога, но и его мелодию."
    },
    soundladder: {
      title: "Практика слога",
      lead: "Одна база, разные тоны.",
      items: [
        { text: "bā / bá / bǎ / bà", note: "Следи, чтобы менялся только тон, а не сам звук." },
        { text: "pā / pá / pǎ / pà", note: "Придыхание у p должно оставаться заметным." },
        { text: "mā / má / mǎ / mà", note: "Это самый важный слуховой паттерн урока." },
        { text: "fā / fá / fǎ / fà", note: "Хорошо тренирует переход от ровного к резкому нисходящему тону." }
      ]
    },
    text2: {
      title: "Текст 2",
      lead: "Все китайские иероглифы состоят из черт.",
      body: "Самые простые знаки могут иметь всего одну черту, а более сложные — десятки. Черты пишутся в определённом порядке, и именно это создаёт ощущение правильной формы. Если регулярно писать знак одинаково, рука начинает запоминать структуру."
    },
    repeat: {
      title: "Повтори звук",
      lead: "Нажимай на карточку после того, как действительно проговорил её вслух.",
      items: []
    }
  },
  character: {
    strokes: [
      {
        id: "heng",
        label: "横 (héng)",
        path: "M28 150 L272 150",
        text: "Ровная горизонтальная черта. Держит форму и ширину знака."
      },
      {
        id: "shu",
        label: "竖 (shù)",
        path: "M150 28 L150 272",
        text: "Вертикальная ось. Её нельзя заваливать в сторону."
      },
      {
        id: "pie",
        label: "撇 (piě)",
        path: "M238 54 Q176 124 72 244",
        text: "Левая нисходящая черта, задаёт движение вниз-влево."
      },
      {
        id: "na",
        label: "捺 (nà)",
        path: "M70 74 Q172 124 254 244",
        text: "Правая нисходящая черта, часто завершает форму."
      },
      {
        id: "dian",
        label: "点 (diǎn)",
        path: "M144 66 Q166 92 178 136",
        text: "Короткий, но точный жест. Это не точка-капля, а полноценная черта."
      }
    ],
    steps: [
      "Сначала левая часть 女: стартовое движение.",
      "Вторая черта раскрывает левую часть вниз-влево.",
      "Горизонталь завершает 女.",
      "Дальше начинается правая часть 马.",
      "Главная ломаная черта даёт каркас правого элемента.",
      "Финальная горизонталь завершает знак."
    ],
    tracePaths: [
      "M88 62 Q80 88 96 114",
      "M118 58 Q92 112 72 146",
      "M88 116 L148 116",
      "M166 80 L226 80 L226 112",
      "M226 112 L226 165 Q224 196 202 206",
      "M178 176 L244 176"
    ]
  },
  speakingPrompts: [
    { text: "bā bá bǎ bà", note: "Скажи 4 тона подряд без спешки." },
    { text: "mā má mǎ mà", note: "Сохрани одну и ту же основу ma, меняй только тон." },
    { text: "bō bó bǒ bò", note: "Следи, чтобы звук o оставался стабильным." },
    { text: "fā fá fǎ fà", note: "Сначала ровно, затем вверх, вниз-вверх и резко вниз." }
  ],
  games: {
    toneQuiz: [
      { id: "tone_1", prompt: "Какой тон у mā?", options: ["1 тон", "2 тон", "3 тон"], correct: "1 тон" },
      { id: "tone_2", prompt: "Какой тон у mǎ?", options: ["2 тон", "3 тон", "4 тон"], correct: "3 тон" },
      { id: "tone_3", prompt: "Какой тон у bà?", options: ["4 тон", "1 тон", "Нейтральный"], correct: "4 тон" }
    ],
    syllableQuiz: [
      { id: "syllable_1", prompt: "Собери слог для “мама”", initial: "m", finals: ["a", "o", "i"], correct: "a" },
      { id: "syllable_2", prompt: "Собери слог для “восемь”", initial: "b", finals: ["a", "e", "u"], correct: "a" },
      { id: "syllable_3", prompt: "Собери слог для “Будда”", initial: "f", finals: ["o", "u", "e"], correct: "o" }
    ],
    wordPairs: [
      { left: "八 (bā)", right: "восемь" },
      { left: "爸 (bà)", right: "папа" },
      { left: "妈 (mā)", right: "мама" },
      { left: "马 (mǎ)", right: "лошадь" }
    ]
  },
  homeworkTasks: [
    "Повтори вслух 4 цепочки с тонами.",
    "Напиши 5 базовых черт по памяти.",
    "Напиши 妈 по шагам хотя бы 2 раза.",
    "Прослушай минимум 2 аудиодорожки ещё раз."
  ]
}

lesson1Data.dialogueTexts.repeat.items = lesson1Data.speakingPrompts

const hsk1Lessons = [
  { slug: "hsk1-tema1", title: "Тема №1 — Пиньинь, базовые штрихи", n: 1 },
  { slug: "hsk1-tema2", title: "Тема №2 — Пиньинь, числа", n: 2 },
  { slug: "hsk1-tema3", title: "Тема №3 — Приветствия", n: 3 },
  { slug: "hsk1-tema4", title: "Тема №4 — Даты", n: 4 },
  { slug: "hsk1-tema5", title: "Тема №5 — Возраст", n: 5 },
  { slug: "hsk1-tema6", title: "Тема №6 — Телефонные номера", n: 6 },
  { slug: "hsk1-tema7", title: "Тема №7 — Члены семьи", n: 7 },
  { slug: "hsk1-tema8", title: "Тема №8 — Самопрезентация", n: 8 },
  { slug: "hsk1-tema9", title: "Тема №9 — Профессии", n: 9 },
  { slug: "hsk1-tema10", title: "Тема №10 — Время", n: 10 },
  { slug: "hsk1-tema11", title: "Тема №11 — Повседневный распорядок", n: 11 },
  { slug: "hsk1-tema12", title: "Тема №12 — Транспорт", n: 12 },
  { slug: "hsk1-tema13", title: "Тема №13 — Цвета", n: 13 },
  { slug: "hsk1-tema14", title: "Тема №14 — Одежда", n: 14 },
  { slug: "hsk1-tema15", title: "Тема №15 — Части тела", n: 15 }
]

const hsk1Tests = [
  { slug: "hsk1-versions1-5", title: "Варианты HSK1 1–5" },
  { slug: "hsk1-versions6-10", title: "Варианты HSK1 6–10" },
  { slug: "hsk1-versions11-15", title: "Варианты HSK1 11–15" },
  { slug: "hsk-1", title: "Интерактивный диагностический тест HSK 1" }
]

const hsk2Lessons = [
  { slug: "hsk2-tema1", title: "Тема №1 — Страны и языки (国家、语言)", n: 1 },
  { slug: "hsk2-tema2", title: "Тема №2 — Учебные предметы (科目)", n: 2 },
  { slug: "hsk2-tema3", title: "Тема №3 — Совершение телефонных звонков (打电话)", n: 3 },
  { slug: "hsk2-tema4", title: "Тема №4 — Погода (天气)", n: 4 },
  { slug: "hsk2-tema5", title: "Тема №5 — Времена года (季节)", n: 5 },
  { slug: "hsk2-tema6", title: "Тема №6 — Болезни, здоровье (生病)", n: 6 },
  { slug: "hsk2-tema7", title: "Тема №7 — Хобби: Музыка (爱好（一）：音乐)", n: 7 },
  { slug: "hsk2-tema8", title: "Тема №8 — Хобби: Спорт (爱好（二）：运动)", n: 8 },
  { slug: "hsk2-tema9", title: "Тема №9 — Хобби: Танцы (爱好（三）：舞蹈)", n: 9 },
  { slug: "hsk2-tema10", title: "Тема №10 — Овощи и фрукты (蔬菜、水果)", n: 10 },
  { slug: "hsk2-tema11", title: "Тема №11 — Три приёма пищи в день (一日三餐)", n: 11 },
  { slug: "hsk2-tema12", title: "Тема №12 — Еда вне дома (外出就餐)", n: 12 },
  { slug: "hsk2-tema13", title: "Тема №13 — Дом (房子)", n: 13 },
  { slug: "hsk2-tema14", title: "Тема №14 — Мебель (家具)", n: 14 },
  { slug: "hsk2-tema15", title: "Тема №15 — Окружающий район (社区)", n: 15 }
]

const hsk2Tests = [
  { slug: "hsk2-versions1-5", title: "Варианты HSK2 1–5" },
  { slug: "hsk2-versions6-10", title: "Варианты HSK2 6–10" },
  { slug: "hsk2-versions11-15", title: "Варианты HSK2 11–15" }
]

function writeJson(relDir, name, obj) {
  const dir = path.join(dataRoot, relDir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(obj, null, 2), "utf-8")
}

function stubLesson(courseId, slug, title, topicNum) {
  return {
    schemaVersion: 1,
    slug,
    courseId,
    kind: "lesson",
    contentStatus: "pending_extraction",
    source: {
      note:
        "Контент импортируется из презентаций курса «轻松学中文» и учебников Easy Step to Chinese (PDF) по пайплайну PPTX/PDF; не заполнять выдуманными фразами.",
      markdown: ["Playground/hsk1_lesson_skeleton.md"],
      htmlBlocks: [
        "Playground/hsk1_lesson1_blocks/ — эталон структуры интерактивного урока (применить к теме после извлечения PPTX)"
      ]
    },
    heroMedia: [],
    data: null,
    catalogTitle: title,
    catalogTopicNumber: topicNum
  }
}

function stubTest(courseId, slug, title) {
  const base =
    courseId === "hsk1"
      ? "Playground/HSK1 Final Test Updated/ (block-01-core.html … — данные финального теста)"
      : "HSK2: исходные блоки финального теста из базы HSK Lessons and Tests (импорт по аналогии с HSK1 Final Test Updated)"
  return {
    schemaVersion: 1,
    slug,
    courseId,
    kind: "final_test",
    contentStatus: "pending_extraction",
    source: {
      note: "Интерактивный тест: извлечь вопросы и аудио из HTML-блоков и репозитория материалов.",
      htmlBlocks: [base]
    },
    heroMedia: [],
    data: null,
    catalogTitle: title
  }
}

const lesson1File = {
  schemaVersion: 1,
  slug: "hsk1-tema1",
  courseId: "hsk1",
  kind: "lesson",
  contentStatus: "ready",
  source: {
    htmlBlocks: [
      "Playground/hsk1_lesson1_blocks/block-01-core.html",
      "Playground/hsk1_lesson1_blocks/block-06-dialogue-speaking-lab.html"
    ],
    markdown: ["Playground/hsk1_lesson_skeleton.md"],
    repoAudio: "https://github.com/ChinaChild25/HSK1"
  },
  heroMedia: [
    {
      alt: "Классная доска и конспект — атмосфера занятия",
      url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80"
    },
    {
      alt: "Учебные материалы и тетрадь",
      url: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80"
    }
  ],
  data: lesson1Data
}

writeJson("hsk1", "hsk1-tema1", lesson1File)

for (const L of hsk1Lessons) {
  if (L.slug === "hsk1-tema1") continue
  writeJson("hsk1", L.slug, stubLesson("hsk1", L.slug, L.title, L.n))
}
for (const T of hsk1Tests) {
  writeJson("hsk1", T.slug, stubTest("hsk1", T.slug, T.title))
}

for (const L of hsk2Lessons) {
  const s = stubLesson("hsk2", L.slug, L.title, L.n)
  s.source.markdown = ["Playground/hsk1_lesson_skeleton.md (структурный эталон для уроков)"]
  writeJson("hsk2", L.slug, s)
}
for (const T of hsk2Tests) {
  writeJson("hsk2", T.slug, stubTest("hsk2", T.slug, T.title))
}

console.log("Wrote data/courses/hsk1/*.json and data/courses/hsk2/*.json")
