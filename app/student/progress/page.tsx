import { redirect } from "next/navigation"
import { ProgressOverview } from "@/components/progress/progress-overview"
import { getStudentProgressOverview } from "@/lib/lesson-analytics/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function StudentProgressPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "teacher" | "curator" }>()

  if (error) throw new Error(error.message)
  if (!profile) redirect("/")

  if (profile.role !== "student") {
    redirect(profile.role === "teacher" || profile.role === "curator" ? "/teacher/dashboard" : "/dashboard")
  }

  const adminSupabase = createAdminSupabaseClient()
  const overview = await getStudentProgressOverview({
    adminSupabase,
    studentId: profile.id,
    limit: 10,
  })

  return (
    <ProgressOverview
      title="Моя успеваемость"
      subtitle="Здесь собирается история разборов после звонков: карта навыков, сильные стороны, рекомендации, ошибки и полные транскрипции по каждому уроку."
      accent={overview.studentAccent}
      showStudentIdentity={false}
      current={overview.skillMap}
      previous={overview.previousSkillMap}
      sessions={overview.sessions}
    />
  )
}
