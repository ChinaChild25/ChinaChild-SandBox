"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesView } from "@/components/messages/messages-view"
import { SupabaseMessages } from "@/components/messages/supabase-messages"
import { TeacherStartChatComposer } from "@/components/messages/teacher-start-chat-composer"
import { useAuth } from "@/lib/auth-context"

function TeacherMessagesSupabase() {
  const searchParams = useSearchParams()
  const conversation = searchParams.get("conversation")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TeacherStartChatComposer />
      <div className="min-h-0 flex-1">
        <SupabaseMessages initialConversationId={conversation} />
      </div>
    </div>
  )
}

export default function TeacherMessagesPage() {
  const { usesSupabase } = useAuth()

  if (!usesSupabase) {
    return <MessagesView conversations={[]} />
  }

  return (
    <Suspense
      fallback={
        <div className="ds-figma-page flex min-h-0 flex-1 flex-col px-4 py-10 text-ds-text-secondary">
          Загрузка…
        </div>
      }
    >
      <TeacherMessagesSupabase />
    </Suspense>
  )
}
