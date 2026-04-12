"use client"

import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/config"

/** Клиент для Client Components (singleton внутри @supabase/ssr). */
export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local"
    )
  }
  const url = getSupabaseUrl()!
  const anon = getSupabaseAnonKey()!
  return createBrowserClient(url, anon)
}
