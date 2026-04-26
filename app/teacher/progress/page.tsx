import Link from "next/link"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type TeacherProgressStudentRow = {
  id: string
  student_id: string | null
  started_at: string | null
  ended_at: string | null
  lessons: Array<{ title: string | null }> | null
  student_profile: Array<{ full_name: string | null }> | null
}

function formatDate(value: string | null): string {
  if (!value) return "ещё без даты"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "ещё без даты"

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default async function TeacherProgressPage() {
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

  const adminSupabase = createAdminSupabaseClient()
  const sessionsQuery =
    profile.role === "curator"
      ? adminSupabase
          .from("lesson_sessions")
          .select(
            "id, student_id, started_at, ended_at, lessons(title), student_profile:profiles!lesson_sessions_student_id_fkey(full_name)"
          )
      : adminSupabase
          .from("lesson_sessions")
          .select(
            "id, student_id, started_at, ended_at, lessons(title), student_profile:profiles!lesson_sessions_student_id_fkey(full_name)"
          )
          .eq("teacher_id", profile.id)

  const { data, error: sessionsError } = await sessionsQuery
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200)

  if (sessionsError) throw new Error(sessionsError.message)

  const byStudent = new Map<
    string,
    {
      studentId: string
      studentName: string
      latestLessonTitle: string
      latestLessonAt: string | null
      lessonsCount: number
    }
  >()

  for (const row of (data ?? []) as TeacherProgressStudentRow[]) {
    if (!row.student_id) continue

    const existing = byStudent.get(row.student_id)
    if (existing) {
      existing.lessonsCount += 1
      continue
    }

    byStudent.set(row.student_id, {
      studentId: row.student_id,
      studentName: row.student_profile?.[0]?.full_name?.trim() || "Ученик",
      latestLessonTitle: row.lessons?.[0]?.title?.trim() || "Онлайн-занятие",
      latestLessonAt: row.ended_at ?? row.started_at,
      lessonsCount: 1,
    })
  }

  const students = [...byStudent.values()]

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,1440px)] space-y-6">
        <header className="rounded-[34px] bg-[linear-gradient(135deg,rgba(147,197,253,0.16),rgba(245,197,66,0.12),rgba(255,255,255,0.96))] p-6 ring-1 ring-black/[0.05] dark:bg-[linear-gradient(135deg,rgba(147,197,253,0.10),rgba(245,197,66,0.08),rgba(20,20,24,0.95))] dark:ring-white/[0.06] sm:p-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ds-text-tertiary">Прогресс учеников</p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.02] text-ds-ink dark:text-white sm:text-[48px]">
            Живая успеваемость по каждому ученику
          </h1>
          <p className="mt-4 max-w-[44rem] text-[15px] leading-7 text-ds-text-secondary dark:text-white/[0.70]">
            Здесь собраны ученики, у которых уже были live-уроки. Открывайте карточку ученика, чтобы увидеть карту навыков,
            историю разборов, ошибки, рекомендации и транскрипции по занятиям.
          </p>
        </header>

        {students.length === 0 ? (
          <Card className="border-black/[0.08] bg-white/[0.95] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle>Пока нет данных для успеваемости</CardTitle>
              <CardDescription>
                Как только по ученикам появятся live-сессии, здесь откроется список для перехода в детальные отчёты.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {students.map((student) => (
              <Card key={student.studentId} className="border-black/[0.08] bg-white/[0.95] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <CardHeader className="gap-3">
                  <CardTitle>{student.studentName}</CardTitle>
                  <CardDescription className="text-[14px] leading-6">
                    Последний урок: {student.latestLessonTitle}
                    <br />
                    {formatDate(student.latestLessonAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ds-text-tertiary">Live-занятий</p>
                    <p className="mt-2 text-[30px] font-semibold leading-none text-ds-ink">{student.lessonsCount}</p>
                  </div>
                  <Link
                    href={`/teacher/students/${student.studentId}/progress`}
                    className="rounded-full bg-ds-ink px-4 py-2.5 text-[14px] font-semibold text-white no-underline transition-opacity hover:opacity-92 dark:bg-white dark:text-[#1a1a1a]"
                  >
                    Открыть успеваемость
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
