"use client"

import Link from "next/link"
import { TEACHER_STUDENTS_ACTIVE } from "@/lib/teacher-students-mock"

export default function TeacherProgressPage() {
  const rows = TEACHER_STUDENTS_ACTIVE.map((s) => {
    const avg = Math.round((s.tests.score + s.grade.value) / 2)
    const done = s.homeworks.done
    const total = s.homeworks.total
    return { s, avg, done, total }
  }).sort((a, b) => b.avg - a.avg)

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-6">
          <h1 className="text-[36px] font-bold leading-none text-ds-ink">Оценки учеников</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">
            Журнал преподавателя: результаты по ученикам, а не личная «моя успеваемость».
          </p>
        </header>

        <div className="space-y-3">
          {rows.map(({ s, avg, done, total }) => (
            <article key={s.id} className="rounded-2xl bg-[var(--ds-neutral-row)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[18px] font-semibold text-ds-ink">{s.name}</div>
                  <div className="text-[13px] text-ds-text-secondary">
                    ДЗ: {done}/{total} · Тест: {s.tests.score}/{s.tests.max} · Итог: {s.grade.value}/{s.grade.max}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[24px] font-bold text-ds-sage-strong">{avg}</div>
                  <div className="text-[11px] text-ds-text-tertiary">средний</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                  <div className="h-full rounded-full bg-ds-sage-strong" style={{ width: `${Math.min(100, avg)}%` }} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/teacher/students/${s.id}`} className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] text-ds-ink no-underline">
                  Профиль ученика
                </Link>
                <Link href={`/teacher/messages?peerId=${s.chatProfileId ?? ""}&peerName=${encodeURIComponent(s.name)}`} className="rounded-full bg-ds-ink px-3 py-1.5 text-[13px] text-white no-underline dark:bg-white dark:text-[#1a1a1a]">
                  Написать
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
