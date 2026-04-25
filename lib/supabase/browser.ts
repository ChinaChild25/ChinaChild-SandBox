"use client"

import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/config"

/** Клиент для Client Components (singleton внутри @supabase/ssr). */
export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY или SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY"
    )
  }
  const url = getSupabaseUrl()!
  const anon = getSupabaseAnonKey()!
  return createBrowserClient(url, anon)
}
