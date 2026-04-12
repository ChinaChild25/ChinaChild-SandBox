"use client"

import { MessagesView } from "@/components/messages/messages-view"
import { SupabaseMessages } from "@/components/messages/supabase-messages"
import { useAuth } from "@/lib/auth-context"

export default function TeacherMessagesPage() {
  const { usesSupabase } = useAuth()

  if (usesSupabase) {
    return <SupabaseMessages />
  }

  return <MessagesView conversations={[]} />
}
