"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesView } from "@/components/messages/messages-view"
import { SupabaseMessages } from "@/components/messages/supabase-messages"
import { TeacherStartChatComposer } from "@/components/messages/teacher-start-chat-composer"
import { useAuth } from "@/lib/auth-context"

const TEACHER_LIST_EMPTY = {
  title: "У вас пока нет диалогов",
  subtitle: "Выберите ученика, чтобы начать переписку."
}

const TEACHER_NO_SELECTION = {
  title: "Выберите диалог",
  subtitle: "Выберите существующий чат или начните новый."
}

const PEER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function TeacherMessagesSupabase() {
  const searchParams = useSearchParams()
  const conversation = searchParams.get("conversation")
  const peerId = searchParams.get("peerId")
  const peerName = searchParams.get("peerName")
  const newChatPeerHint =
    peerId && peerName && PEER_ID_RE.test(peerId.trim())
      ? { id: peerId.trim(), name: peerName.trim() }
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SupabaseMessages
        initialConversationId={conversation}
        newChatPeerHint={newChatPeerHint}
        listToolbarEnd={<TeacherStartChatComposer />}
        listEmptyCopy={TEACHER_LIST_EMPTY}
        noSelectionCopy={TEACHER_NO_SELECTION}
      />
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
