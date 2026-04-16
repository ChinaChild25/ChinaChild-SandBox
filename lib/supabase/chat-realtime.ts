import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { isOnline } from "@/lib/supabase/presence"

export type RealtimeMessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  is_forwarded: boolean | null
  forwarded_from_message_id: string | null
  media_url: string | null
  media_type: string | null
  media_size: number | null
  media_duration_sec?: number | null
  reply_to_id: string | null
}

export function subscribeToMessages(
  supabase: SupabaseClient,
  conversationId: string,
  onInsert: (msg: RealtimeMessageRow) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => onInsert(payload.new as RealtimeMessageRow)
    )
    .subscribe()
}

export type PresenceStatus = "online" | "offline"

export function subscribeToPresence(
  supabase: SupabaseClient,
  onUpdate: (userId: string, status: PresenceStatus) => void
): RealtimeChannel {
  return supabase
    .channel("user_presence:all")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, (payload) => {
      const row = (payload.new ?? payload.old) as
        | { user_id: string; status: string; last_seen_at?: string | null }
        | null
      if (!row?.user_id) return
      const status: PresenceStatus =
        row.status === "online" && typeof row.last_seen_at === "string" && isOnline(row as { status: string; last_seen_at: string })
          ? "online"
          : "offline"
      onUpdate(row.user_id, status)
    })
    .subscribe()
}

export function subscribeToTyping(
  supabase: SupabaseClient,
  conversationId: string,
  onUpdate: (userId: string, isTyping: boolean) => void
): RealtimeChannel {
  return supabase
    .channel(`typing:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "typing_indicators",
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as { user_id?: string }
          if (oldRow.user_id) onUpdate(oldRow.user_id, false)
          return
        }
        const newRow = payload.new as { user_id?: string }
        if (newRow.user_id) onUpdate(newRow.user_id, true)
      }
    )
    .subscribe()
}

export function subscribeToMessageReads(
  supabase: SupabaseClient,
  onInsert: (payload: { message_id?: string; user_id?: string }) => void
): RealtimeChannel {
  return supabase
    .channel("message_reads:all")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "message_reads" },
      (payload) => onInsert(payload.new as { message_id?: string; user_id?: string })
    )
    .subscribe()
}
