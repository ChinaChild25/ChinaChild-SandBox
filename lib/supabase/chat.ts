import type { SupabaseClient } from "@supabase/supabase-js"
import { displayNameFromProfileFields, type ProfileRow } from "@/lib/supabase/profile"

export type ChatProfileSnippet = Pick<
  ProfileRow,
  "id" | "first_name" | "last_name" | "full_name" | "role" | "avatar_url"
>

/** Строка `public.conversations`. */
export type Conversation = {
  id: string
  created_by: string
  created_at: string
}

/** Строка `public.conversation_participants`. */
export type ConversationParticipant = {
  conversation_id: string
  user_id: string
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export type ConversationListItem = {
  id: string
  peer: ChatProfileSnippet
  lastMessage: string
  lastMessageAt: string | null
}

export type ChatBubble = {
  id: string
  from: "me" | "them"
  text: string
  createdAt: string
  timeLabel: string
}

function roleLabelRu(role: string): string {
  const r = role.trim().toLowerCase()
  if (r === "teacher") return "Преподаватель"
  if (r === "student") return "Ученик"
  return role
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Короткая подпись времени для пузырей и списка (локаль ru). */
export function formatChatTimeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  if (isSameCalendarDay(d, now)) return time

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameCalendarDay(d, yesterday)) return `Вчера, ${time}`

  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function peerFromProfiles(
  peerRow: ChatProfileSnippet | null | undefined,
  peerUserId: string
): ChatProfileSnippet {
  if (peerRow?.id) return peerRow
  return {
    id: peerUserId,
    first_name: null,
    last_name: null,
    full_name: null,
    role: "student",
    avatar_url: null
  }
}

type ParticipantWithProfile = {
  conversation_id: string
  user_id: string
  profiles: ChatProfileSnippet | ChatProfileSnippet[] | null
}

function normalizeEmbeddedProfile(
  raw: ChatProfileSnippet | ChatProfileSnippet[] | null | undefined
): ChatProfileSnippet | null {
  if (raw == null) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

export async function loadMyConversationIds(
  supabase: SupabaseClient,
  myUserId: string
): Promise<{ ids: string[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)

  if (error) return { ids: [], error: new Error(error.message) }
  const ids = [...new Set((data ?? []).map((r: { conversation_id: string }) => r.conversation_id))]
  return { ids, error: null }
}

export async function loadConversationSummaries(
  supabase: SupabaseClient,
  myUserId: string,
  conversationIds: string[]
): Promise<{ items: ConversationListItem[]; error: Error | null }> {
  if (conversationIds.length === 0) return { items: [], error: null }

  const { data: parts, error: pErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id, profiles ( id, first_name, last_name, full_name, role, avatar_url )")
    .in("conversation_id", conversationIds)

  if (pErr) return { items: [], error: new Error(pErr.message) }

  const { data: msgs, error: mErr } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })

  if (mErr) return { items: [], error: new Error(mErr.message) }

  const lastByConv = new Map<string, { body: string; created_at: string }>()
  for (const row of msgs ?? []) {
    const m = row as { conversation_id: string; body: string; created_at: string }
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at })
    }
  }

  const byConv = new Map<string, ParticipantWithProfile[]>()
  for (const raw of parts ?? []) {
    const row = raw as ParticipantWithProfile
    const list = byConv.get(row.conversation_id) ?? []
    list.push(row)
    byConv.set(row.conversation_id, list)
  }

  const items: ConversationListItem[] = []
  for (const convId of conversationIds) {
    const rows = byConv.get(convId) ?? []
    const peerRow = rows.find((r) => r.user_id !== myUserId)
    if (!peerRow) continue
    const peer = peerFromProfiles(normalizeEmbeddedProfile(peerRow.profiles), peerRow.user_id)
    const last = lastByConv.get(convId)
    items.push({
      id: convId,
      peer,
      lastMessage: last?.body?.trim() ? last.body.trim() : "Нет сообщений",
      lastMessageAt: last?.created_at ?? null
    })
  }

  items.sort((a, b) => {
    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
    return tb - ta
  })

  return { items, error: null }
}

export async function loadMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  myUserId: string
): Promise<{ messages: ChatBubble[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) return { messages: [], error: new Error(error.message) }

  const messages: ChatBubble[] = (data ?? []).map((row) => {
    const r = row as Pick<MessageRow, "id" | "sender_id" | "body" | "created_at">
    return {
      id: r.id,
      from: r.sender_id === myUserId ? "me" : "them",
      text: r.body,
      createdAt: r.created_at,
      timeLabel: formatChatTimeLabel(r.created_at)
    }
  })

  return { messages, error: null }
}

