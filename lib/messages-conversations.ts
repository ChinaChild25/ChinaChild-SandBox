import { mentorsBySlug } from "@/lib/mentors"

export type ChatMessage = { from: "me" | "them"; text: string; time: string }

export type Conversation = {
  id: string
  name: string
  role: string
  avatar: string | null
  lastMessage: string
  time: string
  unread: number
  seed: ChatMessage[]
}

const GROUP_ID = "group-hsk1"

function buildConversations(): Conversation[] {
  const curator = mentorsBySlug["eo-mi-ran"]
  const teacher = mentorsBySlug["zhao-li"]
  return [
    {
      id: curator.slug,
      name: curator.name,
      role: curator.role,
      avatar: curator.photo,
      lastMessage: "Не забудьте подготовить текст к завтрашнему уроку",
      time: "14:23",
      unread: 2,
      seed: [
        { from: "them", text: "Добрый день! Как ваши успехи в изучении китайского?", time: "12:00" },
        { from: "me", text: "Всё хорошо, работаю над тонами", time: "12:15" },
        { from: "them", text: "Отлично! Практикуйте каждый день — это ключ к успеху", time: "12:20" },
        { from: "them", text: "Не забудьте подготовить текст к завтрашнему уроку", time: "14:23" }
      ]
    },
    {
      id: teacher.slug,
      name: teacher.name,
      role: teacher.role,
      avatar: teacher.photo,
      lastMessage: "Домашнее задание принято, молодец!",
      time: "Вчера",
      unread: 0,
      seed: [
        { from: "me", text: "Здравствуйте! Я отправила домашнее задание по теме №7", time: "18:00" },
        { from: "them", text: "Получил, посмотрю сегодня вечером", time: "18:30" },
        { from: "them", text: "Домашнее задание принято, молодец!", time: "21:15" }
      ]
    },
    {
      id: GROUP_ID,
      name: "Группа HSK1",
      role: "Групповой чат",
      avatar: null,
      lastMessage: "Лю Фан: Напоминаю про домашку к пятнице",
      time: "10:05",
      unread: 5,
      seed: [
        { from: "them", text: "Всем привет! Не забудьте про встречу в пятницу", time: "9:00" },
        { from: "me", text: "Буду!", time: "9:05" },
        { from: "them", text: "Лю Фан: Напоминаю про домашку к пятнице", time: "10:05" }
      ]
    }
  ]
}

export const MESSAGES_CONVERSATIONS: Conversation[] = buildConversations()

export function getMessagesUnreadTotal(): number {
  return MESSAGES_CONVERSATIONS.reduce((s, c) => s + c.unread, 0)
}
