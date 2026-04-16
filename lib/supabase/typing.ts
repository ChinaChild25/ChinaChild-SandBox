import type { SupabaseClient } from "@supabase/supabase-js"

const TYPING_STOP_DELAY_MS = 2000

export function createTypingManager(supabase: SupabaseClient, conversationId: string) {
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  let isCurrentlyTyping = false

  function onKeypress() {
    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true
      void supabase.rpc("set_typing", {
        p_conversation_id: conversationId,
        p_is_typing: true
      }).then(({ error }) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.warn("[chat/typing] set_typing true failed:", error.message)
        }
      })
    }

    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = setTimeout(() => {
      isCurrentlyTyping = false
      void supabase.rpc("set_typing", {
        p_conversation_id: conversationId,
        p_is_typing: false
      }).then(({ error }) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.warn("[chat/typing] set_typing false failed:", error.message)
        }
      })
    }, TYPING_STOP_DELAY_MS)
  }

  function cleanup() {
    if (stopTimer) clearTimeout(stopTimer)
    isCurrentlyTyping = false
    void supabase.rpc("set_typing", {
      p_conversation_id: conversationId,
      p_is_typing: false
    }).then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("[chat/typing] cleanup set_typing false failed:", error.message)
      }
    })
  }

  return { onKeypress, cleanup }
}