export async function sendChatMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ message: ChatBubble | null; error: Error | null }> {
  const trimmed = body.trim()
  if (!trimmed) return { message: null, error: new Error("Пустое сообщение") }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed
    })
    .select("id, sender_id, body, created_at")
    .single()

  if (error) return { message: null, error: new Error(error.message) }

  const row = data as Pick<MessageRow, "id" | "sender_id" | "body" | "created_at">
  return {
    message: {
      id: row.id,
      from: row.sender_id === senderId ? "me" : "them",
      text: row.body,
      createdAt: row.created_at,
      timeLabel: formatChatTimeLabel(row.created_at)
    },
    error: null
  }
}

function parseProfileRole(raw: string | null | undefined): "student" | "teacher" | null {
  const r = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (r === "student" || r === "teacher") return r
  return null
}

export type ConversationIdResult = { conversationId: string } | { error: string }

/**
 * Ищет беседу, где оба пользователя уже в `conversation_participants`.
 * Два запроса: список id у текущего пользователя, затем пересечение с peer.
 */
async function findConversationBetweenUsers(
  supabase: SupabaseClient,
  currentUserId: string,
  peerId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data: mine, error: e1 } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId)

  if (e1) return { conversationId: null, error: e1.message }

  const myConvIds = [...new Set((mine ?? []).map((r) => (r as ConversationParticipant).conversation_id))]
  if (myConvIds.length === 0) return { conversationId: null, error: null }

  const { data: overlap, error: e2 } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", peerId)
    .in("conversation_id", myConvIds)
    .limit(1)

  if (e2) return { conversationId: null, error: e2.message }

  const row = overlap?.[0] as ConversationParticipant | undefined
  return { conversationId: row?.conversation_id ?? null, error: null }
}

/** Создаёт новую беседу и двух участников (без поиска существующей). */
async function insertDirectConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  peerId: string
): Promise<ConversationIdResult> {
  const { data: conv, error: cErr } = await supabase
    .from("conversations")
    .insert({ created_by: currentUserId })
    .select("id")
    .single()

  if (cErr || !conv) return { error: cErr?.message ?? "Не удалось создать беседу." }

  const conversationId = (conv as Pick<Conversation, "id">).id

  const { error: p1 } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    user_id: currentUserId
  })
  if (p1) return { error: p1.message }

  const { error: p2 } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    user_id: peerId
  })
  if (p2) return { error: p2.message }

  return { conversationId }
}

/**
 * Возвращает существующий диалог между двумя пользователями или создаёт новый
 * (`created_by` = текущий пользователь, оба участника в `conversation_participants`).
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  peerId: string
): Promise<ConversationIdResult> {
  if (currentUserId === peerId) return { error: "Нельзя создать чат с самим собой." }

  const { conversationId: existing, error: findErr } = await findConversationBetweenUsers(
    supabase,
    currentUserId,
    peerId
  )
  if (findErr) return { error: findErr }
  if (existing) return { conversationId: existing }

  return insertDirectConversation(supabase, currentUserId, peerId)
}

/**
 * То же, что `getOrCreateConversation`, плюс проверка ролей (student + teacher) только если чата ещё нет.
 */
export async function createStudentTeacherConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  peerId: string
): Promise<ConversationIdResult> {
  if (currentUserId === peerId) return { error: "Нельзя создать чат с самим собой." }

  const { conversationId: existing, error: findErr } = await findConversationBetweenUsers(
    supabase,
    currentUserId,
    peerId
  )
  if (findErr) return { error: findErr }
  if (existing) return { conversationId: existing }

  const { data: rows, error: profErr } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", [currentUserId, peerId])

  if (profErr) return { error: profErr.message }

  const roleById = new Map<string, "student" | "teacher">()
  for (const r of rows ?? []) {
    const pr = r as { id: string; role: string }
    const role = parseProfileRole(pr.role)
    if (!role) return { error: `Неподдерживаемая роль в профиле (${pr.role}).` }
    roleById.set(pr.id, role)
  }

  const a = roleById.get(currentUserId)
  const b = roleById.get(peerId)
  if (!a || !b) return { error: "Не удалось загрузить роли обоих пользователей." }

  const pair = new Set([a, b])
  if (!pair.has("student") || !pair.has("teacher")) {
    return { error: "Чат доступен только между учеником и преподавателем." }
  }

  return insertDirectConversation(supabase, currentUserId, peerId)
}

export function conversationPeerTitle(peer: ChatProfileSnippet): string {
  return displayNameFromProfileFields(peer, null)
}

export function conversationPeerRoleLabel(peer: ChatProfileSnippet): string {
  return roleLabelRu(peer.role)
}
