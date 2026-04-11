export type MentorProfile = {
  slug: string
  name: string
  role: string
  initials: string
  /** Avatar for dashboard / lists (Figma-style round photo). */
  photo: string
  bio: string
  focus: string[]
}

export const mentorsBySlug: Record<string, MentorProfile> = {
  "eo-mi-ran": {
    slug: "eo-mi-ran",
    name: "Ео Ми-ран",
    role: "Куратор группы",
    initials: "ЕМ",
    photo: "/placeholders/curator-avatar.svg",
    bio: "Сопровождает учебный трек, следит за дедлайнами и связывает вас с преподавателями.",
    focus: ["организация занятий", "обратная связь по прогрессу", "адаптация расписания"]
  },
  "kim-ji-hun": {
    slug: "kim-ji-hun",
    name: "Ким Джи-хун",
    role: "Преподаватель",
    initials: "КД",
    photo: "/placeholders/teacher-avatar.svg",
    bio: "Ведёт разговорную практику и разбор домашних заданий.",
    focus: ["разговорный клуб", "произношение", "HSK-подготовка"]
  }
}

export const mentorSlugs = Object.keys(mentorsBySlug)
