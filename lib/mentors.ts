import { FIGMA_TEACHERS } from "@/lib/figma-dashboard"

export type MentorProfile = {
  slug: string
  name: string
  role: string
  initials: string
  photo: string
  bio: string
  focus: string[]
}

/** Имена и фото как на chinachild.figma.site */
export const mentorsBySlug: Record<string, MentorProfile> = {
  "eo-mi-ran": {
    slug: "eo-mi-ran",
    name: FIGMA_TEACHERS[0].name,
    role: FIGMA_TEACHERS[0].role,
    initials: "ЧМ",
    photo: FIGMA_TEACHERS[0].photo,
    bio: "Сопровождает учебный трек, следит за дедлайнами и связывает вас с преподавателями.",
    focus: ["организация занятий", "обратная связь по прогрессу", "адаптация расписания"]
  },
  "kim-ji-hun": {
    slug: "kim-ji-hun",
    name: FIGMA_TEACHERS[1].name,
    role: FIGMA_TEACHERS[1].role,
    initials: "ЛВ",
    photo: FIGMA_TEACHERS[1].photo,
    bio: "Ведёт разговорную практику и разбор домашних заданий.",
    focus: ["разговорный клуб", "произношение", "HSK-подготовка"]
  }
}

export const mentorSlugs = Object.keys(mentorsBySlug)
