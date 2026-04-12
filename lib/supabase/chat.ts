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
  content: string
  created_at: string
}

/** Собеседник в списке чатов (после отдельного запроса к profiles). */
export type ConversationListPeer = {
  id: string
  name: string
  avatarUrl: string | null
  role: string
}

export type ConversationListItem = {
  id: string
  peer: ConversationListPeer
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

type PeerProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  avatar_url: string | null
  role: string
}

function conversationPeerFromProfile(peerUserId: string, profile: PeerProfileRow | undefined): ConversationListPeer {
  if (!profile) {
    return { id: peerUserId, name: "User", avatarUrl: null, role: "" }
  }

  const fn = profile.first_name?.trim() ?? ""
  const ln = profile.last_name?.trim() ?? ""
  const name =
    fn && ln ? `${fn} ${ln}` : profile.full_name?.trim() || "User"

  const rawUrl = profile.avatar_url?.trim()
  return {
    id: peerUserId,
    name,
    avatarUrl: rawUrl ? rawUrl : null,
    role: profile.role ?? ""
  }
}

/** Беседа, где вы единственный видимый участник (нет второго user_id в выборке). */
function soloConversationPeerPlaceholder(conversationId: string): ConversationListPeer {
  return {
    id: conversationId,
    name: "Диалог",
    avatarUrl: null,
    role: ""
  }
}

/**
 * Список чатов: getUser → участия → conversations → участники (без join) → отдельно profiles по id → превью сообщений.
 */
