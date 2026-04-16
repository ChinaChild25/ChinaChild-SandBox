import type { SupabaseClient } from "@supabase/supabase-js"
import { FIGMA_TEACHERS } from "@/lib/figma-dashboard"
import { getTeacherStudentByChatProfileId } from "@/lib/teacher-students-mock"
import { displayNameFromProfileFields, type ProfileRow } from "@/lib/supabase/profile"
import { getChatCapabilities } from "@/lib/supabase/chat-capabilities"

const FALLBACK_TEACHER_AVATAR =
  FIGMA_TEACHERS.find((t) => t.slug === "zhao-li")?.photo ?? "/staff/zhao-li.png"

export type ChatProfileSnippet = Pick<
  ProfileRow,
  "id" | "first_name" | "last_name" | "full_name" | "role" | "avatar_url"
>

/** Строка `public.conversations`. */
export type Conversation = {
  id: string
  type: "direct" | "group"
  title: string | null
  created_by: string
  created_at: string
}

/** Строка `public.conversation_participants`. */
export type ConversationParticipant = {
  conversation_id: string
  user_id: string
  created_at?: string
  added_by?: string | null
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_forwarded: boolean
  forwarded_from_message_id: string | null
  media_url: string | null
  media_type: string | null
  media_size: number | null
  media_duration_sec: number | null
  reply_to_id: string | null
  created_at: string
}

/** Собеседник в списке чатов (после отдельного запроса к profiles). */
export type ConversationListPeer = {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  uiAccent: "sage" | "pink" | "blue" | "orange" | null
}

export type ConversationListItem = {
  id: string
  type: "direct" | "group"
  title: string
  peer: ConversationListPeer
  lastMessage: string
  lastMessageAt: string | null
  unreadCount: number
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

function conversationActivityTs(item: ConversationListItem): number {
  if (item.lastMessageAt) {
    const ts = Date.parse(item.lastMessageAt)
    if (!Number.isNaN(ts)) return ts
  }
  const createdTs = Date.parse(item.conversationCreatedAt)
  return Number.isNaN(createdTs) ? 0 : createdTs
}

export type ChatBubble = {
  id: string
  from: "me" | "them"
  text: string
  isForwarded: boolean
  mediaUrl: string | null
  mediaType: string | null
  mediaSize: number | null
  mediaDurationSec: number | null
  replyToId: string | null
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  timeLabel: string
}

function roleLabelRu(role: string): string {
  const r = role.trim().toLowerCase()
  if (r === "teacher") return "Преподаватель"
  if (r === "student") return "Ученик"
  if (r === "curator") return "Куратор"
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
  full_name?: string | null
  timezone?: string | null
  avatar_url: string | null
  ui_accent?: "sage" | "pink" | "blue" | "orange" | null
  role: string
}

function conversationPeerFromProfile(peerUserId: string, profile: PeerProfileRow | undefined): ConversationListPeer {
  if (!profile) {
    return { id: peerUserId, name: "User", avatarUrl: null, role: "", uiAccent: null }
  }

  const fn = profile.first_name?.trim() ?? ""
  const ln = profile.last_name?.trim() ?? ""
  const name =
    fn && ln ? `${fn} ${ln}` : [fn, ln].filter(Boolean).join(" ").trim() || "User"

  const rawUrl = profile.avatar_url?.trim()
  return {
    id: peerUserId,
    name,
    avatarUrl: rawUrl ? rawUrl : null,
    role: profile.role ?? "",
    uiAccent: profile.ui_accent ?? null
  }
}

const MESSAGE_SELECT_WITH_DURATION =
  "id, sender_id, content, is_forwarded, forwarded_from_message_id, media_url, media_type, media_size, media_duration_sec, reply_to_id, edited_at, deleted_at, created_at"
const MESSAGE_SELECT_NO_DURATION =
  "id, sender_id, content, is_forwarded, forwarded_from_message_id, media_url, media_type, media_size, reply_to_id, edited_at, deleted_at, created_at"

/** Текст сообщения: в миграции изначально была колонка `body`, клиент использует `content`. */
export function messageTextFromDbRow(row: { content?: unknown; body?: unknown }): string {
  const c = typeof row.content === "string" ? row.content.trim() : ""
  if (c) return c
  const b = typeof row.body === "string" ? row.body.trim() : ""
  return b
}

const FORWARDED_MARKER = "[[forwarded]]"

function decodeForwardedMessageText(rawText: string): { text: string; isForwarded: boolean } {
  if (!rawText.startsWith(FORWARDED_MARKER)) {
    return { text: rawText, isForwarded: false }
  }
  const text = rawText.slice(FORWARDED_MARKER.length).trimStart()
  return { text, isForwarded: true }
}

export function encodeForwardedMessageText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith(FORWARDED_MARKER)) return trimmed
  return trimmed ? `${FORWARDED_MARKER}\n${trimmed}` : FORWARDED_MARKER
}

