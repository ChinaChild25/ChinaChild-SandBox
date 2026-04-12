"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { TEACHER_STUDENTS_MOCK } from "@/lib/teacher-students-mock"

export default function TeacherStudentsPage() {
  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,1100px)]">
        <nav className="mb-4 text-[14px] text-ds-text-tertiary">
          <Link href="/teacher/dashboard" className="text-ds-text-secondary no-underline hover:underline">
            Главная
          </Link>
          <span className="mx-1.5">→</span>
          <span className="font-medium text-ds-ink">Ученики</span>
        </nav>

        <h1 className="mb-1 text-[28px] font-bold leading-tight text-ds-ink sm:text-[34px]">Журнал учеников</h1>
        <p className="mb-6 text-[15px] text-[var(--ds-text-secondary)]">
          Сводка по группам и активности (демо-данные).
        </p>

        <div className="overflow-x-auto rounded-[var(--ds-radius-xl)] border border-black/10 bg-ds-surface dark:border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="bg-ds-sage/50 text-[13px] font-semibold text-ds-ink dark:bg-ds-sage/25">
                <th className="w-10 px-3 py-3" aria-hidden />
                <th className="px-3 py-3">Имя</th>
                <th className="px-3 py-3">Группа</th>
                <th className="px-3 py-3">Домашние</th>
                <th className="px-3 py-3">Посещаемость</th>
                <th className="px-3 py-3">Тесты</th>
                <th className="px-3 py-3">Оценка</th>
                <th className="w-10 px-2 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {TEACHER_STUDENTS_MOCK.map((s, i) => (
                <tr
                  key={s.id}
                  className={i % 2 === 0 ? "bg-white dark:bg-[#0a0a0a]" : "bg-[#f7f7f8] dark:bg-[#121212]"}
                >
                  <td className="px-3 py-3 align-middle">
                    <span className="inline-flex h-4 w-4 rounded border border-black/20 dark:border-white/20" />
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <Link
                      href={`/teacher/students/${s.id}`}
                      className="flex items-center gap-3 font-medium text-ds-ink no-underline hover:underline"
                    >
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ds-sidebar">
                        <Image
                          src={s.avatar}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="36px"
                          unoptimized={s.avatar.endsWith(".svg")}
                        />
                      </span>
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-middle text-ds-text-secondary">{s.group}</td>
                  <td className="px-3 py-3 align-middle tabular-nums">
                    {s.homeworks.done}/{s.homeworks.total}
                  </td>
                  <td className="px-3 py-3 align-middle tabular-nums">
                    {s.attendance.done}/{s.attendance.total}
                  </td>
                  <td className="px-3 py-3 align-middle tabular-nums">
                    {s.tests.score}/{s.tests.max}
                  </td>
                  <td className="px-3 py-3 align-middle tabular-nums font-medium">
                    {s.grade.value}/{s.grade.max}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <Link
                      href={`/teacher/students/${s.id}`}
                      className="inline-flex text-ds-text-tertiary hover:text-ds-ink"
                      aria-label={`Карточка ${s.name}`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