export async function loadMyConversationList(
  supabase: SupabaseClient
): Promise<{ items: ConversationListItem[]; error: Error | null; authUserId: string | null }> {
  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser()

  if (authErr) {
    return { items: [], error: new Error(authErr.message), authUserId: null }
  }
  if (!user) {
    return { items: [], error: null, authUserId: null }
  }

  const myUserId = user.id

  const { data: partRows, error: p0 } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)

  if (p0) {
    return { items: [], error: new Error(p0.message), authUserId: myUserId }
  }

  const conversationIds = [...new Set((partRows ?? []).map((r) => (r as { conversation_id: string }).conversation_id))]
  if (conversationIds.length === 0) {
    return { items: [], error: null, authUserId: myUserId }
  }

  const { data: conversations, error: cErr } = await supabase
    .from("conversations")
    .select("*")
    .in("id", conversationIds)

  if (cErr) {
    return { items: [], error: new Error(cErr.message), authUserId: myUserId }
  }

  const convById = new Map((conversations ?? []).map((c) => [(c as Conversation).id, c as Conversation]))

  const allowedIds = conversationIds.filter((id) => convById.has(id))
  if (allowedIds.length === 0) {
    return { items: [], error: null, authUserId: myUserId }
  }

  const { data: parts, error: pErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", allowedIds)

  if (pErr) {
    return { items: [], error: new Error(pErr.message), authUserId: myUserId }
  }

  const { data: msgs, error: mErr } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", allowedIds)
    .order("created_at", { ascending: false })

  if (mErr) {
    return { items: [], error: new Error(mErr.message), authUserId: myUserId }
  }

  const lastByConv = new Map<string, { content: string; created_at: string }>()
  for (const row of msgs ?? []) {
    const m = row as { conversation_id: string; content: string; created_at: string }
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, { content: m.content, created_at: m.created_at })
    }
  }

  const byConv = new Map<string, { conversation_id: string; user_id: string }[]>()
  for (const raw of parts ?? []) {
    const row = raw as { conversation_id: string; user_id: string }
    const list = byConv.get(row.conversation_id) ?? []
    list.push(row)
    byConv.set(row.conversation_id, list)
  }

  /** peerUserId === null: в беседе нет второго участника в выборке (часто только вы в participants). */
  const convPeerEntries: { conversationId: string; peerUserId: string | null }[] = []
  for (const convId of allowedIds) {
    const rows = byConv.get(convId) ?? []
    const peerRow = rows.find((r) => r.user_id !== myUserId)
    if (peerRow) {
      convPeerEntries.push({ conversationId: convId, peerUserId: peerRow.user_id })
    } else {
      convPeerEntries.push({ conversationId: convId, peerUserId: null })
    }
  }

  const peerIds = [
    ...new Set(
      convPeerEntries
        .map((e) => e.peerUserId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  ]

  const profileMap = new Map<string, PeerProfileRow>()
  if (peerIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, avatar_url, role")
      .in("id", peerIds)

    if (profErr) {
      return { items: [], error: new Error(profErr.message), authUserId: myUserId }
    }

    const safeProfiles = profiles ?? []
    for (const p of safeProfiles) {
      const row = p as PeerProfileRow
      profileMap.set(row.id, row)
    }
  }

  const items: ConversationListItem[] = []
  for (const { conversationId, peerUserId } of convPeerEntries) {
    const last = lastByConv.get(conversationId)
    const peer =
      peerUserId === null
        ? soloConversationPeerPlaceholder(conversationId)
        : conversationPeerFromProfile(peerUserId, profileMap.get(peerUserId))

    items.push({
      id: conversationId,
      peer,
      lastMessage: last?.content?.trim() ? last.content.trim() : "Нет сообщений",
      lastMessageAt: last?.created_at ?? null
    })
  }

  items.sort((a, b) => {
    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
    return tb - ta
  })

  return { items, error: null, authUserId: myUserId }
}

type ProfileStudentPickerRow = Pick<PeerProfileRow, "id" | "first_name" | "last_name" | "full_name"> & {
  assigned_teacher_id?: string | null
}

/** Список учеников для чата: без чужого закрепления + закреплённые за этим преподавателем + без закрепления. */
export async function loadStudentProfilesForTeacherPicker(
  supabase: SupabaseClient,
  teacherProfileId: string
): Promise<{ students: { id: string; label: string }[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, assigned_teacher_id")
    .eq("role", "student")

  if (error) {
    return { students: [], error: new Error(error.message) }
  }

  const rows = (data ?? []) as ProfileStudentPickerRow[]
  const allowed = rows.filter((row) => {
    const at = row.assigned_teacher_id ?? null
    return at === null || at === teacherProfileId
  })

  const students = allowed.map((row) => ({
    id: row.id,
    label: displayNameFromProfileFields(row, null)
  }))

  students.sort((a, b) => {
    const aRow = allowed.find((r) => r.id === a.id)
    const bRow = allowed.find((r) => r.id === b.id)
    const aMine = aRow?.assigned_teacher_id === teacherProfileId ? 0 : 1
    const bMine = bRow?.assigned_teacher_id === teacherProfileId ? 0 : 1
    if (aMine !== bMine) return aMine - bMine
    return a.label.localeCompare(b.label, "ru")
  })

  return { students, error: null }
}

export async function loadMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  myUserId: string
): Promise<{ messages: ChatBubble[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) return { messages: [], error: new Error(error.message) }

  const messages: ChatBubble[] = (data ?? []).map((row) => {
    const r = row as Pick<MessageRow, "id" | "sender_id" | "content" | "created_at">
    return {
      id: r.id,
      from: r.sender_id === myUserId ? "me" : "them",
      text: r.content,
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
  messageText: string
): Promise<{ message: ChatBubble | null; error: Error | null }> {
  const messageTextTrimmed = messageText.trim()
  if (!messageTextTrimmed) return { message: null, error: new Error("Пустое сообщение") }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: messageTextTrimmed
    })
    .select("id, sender_id, content, created_at")
    .single()

  if (error) return { message: null, error: new Error(error.message) }

  const row = data as Pick<MessageRow, "id" | "sender_id" | "content" | "created_at">
  return {
    message: {
      id: row.id,
      from: row.sender_id === senderId ? "me" : "them",
      text: row.content,
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

/** Подпись роли в UI списка/шапки чата по строке `profiles.role`. */
export function formatListPeerRole(role: string): string {
  const r = role.trim()
  if (!r) return ""
  return roleLabelRu(r)
}
