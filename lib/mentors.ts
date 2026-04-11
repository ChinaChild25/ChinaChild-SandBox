export type MentorProfile = {
  slug: string
  name: string
  role: string
  initials: string
  bio: string
  focus: string[]
}

export const mentorsBySlug: Record<string, MentorProfile> = {
  "eo-mi-ran": {
    slug: "eo-mi-ran",
    name: "Ео Ми-ран",
    role: "Куратор группы",
    initials: "ЕМ",
    bio: "Сопровождает учебный трек, следит за дедлайнами и связывает вас с преподавателями.",
    focus: ["организация занятий", "обратная связь по прогрессу", "адаптация расписания"]
  },
  "kim-ji-hun": {
    slug: "kim-ji-hun",
    name: "Ким Джи-хун",
    role: "Преподаватель",
    initials: "КД",
    bio: "Ведёт разговорную практику и разбор домашних заданий.",
    focus: ["разговорный клуб", "произношение", "HSK-подготовка"]
  }
}

export const mentorSlugs = Object.keys(mentorsBySlug)
