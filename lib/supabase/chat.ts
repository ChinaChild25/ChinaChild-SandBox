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
  /** `conversations.created_at` — для порядка чатов без сообщений */
  conversationCreatedAt: string
}

/** Как в мессенджере: сначала по времени последнего сообщения, пустые внизу. */
export function sortConversationListItems(items: ConversationListItem[]): ConversationListItem[] {
  return [...items].sort((a, b) => {
    const hasA = a.lastMessageAt != null && a.lastMessageAt !== ""
    const hasB = b.lastMessageAt != null && b.lastMessageAt !== ""
    if (hasA && !hasB) return -1
    if (!hasA && hasB) return 1
    if (hasA && hasB) return Date.parse(b.lastMessageAt!) - Date.parse(a.lastMessageAt!)
    const ca = Date.parse(a.conversationCreatedAt) || 0
    const cb = Date.parse(b.conversationCreatedAt) || 0
    return cb - ca
  })
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

/**
 * Список чатов: getUser → участия → conversations → участники (без join) → отдельно profiles по id → превью сообщений.
 * Показываются только беседы ровно с двумя участниками (вы + ровно один собеседник).
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

  const convPeerEntries: { conversationId: string; peerUserId: string }[] = []
  for (const convId of allowedIds) {
    const rows = byConv.get(convId) ?? []
    const others = rows.filter((r) => r.user_id !== myUserId)
    if (rows.length !== 2 || others.length !== 1) {
      console.warn("[chat] skipping conversation with no peer", convId)
      continue
    }
    convPeerEntries.push({ conversationId: convId, peerUserId: others[0].user_id })
  }

  const peerIds = [...new Set(convPeerEntries.map((e) => e.peerUserId))]

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
    const peer = conversationPeerFromProfile(peerUserId, profileMap.get(peerUserId))

    const conv = convById.get(conversationId)
    items.push({
      id: conversationId,
      peer,
      lastMessage: last?.content?.trim() ? last.content.trim() : "Нет сообщений",
      lastMessageAt: last?.created_at ?? null,
      conversationCreatedAt: conv?.created_at ?? ""
    })
  }

  /** Одна строка на собеседника: в БД могли остаться два uuid после старых гонок. */
  const byPeer = new Map<string, ConversationListItem>()
  for (const row of items) {
    const pid = row.peer.id
    const prev = byPeer.get(pid)
    if (!prev) {
      byPeer.set(pid, row)
      continue
    }
    const prevMsg = prev.lastMessageAt ? Date.parse(prev.lastMessageAt) : 0
    const curMsg = row.lastMessageAt ? Date.parse(row.lastMessageAt) : 0
    if (curMsg > prevMsg) {
      byPeer.set(pid, row)
      continue
    }
    if (curMsg === prevMsg) {
      const prevCreated = Date.parse(prev.conversationCreatedAt) || 0
      const curCreated = Date.parse(row.conversationCreatedAt) || 0
      if (curCreated >= prevCreated) byPeer.set(pid, row)
    }
  }
  const deduped = [...byPeer.values()]

  return { items: sortConversationListItems(deduped), error: null, authUserId: myUserId }
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

/** Все ученики, видимые по RLS (если отфильтрованный список пуст). */
export async function loadAllStudentProfilesForPicker(
  supabase: SupabaseClient
): Promise<{ students: { id: string; label: string }[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name")
    .eq("role", "student")

  if (error) {
    return { students: [], error: new Error(error.message) }
  }

  const rows = (data ?? []) as ProfileStudentPickerRow[]
  const students = rows.map((row) => ({
    id: row.id,
    label: displayNameFromProfileFields(row, null)
  }))
  students.sort((a, b) => a.label.localeCompare(b.label, "ru"))

  return { students, error: null }
}

/**
 * Профиль собеседника по id беседы (второй участник, не `myUserId`).
 * Для шапки/строки списка до прихода полного `loadMyConversationList`.
 */
export async function loadConversationPeerProfile(
  supabase: SupabaseClient,
  conversationId: string,
  myUserId: string
): Promise<{ peer: ConversationListPeer | null; error: Error | null }> {
  const { data: parts, error: pErr } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)

  if (pErr) return { peer: null, error: new Error(pErr.message) }

  const peerUserId = (parts ?? [])
    .map((r) => (r as { user_id: string }).user_id)
    .find((id) => id !== myUserId)

  if (!peerUserId) return { peer: null, error: null }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url, role")
    .eq("id", peerUserId)
    .maybeSingle()

  if (profErr) return { peer: null, error: new Error(profErr.message) }

  const peer = conversationPeerFromProfile(peerUserId, profile as PeerProfileRow | undefined)
  return { peer, error: null }
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

export type ConversationIdResult = { conversationId: string } | { error: string }

/**
 * Атомарно: один диалог на пару (см. `get_or_create_direct_conversation` в миграции).
 * Раньше два последовательных запроса + insert давали второй uuid при гонке.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  peerId: string
): Promise<ConversationIdResult> {
  if (currentUserId === peerId) return { error: "Нельзя создать чат с самим собой." }

  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
    p_peer_id: peerId
  })

  if (error) return { error: error.message }
  if (data == null || typeof data !== "string") {
    return { error: "Не удалось получить id беседы." }
  }

  return { conversationId: data }
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