function isDeletedMarkerText(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t === "[deleted]" || t === "deleted" || t === "сообщение удалено"
}

/** Аватар в UI: URL из БД или запасное фото преподавателя из макета (если в profiles нет avatar_url). */
export function peerAvatarUrlForUi(peer: ConversationListPeer): string | null {
  const u = peer.avatarUrl?.trim()
  if (u) return u
  if (peer.role.trim().toLowerCase() === "teacher") return FALLBACK_TEACHER_AVATAR
  return null
}

export function chatBubbleFromMessageRow(
  row: {
    id: string
    sender_id: string
    created_at: string
    content?: unknown
    body?: unknown
    is_forwarded?: unknown
    forwarded_from_message_id?: unknown
    media_url?: unknown
    media_type?: unknown
    media_size?: unknown
    media_duration_sec?: unknown
    reply_to_id?: unknown
    edited_at?: unknown
    deleted_at?: unknown
  },
  myUserId: string
): ChatBubble {
  const mediaUrl = typeof row.media_url === "string" && row.media_url.trim() ? row.media_url : null
  const mediaType = typeof row.media_type === "string" && row.media_type.trim() ? row.media_type : null
  const mediaSize = typeof row.media_size === "number" ? row.media_size : null
  const mediaDurationSec = typeof row.media_duration_sec === "number" ? row.media_duration_sec : null
  const replyToId = typeof row.reply_to_id === "string" && row.reply_to_id.trim() ? row.reply_to_id : null
  const editedAt = typeof row.edited_at === "string" && row.edited_at.trim() ? row.edited_at : null
  const rawDeletedAt = typeof row.deleted_at === "string" && row.deleted_at.trim() ? row.deleted_at : null
  const rawText = messageTextFromDbRow(row)
  const decoded = decodeForwardedMessageText(rawText)
  const isForwardedByColumn = typeof row.is_forwarded === "boolean" ? row.is_forwarded : null
  const isForwarded = isForwardedByColumn ?? decoded.isForwarded
  const text = decoded.text
  const legacyDeletedMarker = text.trim().toLowerCase()
  const isLegacyDeleted =
    legacyDeletedMarker === "[deleted]" ||
    legacyDeletedMarker === "deleted" ||
    legacyDeletedMarker === "сообщение удалено"
  const deletedAt = rawDeletedAt ?? (isLegacyDeleted ? row.created_at : null)
  return {
    id: row.id,
    from: row.sender_id === myUserId ? "me" : "them",
    text,
    isForwarded,
    mediaUrl,
    mediaType,
    mediaSize,
    mediaDurationSec,
    replyToId,
    editedAt,
    deletedAt,
    createdAt: row.created_at,
    timeLabel: formatChatTimeLabel(row.created_at)
  }
}

function isMissingDbFieldError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("does not exist") || m.includes("could not find the table")
}

