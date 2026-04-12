"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getTeacherStudentById } from "@/lib/teacher-students-mock"

export default function TeacherStudentDetailPage() {
  const params = useParams()
  const studentId = typeof params.studentId === "string" ? params.studentId : ""
  const s = getTeacherStudentById(studentId)

  if (!s) {
    return (
      <div className="ds-figma-page">
        <p className="text-ds-text-secondary">Ученик не найден.</p>
        <Link href="/teacher/students" className="mt-4 inline-block text-ds-ink underline">
          К журналу
        </Link>
      </div>
    )
  }

  return (
    <div className="ds-figma-page">
      <div className="mx-auto w-full max-w-[min(100%,640px)]">
        <Link
          href="/teacher/students"
          className="mb-6 inline-flex items-center gap-2 text-[14px] font-medium text-ds-text-secondary no-underline hover:text-ds-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          К журналу
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-ds-sidebar ring-1 ring-black/8">
            <Image
              src={s.avatar}
              alt=""
              fill
              className="object-cover"
              sizes="96px"
              unoptimized={s.avatar.endsWith(".svg")}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold text-ds-ink">{s.name}</h1>
            <p className="mt-1 text-[15px] text-ds-text-secondary">{s.group}</p>
            <p className="mt-2 text-[16px] font-semibold text-ds-ink">
              Цель: <span className="text-ds-sage-strong">{s.hskTarget}</span>
              <span className="mx-2 text-ds-text-tertiary">·</span>
              <span className="font-normal text-ds-text-secondary">уровень {s.levelLabel}</span>
            </p>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-[17px] font-semibold text-ds-ink">Треки и прогресс</h2>
          <ul className="space-y-3">
            {s.tracks.map((t) => (
              <li key={t.title}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="text-ds-ink">{t.title}</span>
                  <span className="tabular-nums text-ds-text-tertiary">{t.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-ds-sage-strong"
                    style={{ width: `${Math.min(100, t.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[16px] font-semibold text-ds-ink">Сильные стороны</h2>
            <ul className="list-none space-y-1.5 p-0 text-[14px] text-ds-text-secondary">
              {s.strengths.map((x) => (
                <li key={x} className="rounded-lg bg-ds-sage/25 px-3 py-2 text-ds-ink dark:bg-ds-sage/15">
                  {x}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-[16px] font-semibold text-ds-ink">Зоны внимания</h2>
            <ul className="list-none space-y-1.5 p-0 text-[14px] text-ds-text-secondary">
              {s.weaknesses.map((x) => (
                <li key={x} className="rounded-lg bg-black/[0.04] px-3 py-2 dark:bg-white/[0.06]">
                  {x}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section>
          <h2 className="mb-3 text-[17px] font-semibold text-ds-ink">Последние тесты</h2>
          <div className="overflow-hidden rounded-[var(--ds-radius-xl)] border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="bg-[var(--ds-neutral-row)] text-[13px] font-semibold text-ds-ink">
                  <th className="px-4 py-3">Тема</th>
                  <th className="px-4 py-3">Балл</th>
                </tr>
              </thead>
              <tbody>
                {s.lastTests.map((t) => (
                  <tr key={t.title} className="border-t border-black/8 dark:border-white/10">
                    <td className="px-4 py-3 text-ds-text-secondary">{t.title}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-ds-ink">{t.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
