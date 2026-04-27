import Link from "next/link"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { placeholderImages } from "@/lib/placeholders"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type TeacherProgressStudentRow = {
  id: string
  student_id: string | null
  started_at: string | null
  ended_at: string | null
  lessons: Array<{ title: string | null }> | null
  student_profile:
    | { full_name: string | null; avatar_url: string | null }
    | Array<{ full_name: string | null; avatar_url: string | null }>
    | null
}

function resolveEmbeddedProfile(
  value: TeacherProgressStudentRow["student_profile"]
): { full_name: string | null; avatar_url: string | null } | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function initials(name: string | null | undefined): string {
  const cleaned = (name ?? "").trim()
  if (!cleaned) return "У"

  return cleaned
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
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
    .select("id, role, ui_accent")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "teacher" | "curator"; ui_accent: "sage" | "pink" | "blue" | "orange" | null }>()

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
            "id, student_id, started_at, ended_at, lessons(title), student_profile:profiles!lesson_sessions_student_id_fkey(full_name, avatar_url)"
          )
      : adminSupabase
          .from("lesson_sessions")
          .select(
            "id, student_id, started_at, ended_at, lessons(title), student_profile:profiles!lesson_sessions_student_id_fkey(full_name, avatar_url)"
          )
          .eq("teacher_id", profile.id)

  const { data, error: sessionsError } = await sessionsQuery
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200)

  if (sessionsError) throw new Error(sessionsError.message)

  const studentIds = [...new Set(((data ?? []) as TeacherProgressStudentRow[]).map((row) => row.student_id).filter((value): value is string => Boolean(value)))]
  const { data: studentProfilesData, error: studentProfilesError } = studentIds.length
    ? await adminSupabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", studentIds)
    : { data: [], error: null as { message?: string } | null }

  if (studentProfilesError) throw new Error(studentProfilesError.message)

  const studentProfilesById = new Map(
    ((studentProfilesData ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map((row) => [
      row.id,
      row,
    ])
  )

  const byStudent = new Map<
    string,
    {
      studentId: string
      studentName: string
      studentAvatarUrl: string | null
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

    const embeddedStudentProfile = resolveEmbeddedProfile(row.student_profile)
    const studentProfile = studentProfilesById.get(row.student_id) ?? embeddedStudentProfile

    byStudent.set(row.student_id, {
      studentId: row.student_id,
      studentName: studentProfile?.full_name?.trim() || "Ученик",
      studentAvatarUrl: studentProfile?.avatar_url?.trim() || null,
      latestLessonTitle: row.lessons?.[0]?.title?.trim() || "Онлайн-занятие",
      latestLessonAt: row.ended_at ?? row.started_at,
      lessonsCount: 1,
    })
  }

  const students = [...byStudent.values()]

  return (
    <div className="ds-figma-page" data-progress-accent={profile.ui_accent ?? "sage"}>
      <div className="mx-auto w-full max-w-[min(100%,1440px)] space-y-6">
        <header className="rounded-[34px] bg-[var(--ds-neutral-row)] p-6 ring-1 ring-black/[0.05] dark:ring-white/[0.06] sm:p-8">
          <p className="text-[14px] font-semibold text-ds-text-tertiary">Прогресс учеников</p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.02] text-ds-ink dark:text-white sm:text-[48px]">
            Живая успеваемость по каждому ученику
          </h1>
          <p className="mt-4 max-w-[44rem] text-[15px] leading-7 text-ds-text-secondary dark:text-white/[0.70]">
            Здесь собраны ученики, у которых уже были онлайн-уроки. Открывайте карточку ученика, чтобы увидеть карту навыков,
            историю разборов, ошибки, рекомендации и транскрипции по занятиям.
          </p>
        </header>

        {students.length === 0 ? (
          <Card className="border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#171717] dark:shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
            <CardHeader>
              <CardTitle className="text-ds-ink dark:text-white">Пока нет данных для успеваемости</CardTitle>
              <CardDescription className="text-ds-text-secondary dark:text-white/[0.72]">
                Как только по ученикам появятся онлайн-сессии, здесь откроется список для перехода в детальные отчёты.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {students.map((student) => (
              <Card
                key={student.studentId}
                className="border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#171717] dark:shadow-[0_20px_60px_rgba(0,0,0,0.24)]"
              >
                <CardHeader className="gap-3">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14 shrink-0 ring-1 ring-black/[0.06] dark:ring-white/10">
                      <AvatarImage src={student.studentAvatarUrl || placeholderImages.studentAvatar} alt={student.studentName} className="object-cover" />
                      <AvatarFallback className="bg-[var(--ds-neutral-row)] text-[15px] font-semibold text-ds-ink">
                        {initials(student.studentName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-ds-ink dark:text-white">{student.studentName}</CardTitle>
                      <CardDescription className="mt-2 text-[14px] leading-6 text-ds-text-secondary dark:text-white/[0.72]">
                        Последний урок: {student.latestLessonTitle}
                        <br />
                        {formatDate(student.latestLessonAt)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-ds-text-tertiary dark:text-white/[0.56]">Онлайн-занятий</p>
                    <p className="mt-2 text-[30px] font-semibold leading-none text-ds-ink dark:text-white">{student.lessonsCount}</p>
                  </div>
                  <Link
                    href={`/teacher/students/${student.studentId}/progress`}
                    className="rounded-full bg-[#111111] px-4 py-2.5 text-[14px] font-semibold text-white no-underline transition-[transform,opacity,box-shadow] hover:-translate-y-0.5 hover:bg-[#1a1a1a] hover:shadow-[0_14px_28px_rgba(15,23,42,0.16)] dark:bg-white dark:text-[#151515] dark:hover:bg-white/92 dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.26)]"
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