async function loadPeerProfilesWithFallback(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ rows: PeerProfileRow[]; error: Error | null }> {
  if (ids.length === 0) return { rows: [], error: null }
  const caps = await getChatCapabilities(supabase)
  if (caps.has_chat_peer_profiles) {
    const fromView = await supabase
      .from("chat_peer_profiles")
      .select("id, first_name, last_name, timezone, avatar_url, role, ui_accent")
      .in("id", ids)
    if (!fromView.error) {
      return { rows: (fromView.data ?? []) as PeerProfileRow[], error: null }
    }
    if (isMissingDbFieldError(fromView.error.message)) {
      const fromViewLegacy = await supabase
        .from("chat_peer_profiles")
        .select("id, first_name, last_name, timezone, avatar_url, role")
        .in("id", ids)
      if (!fromViewLegacy.error) {
        const rows = (fromViewLegacy.data ?? []) as PeerProfileRow[]
        return { rows: rows.map((r) => ({ ...r, ui_accent: null })), error: null }
      }
    }
  }

  const fallback = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, avatar_url, role, ui_accent")
    .in("id", ids)
  if (fallback.error && isMissingDbFieldError(fallback.error.message)) {
    const fallbackLegacy = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, avatar_url, role")
      .in("id", ids)
    if (fallbackLegacy.error) {
      return { rows: [], error: new Error(fallbackLegacy.error.message) }
    }
    const rows = (fallbackLegacy.data ?? []) as PeerProfileRow[]
    return { rows: rows.map((r) => ({ ...r, ui_accent: null })), error: null }
  }
  if (fallback.error) {
    return { rows: [], error: new Error(fallback.error.message) }
  }
  return { rows: (fallback.data ?? []) as PeerProfileRow[], error: null }
}

