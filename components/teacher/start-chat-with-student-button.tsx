"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquarePlus } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { createStudentTeacherConversation } from "@/lib/supabase/chat"
import { Button } from "@/components/ui/button"

type Props = {
  /** `profiles.id` ученика в Supabase */
  studentProfileId: string
  className?: string
}

export function StartChatWithStudentButton({ studentProfileId, className }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!user?.id || !studentProfileId.trim()) return
    setError(null)
    setWorking(true)
    const supabase = createBrowserSupabaseClient()
    const res = await createStudentTeacherConversation(supabase, user.id, studentProfileId.trim())
    setWorking(false)
    if ("error" in res) {
      setError(res.error)
      return
    }
    router.push(`/teacher/messages?conversation=${res.conversationId}`)
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button
        type="button"
        variant="secondary"
        className={className}
        disabled={working || !user}
        onClick={() => void handleClick()}
      >
        {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}
        Написать
      </Button>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  )
}
