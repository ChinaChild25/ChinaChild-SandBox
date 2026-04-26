import { notFound, redirect } from "next/navigation"
import { ProgressOverview } from "@/components/progress/progress-overview"
import { getStudentProgressOverview } from "@/lib/lesson-analytics/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function TeacherStudentProgressPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
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

  if (profile.role !== "teacher" && profile.role !== "curator") {
    redirect("/dashboard")
  }

  const { studentId } = await params
  const adminSupabase = createAdminSupabaseClient()

  const ownershipQuery =
    profile.role === "curator"
      ? adminSupabase
          .from("lesson_sessions")
          .select("id")
          .eq("student_id", studentId)
          .limit(1)
      : adminSupabase
          .from("lesson_sessions")
          .select("id")
          .eq("student_id", studentId)
          .eq("teacher_id", profile.id)
          .limit(1)

  const { data: ownershipRows, error: ownershipError } = await ownershipQuery

  if (ownershipError) throw new Error(ownershipError.message)
  if (!ownershipRows?.length) notFound()

  const overview = await getStudentProgressOverview({
    adminSupabase,
    studentId,
    limit: 10,
  })

  return (
    <ProgressOverview
      title={overview.studentName ? `Успеваемость: ${overview.studentName}` : "Успеваемость ученика"}
      subtitle="После каждого live-занятия сюда попадают summary, ошибки, рекомендации, темы урока и полная транскрипция, чтобы преподаватель видел динамику по каждому разбору."
      current={overview.skillMap}
      previous={overview.previousSkillMap}
      sessions={overview.sessions}
    />
  )
}
