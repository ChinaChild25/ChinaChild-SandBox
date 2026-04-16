import type { SupabaseClient } from "@supabase/supabase-js"

export type ChatCapabilities = {
  has_chat_peer_profiles: boolean
  has_messages_media: boolean
  has_messages_edit_delete: boolean
  has_message_reads: boolean
  has_presence_typing: boolean
}

const FALLBACK_CAPABILITIES: ChatCapabilities = {
  has_chat_peer_profiles: false,
  has_messages_media: false,
  has_messages_edit_delete: false,
  has_message_reads: false,
  has_presence_typing: false
}

let cache: { value: ChatCapabilities; ts: number } | null = null
const TTL_MS = 15_000

export async function getChatCapabilities(supabase: SupabaseClient): Promise<ChatCapabilities> {
  const now = Date.now()
  if (cache && now - cache.ts < TTL_MS) {
    return cache.value
  }

  const { data, error } = await supabase.rpc("get_chat_capabilities")
  if (error || !Array.isArray(data) || data.length === 0) {
    cache = { value: FALLBACK_CAPABILITIES, ts: now }
    return FALLBACK_CAPABILITIES
  }

  const row = data[0] as Partial<ChatCapabilities>
  const normalized: ChatCapabilities = {
    has_chat_peer_profiles: row.has_chat_peer_profiles === true,
    has_messages_media: row.has_messages_media === true,
    has_messages_edit_delete: row.has_messages_edit_delete === true,
    has_message_reads: row.has_message_reads === true,
    has_presence_typing: row.has_presence_typing === true
  }

  cache = { value: normalized, ts: now }
  return normalized
}