/**
 * Список чатов: direct и group без предположения «ровно два участника».
 * direct: показываем peer (первый участник не я).
 * group: показываем conversations.title (fallback: «Групповой чат»).
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

  const [partsRes, msgsRes] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", allowedIds),
    supabase
      .from("messages")
      .select("conversation_id, content, deleted_at, created_at, media_url, media_type")
      .in("conversation_id", allowedIds)
      .order("created_at", { ascending: false })
  ])
  const parts = partsRes.data
  const pErr = partsRes.error
  const msgs = msgsRes.data
  const mErr = msgsRes.error
  if (pErr) {
    return { items: [], error: new Error(pErr.message), authUserId: myUserId }
  }
  if (mErr) {
    return { items: [], error: new Error(mErr.message), authUserId: myUserId }
  }

  const lastByConv = new Map<string, { content: string; created_at: string }>()
  for (const row of msgs ?? []) {
    const m = row as {
      conversation_id: string
      content?: unknown
      body?: unknown
      created_at: string
      deleted_at?: string | null
      media_url?: string | null
      media_type?: string | null
    }
    if (!lastByConv.has(m.conversation_id)) {
      const rawText = messageTextFromDbRow(m)
      const { text } = decodeForwardedMessageText(rawText)
      const preview =
        (typeof m.deleted_at === "string" && m.deleted_at.trim()) || isDeletedMarkerText(text)
          ? "Сообщение удалено"
          : typeof m.media_type === "string" && m.media_type.startsWith("audio/")
            ? "Голосовое сообщение"
            : typeof m.media_url === "string" && m.media_url.trim()
              ? "Медиа"
          : text
      lastByConv.set(m.conversation_id, {
        content: preview,
        created_at: m.created_at
      })
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
  const groupConvIds: string[] = []
  for (const convId of allowedIds) {
    const conv = convById.get(convId)
    if (conv?.type === "group") {
      groupConvIds.push(convId)
      continue
    }
    const rows = byConv.get(convId) ?? []
    const others = rows.filter((r) => r.user_id !== myUserId)
    if (others.length < 1) {
      continue
    }
    convPeerEntries.push({ conversationId: convId, peerUserId: others[0].user_id })
  }

  const peerIds = [...new Set(convPeerEntries.map((e) => e.peerUserId))]

  const profileMap = new Map<string, PeerProfileRow>()
  if (peerIds.length > 0) {
    const { rows: safeProfiles, error: profErr } = await loadPeerProfilesWithFallback(supabase, peerIds)
    if (profErr) return { items: [], error: profErr, authUserId: myUserId }
    for (const p of safeProfiles) {
      const row = p as PeerProfileRow
      profileMap.set(row.id, row)
    }
  }

  const unreadByConversation = new Map<string, number>()
  const caps = await getChatCapabilities(supabase)
  if (caps.has_message_reads) {
    const unreadMessages = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id")
      .in("conversation_id", allowedIds)
      .neq("sender_id", myUserId)
      .is("deleted_at", null)
    if (!unreadMessages.error) {
      const unreadRows = (unreadMessages.data ?? []) as Array<{ id: string; conversation_id: string }>
      const ids = unreadRows.map((r) => r.id)
      let reads = new Set<string>()
      if (ids.length > 0) {
        const rr = await supabase.from("message_reads").select("message_id").in("message_id", ids).eq("user_id", myUserId)
        if (!rr.error) {
          reads = new Set((rr.data ?? []).map((r) => (r as { message_id: string }).message_id))
        }
      }
      for (const row of unreadRows) {
        if (reads.has(row.id)) continue
        unreadByConversation.set(row.conversation_id, (unreadByConversation.get(row.conversation_id) ?? 0) + 1)
      }
    }
  }

  const items: ConversationListItem[] = []
  for (const { conversationId, peerUserId } of convPeerEntries) {
    const last = lastByConv.get(conversationId)
    const peer = conversationPeerFromProfile(peerUserId, profileMap.get(peerUserId))

    const conv = convById.get(conversationId)
    items.push({
      id: conversationId,
      type: "direct",
      title: peer.name,
      peer,
      lastMessage: last?.content?.trim() ? last.content.trim() : "Нет сообщений",
      lastMessageAt: last?.created_at ?? null,
      unreadCount: unreadByConversation.get(conversationId) ?? 0,
      conversationCreatedAt: conv?.created_at ?? ""
    })
  }

  for (const convId of groupConvIds) {
    const conv = convById.get(convId)
    if (!conv) continue
    const last = lastByConv.get(convId)
    const title = conv.title?.trim() ? conv.title.trim() : "Групповой чат"
    items.push({
      id: convId,
      type: "group",
      title,
      peer: {
        id: `group-${convId}`,
        name: title,
        avatarUrl: null,
        role: "group",
        uiAccent: null
      },
      lastMessage: last?.content?.trim() ? last.content.trim() : "Нет сообщений",
      lastMessageAt: last?.created_at ?? null,
      unreadCount: unreadByConversation.get(convId) ?? 0,
      conversationCreatedAt: conv.created_at ?? ""
    })
  }

  // Safety net: if legacy data produced multiple direct chats with one peer, keep only the most active one.
  const dedupedDirectByPeer = new Map<string, ConversationListItem>()
  const passthrough: ConversationListItem[] = []
  for (const item of items) {
    if (item.type !== "direct") {
      passthrough.push(item)
      continue
    }
    const key = item.peer.id
    const prev = dedupedDirectByPeer.get(key)
    if (!prev || conversationActivityTs(item) > conversationActivityTs(prev)) {
      dedupedDirectByPeer.set(key, item)
    }
  }

  const finalItems = sortConversationListItems([...passthrough, ...dedupedDirectByPeer.values()])
  return {
    items: finalItems,
    error: null,
    authUserId: myUserId
  }
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
    label: displayNameFromProfileFields(
      { first_name: row.first_name, last_name: row.last_name, full_name: row.full_name ?? null },
      null
    )
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
    label: displayNameFromProfileFields(
      { first_name: row.first_name, last_name: row.last_name, full_name: row.full_name ?? null },
      null
    )
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

  const { rows, error } = await loadPeerProfilesWithFallback(supabase, [peerUserId])
  if (error) return { peer: null, error }
  const peer = conversationPeerFromProfile(peerUserId, rows[0])
  return { peer, error: null }
}

export async function loadMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  myUserId: string,
  options?: { limit?: number; beforeCreatedAt?: string | null }
): Promise<{ messages: ChatBubble[]; hasMore: boolean; error: Error | null }> {
  const caps = await getChatCapabilities(supabase)
  const limit = Math.max(1, Math.min(100, options?.limit ?? 40))
  const fetchLimit = limit + 1
  let data: unknown[] | null = null
  let error: { message: string } | null = null

  if (caps.has_messages_media || caps.has_messages_edit_delete) {
    let modernQuery = supabase
      .from("messages")
      .select(MESSAGE_SELECT_WITH_DURATION)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit)
    if (options?.beforeCreatedAt) {
      modernQuery = modernQuery.lt("created_at", options.beforeCreatedAt)
    }
    const modern = await modernQuery
    data = modern.data as unknown[] | null
    error = modern.error ? { message: modern.error.message } : null
    if (error && isMissingDbFieldError(error.message)) {
      let modernLegacyQuery = supabase
        .from("messages")
        .select(MESSAGE_SELECT_NO_DURATION)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(fetchLimit)
      if (options?.beforeCreatedAt) {
        modernLegacyQuery = modernLegacyQuery.lt("created_at", options.beforeCreatedAt)
      }
      const modernLegacy = await modernLegacyQuery
      data = modernLegacy.data as unknown[] | null
      error = modernLegacy.error ? { message: modernLegacy.error.message } : null
    }
  } else {
    error = { message: "legacy-mode" }
  }

  if (error && (error.message === "legacy-mode" || isMissingDbFieldError(error.message))) {
    let legacyQuery = supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit)
    if (options?.beforeCreatedAt) {
      legacyQuery = legacyQuery.lt("created_at", options.beforeCreatedAt)
    }
    const legacy = await legacyQuery
    data = legacy.data as unknown[] | null
    error = legacy.error ? { message: legacy.error.message } : null
  }

  if (error) return { messages: [], hasMore: false, error: new Error(error.message) }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const messages: ChatBubble[] = pageRows
    .map((row) =>
    chatBubbleFromMessageRow(
      row as {
        id: string
        sender_id: string
        created_at: string
        content?: unknown
        body?: unknown
        is_forwarded?: unknown
        forwarded_from_message_id?: unknown
        media_url?: unknown
        media_type?: unknown
        media_size?: unknown
        reply_to_id?: unknown
        edited_at?: unknown
        deleted_at?: unknown
      },
      myUserId
    )
  )
    .reverse()

  return { messages, hasMore, error: null }
}

export async function sendChatMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  messageText: string,
  options?: {
    mediaUrl?: string | null
    mediaType?: string | null
    mediaSize?: number | null
    mediaDurationSec?: number | null
    replyToId?: string | null
    forwarded?: boolean
  }
): Promise<{ message: ChatBubble | null; error: Error | null }> {
  const caps = await getChatCapabilities(supabase)
  const messageTextTrimmed = messageText.trim()
  if (!messageTextTrimmed && !options?.mediaUrl) return { message: null, error: new Error("Пустое сообщение") }
  const storedContent = options?.forwarded
    ? encodeForwardedMessageText(messageTextTrimmed)
    : messageTextTrimmed

  let data: unknown = null
  let error: { message: string } | null = null

  if (caps.has_messages_media || caps.has_messages_edit_delete) {
    const modernInsert = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: storedContent,
        is_forwarded: options?.forwarded === true,
        media_url: options?.mediaUrl ?? null,
        media_type: options?.mediaType ?? null,
        media_size: options?.mediaSize ?? null,
        media_duration_sec: options?.mediaDurationSec ?? null,
        reply_to_id: options?.replyToId ?? null
      })
      .select(MESSAGE_SELECT_WITH_DURATION)
      .single()
    data = modernInsert.data as unknown
    error = modernInsert.error ? { message: modernInsert.error.message } : null
    if (error && isMissingDbFieldError(error.message)) {
      const modernLegacyInsert = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: storedContent,
          is_forwarded: options?.forwarded === true,
          media_url: options?.mediaUrl ?? null,
          media_type: options?.mediaType ?? null,
          media_size: options?.mediaSize ?? null,
          reply_to_id: options?.replyToId ?? null
        })
        .select(MESSAGE_SELECT_NO_DURATION)
        .single()
      data = modernLegacyInsert.data as unknown
      error = modernLegacyInsert.error ? { message: modernLegacyInsert.error.message } : null
    }
  } else {
    error = { message: "legacy-mode" }
  }

  if (error && (error.message === "legacy-mode" || isMissingDbFieldError(error.message))) {
    if (options?.mediaUrl) {
      return { message: null, error: new Error("Медиа пока недоступно: миграции чата не применены.") }
    }
    const legacyInsert = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: storedContent
      })
      .select("id, sender_id, content, created_at")
      .single()
    data = legacyInsert.data as unknown
    error = legacyInsert.error ? { message: legacyInsert.error.message } : null
  }

  if (error) {
    if (error.message.includes("messages_content_or_media_required")) {
      return { message: null, error: new Error("Нельзя отправить пустое сообщение.") }
    }
    return { message: null, error: new Error(error.message) }
  }

  const row = data as {
    id: string
    sender_id: string
    created_at: string
    content?: unknown
    body?: unknown
    media_url?: unknown
    media_type?: unknown
    media_size?: unknown
    media_duration_sec?: unknown
    reply_to_id?: unknown
    edited_at?: unknown
    deleted_at?: unknown
  }
  return {
    message: chatBubbleFromMessageRow(row, senderId),
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

export async function createDirectConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  peerId: string
): Promise<ConversationIdResult> {
  return getOrCreateConversation(supabase, currentUserId, peerId)
}

export async function createGroupConversation(
  supabase: SupabaseClient,
  params: { title: string; teacherId: string; studentIds: string[]; curatorIds?: string[] }
): Promise<ConversationIdResult> {
  if (!params.teacherId.trim()) return { error: "Не указан преподаватель." }
  if (!params.title.trim()) return { error: "Укажите название группы." }
  const { data, error } = await supabase.rpc("create_group_conversation", {
    p_title: params.title.trim(),
    p_student_ids: params.studentIds,
    p_curator_ids: params.curatorIds ?? []
  })
  if (error) return { error: error.message }
  if (!data || typeof data !== "string") return { error: "Не удалось создать групповой чат." }
  return { conversationId: data }
}

export async function addParticipantsToConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userIds: string[]
): Promise<{ added: number; error: Error | null }> {
  const ids = [...new Set(userIds.map((x) => x.trim()).filter(Boolean))]
  if (ids.length === 0) return { added: 0, error: null }
  const { data, error } = await supabase.rpc("add_participants_to_group_conversation", {
    p_conversation_id: conversationId,
    p_user_ids: ids
  })
  if (error) return { added: 0, error: new Error(error.message) }
  return { added: typeof data === "number" ? data : 0, error: null }
}

export async function removeParticipantFromConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<{ removed: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc("remove_participant_from_group_conversation", {
    p_conversation_id: conversationId,
    p_user_id: userId
  })
  if (error) return { removed: false, error: new Error(error.message) }
  return { removed: data === true, error: null }
}

export async function editChatMessage(
  supabase: SupabaseClient,
  messageId: string,
  content: string
): Promise<{ ok: boolean; error: Error | null }> {
  const caps = await getChatCapabilities(supabase)
  if (!caps.has_messages_edit_delete) {
    return { ok: false, error: new Error("Редактирование станет доступно после применения миграций чата.") }
  }
  const { data, error } = await supabase.rpc("edit_message", { p_message_id: messageId, p_content: content })
  if (error) return { ok: false, error: new Error(error.message) }
  return { ok: data === true, error: null }
}

export async function deleteChatMessage(
  supabase: SupabaseClient,
  messageId: string
): Promise<{ ok: boolean; error: Error | null }> {
  const caps = await getChatCapabilities(supabase)
  if (!caps.has_messages_edit_delete) {
    return { ok: false, error: new Error("Удаление станет доступно после применения миграций чата.") }
  }
  const { data, error } = await supabase.rpc("soft_delete_message", { p_message_id: messageId })
  if (error) return { ok: false, error: new Error(error.message) }
  return { ok: data === true, error: null }
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<{ added: number; error: Error | null }> {
  const caps = await getChatCapabilities(supabase)
  if (!caps.has_message_reads) {
    return { added: 0, error: null }
  }
  const { data, error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId })
  if (error) return { added: 0, error: new Error(error.message) }
  return { added: typeof data === "number" ? data : 0, error: null }
}

export async function loadReadReceiptMessageIds(
  supabase: SupabaseClient,
  conversationId: string,
  myUserId: string
): Promise<{ ids: string[]; error: Error | null }> {
  const caps = await getChatCapabilities(supabase)
  if (!caps.has_message_reads) return { ids: [], error: null }

  const ownMessages = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("sender_id", myUserId)

  if (ownMessages.error) return { ids: [], error: new Error(ownMessages.error.message) }
  const ownIds = (ownMessages.data ?? []).map((r) => (r as { id: string }).id)
  if (ownIds.length === 0) return { ids: [], error: null }

  const reads = await supabase
    .from("message_reads")
    .select("message_id, user_id")
    .in("message_id", ownIds)
    .neq("user_id", myUserId)

  if (reads.error) return { ids: [], error: new Error(reads.error.message) }
  const ids = [...new Set((reads.data ?? []).map((r) => (r as { message_id: string }).message_id))]
  return { ids, error: null }
}

export async function renameConversation(
  supabase: SupabaseClient,
  conversationId: string,
  title: string
): Promise<{ ok: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc("rename_group_conversation", {
    p_conversation_id: conversationId,
    p_title: title
  })
  if (error) return { ok: false, error: new Error(error.message) }
  return { ok: data === true, error: null }
}

export async function moveStudentToAnotherConversation(
  supabase: SupabaseClient,
  params: { studentId: string; fromConversationId: string; toConversationId: string }
): Promise<{ ok: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc("move_student_to_another_group_conversation", {
    p_student_id: params.studentId,
    p_from_conversation_id: params.fromConversationId,
    p_to_conversation_id: params.toConversationId
  })
  if (error) return { ok: false, error: new Error(error.message) }
  return { ok: data === true, error: null }
}

export type ConversationParticipantProfile = {
  id: string
  role: string
  name: string
  avatarUrl: string | null
}

export async function loadConversationParticipants(
  supabase: SupabaseClient,
  conversationId: string
): Promise<{ participants: ConversationParticipantProfile[]; error: Error | null }> {
  const { data: rows, error } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
  if (error) return { participants: [], error: new Error(error.message) }
  const ids = [...new Set((rows ?? []).map((r) => (r as { user_id: string }).user_id))]
  if (ids.length === 0) return { participants: [], error: null }
  const { rows: profiles, error: pErr } = await loadPeerProfilesWithFallback(supabase, ids)
  if (pErr) return { participants: [], error: pErr }
  const participants = (profiles ?? []).map((p) => {
    const row = p as PeerProfileRow
    return {
      id: row.id,
      role: row.role,
      name: displayNameFromProfileFields(
        { first_name: row.first_name, last_name: row.last_name, full_name: row.full_name ?? null },
        null
      ),
      avatarUrl: row.avatar_url?.trim() || null
    }
  })
  return { participants, error: null }
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

export function chatPeerProfileHref(
  currentRole: "student" | "teacher" | "curator",
  peer: ConversationListPeer
): string | null {
  const peerRole = peer.role.trim().toLowerCase()
  if (peerRole === "group") return null
  if (currentRole === "student" && peerRole === "teacher") return "/mentors/zhao-li"
  if ((currentRole === "teacher" || currentRole === "curator") && peerRole === "student") {
    const mapped = getTeacherStudentByChatProfileId(peer.id)
    return mapped ? `/teacher/students/${mapped.id}` : null
  }
  return null
}
