"use client"

import Link from "next/link"
import { PlayCircle, UserRound } from "lucide-react"
import { parseLessonStart } from "@/lib/schedule-lessons"
import { getLessonsForTeacherView } from "@/lib/teacher-student-lessons"
import { TEACHER_STUDENTS_ACTIVE } from "@/lib/teacher-students-mock"

export default function TeacherClassesPage() {
  const rows = TEACHER_STUDENTS_ACTIVE.flatMap((s) =>
    getLessonsForTeacherView(s.id).map((lesson) => {
      const start = parseLessonStart(lesson.dateKey, lesson.time)
      return { student: s, lesson, start }
    })
  ).sort((a, b) => a.start.getTime() - b.start.getTime())

  const now = Date.now() - 60 * 60 * 1000
  const upcoming = rows.filter((r) => r.start.getTime() >= now)
  const completed = rows.filter((r) => r.start.getTime() < now)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-6">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">Занятия</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Рабочая лента преподавателя: запуск уроков и переход к карточке ученика по реальной связке.
          </p>
        </header>

        <section className="mb-8">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">Предстоящие</p>
          <ul className="space-y-3">
            {upcoming.map(({ student, lesson, start }) => (
              <li key={lesson.id}>
                <article className="rounded-2xl bg-[var(--ds-neutral-row)] p-4">
                  <div className="mb-1 text-[13px] text-ds-text-secondary">
                    {start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} ·{" "}
                    {start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-[18px] font-semibold text-ds-ink">{lesson.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/teacher/students/${student.id}`} className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-[13px] text-ds-ink no-underline">
                      <UserRound className="h-4 w-4" /> {student.name}
                    </Link>
                    <Link href={`/teacher/messages?peerId=${student.chatProfileId ?? ""}&peerName=${encodeURIComponent(student.name)}`} className="inline-flex items-center gap-1 rounded-full bg-ds-ink px-3 py-1.5 text-[13px] text-white no-underline dark:bg-white dark:text-[#1a1a1a]">
                      <PlayCircle className="h-4 w-4" /> Начать занятие
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">Прошедшие</p>
          <ul className="space-y-2">
            {completed.slice(-8).reverse().map(({ student, lesson, start }) => (
              <li key={`${lesson.id}-done`} className="rounded-xl bg-[var(--ds-neutral-row)] px-4 py-3 text-[14px] text-ds-text-secondary">
                <span className="font-medium text-ds-ink">{student.name}</span> · {lesson.title} ·{" "}
                {start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} {lesson.time}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
