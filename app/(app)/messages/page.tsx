"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesView } from "@/components/messages/messages-view"
import { MESSAGES_CONVERSATIONS } from "@/lib/messages-conversations"

function MessagesPageInner() {
  const searchParams = useSearchParams()
  const mentorParam = searchParams.get("mentor")

  return (
    <MessagesView conversations={MESSAGES_CONVERSATIONS} initialMentorId={mentorParam} />
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-figma-page ds-messages-page flex min-h-0 flex-1 flex-col">
          <div className="flex w-full flex-1 flex-col px-1 py-10 text-ds-text-tertiary md:px-0">
            Загрузка…
          </div>
        </div>
      }
    >
      <MessagesPageInner />
    </Suspense>
  )
}
