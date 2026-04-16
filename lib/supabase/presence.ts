import type { SupabaseClient } from "@supabase/supabase-js"

const HEARTBEAT_INTERVAL_MS = 30_000
const OFFLINE_THRESHOLD_MS = 90_000

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let beforeUnloadHandler: (() => void) | null = null
let visibilityHandler: (() => void) | null = null

export function startPresenceHeartbeat(supabase: SupabaseClient) {
  void supabase.rpc("upsert_presence", { p_status: "online" }).then(({ error }) => {
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[chat/presence] upsert_presence online failed:", error.message)
    }
  })

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
  }
  heartbeatTimer = setInterval(() => {
    void supabase.rpc("upsert_presence", { p_status: "online" }).then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("[chat/presence] heartbeat online failed:", error.message)
      }
    })
  }, HEARTBEAT_INTERVAL_MS)

  beforeUnloadHandler = () => {
    void supabase.rpc("upsert_presence", { p_status: "offline" })
  }

  visibilityHandler = () => {
    const status = document.hidden ? "offline" : "online"
    void supabase.rpc("upsert_presence", { p_status: status }).then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn(`[chat/presence] visibility ${status} failed:`, error.message)
      }
    })
  }

  window.addEventListener("beforeunload", beforeUnloadHandler)
  document.addEventListener("visibilitychange", visibilityHandler)
}

export function stopPresenceHeartbeat(supabase: SupabaseClient) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler)
    beforeUnloadHandler = null
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler)
    visibilityHandler = null
  }
  void supabase.rpc("upsert_presence", { p_status: "offline" }).then(({ error }) => {
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[chat/presence] stop offline failed:", error.message)
    }
  })
}

export function isOnline(presence: { status: string; last_seen_at: string }): boolean {
  if (presence.status !== "online") return false
  const diffMs = Date.now() - new Date(presence.last_seen_at).getTime()
  return diffMs < OFFLINE_THRESHOLD_MS
}
