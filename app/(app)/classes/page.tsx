"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, FileCheck, Users, Video } from "lucide-react"

import { getClassesForStudent, type ClassDisplayType } from "@/lib/classes-mock"

const classTypes: Array<ClassDisplayType | "Все"> = ["Все", "Урок", "Разговорный клуб", "Тест"]

function typeIcon(t: ClassDisplayType) {
  if (t === "Тест") return <FileCheck size={20} className="text-ds-text-tertiary" aria-hidden />
  if (t === "Разговорный клуб") return <Users size={20} className="text-ds-text-tertiary" aria-hidden />
  return <Video size={20} className="text-ds-text-tertiary" aria-hidden />
}

export default function ClassesPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof classTypes)[number]>("Все")
  const allClasses = useMemo(() => getClassesForStudent(), [])

  const filtered =
    activeFilter === "Все" ? allClasses : allClasses.filter((c) => c.type === activeFilter)

  const upcoming = filtered.filter((c) => c.status === "upcoming")
  const completed = filtered.filter((c) => c.status === "completed")

  return (
    <div className="ds-page">
      <div className="mx-auto w-full max-w-[var(--ds-shell-max-width)]">
        <header className="mb-6 md:mb-7">
          <h1 className="text-[clamp(1.75rem,5vw,2.25rem)] font-bold leading-none text-ds-ink">Занятия</h1>
          <p className="mt-1 text-[15px] text-[var(--ds-text-secondary)]">Все ваши занятия в одном месте</p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2 md:mb-7">
          {classTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveFilter(t)}
              className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                activeFilter === t
                  ? "bg-ds-ink text-white"
                  : "bg-ds-sidebar text-ds-ink hover:bg-ds-sidebar-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {upcoming.length > 0 ? (
          <section className="mb-8">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">
              Предстоящие
            </p>
            <ul className="space-y-3">
              {upcoming.map((cls) => (
                <li key={cls.id}>
                  <ClassCard cls={cls} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {completed.length > 0 ? (
          <section>
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-ds-text-tertiary">
              Прошедшие
            </p>
            <ul className="space-y-3">
              {completed.map((cls) => (
                <li key={cls.id}>
                  <ClassCard cls={cls} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ClassCard({ cls }: { cls: ReturnType<typeof getClassesForStudent>[0] }) {
  const href = cls.slug ? `/${cls.slug}` : "/schedule"
  return (
    <Link
      href={href}
      className="ds-class-card group flex items-center gap-3 rounded-2xl p-3 no-underline outline-offset-2 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ds-ink/25 md:gap-4 md:p-4"
    >
      <div
        className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl md:h-[72px] md:w-[72px]"
        style={{ backgroundColor: cls.bgColor, color: cls.textColor }}
      >
        <span className="text-[20px] font-semibold leading-none">{cls.dateLabel}</span>
        <span className="mt-0.5 text-[10px] opacity-90">{cls.monthShort}</span>
        <span className="mt-0.5 text-[10px] opacity-70">{cls.timeRange.split("–")[0]}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          {typeIcon(cls.type)}
          <span className="text-[16px] font-medium text-ds-ink">{cls.title}</span>
        </div>
        <p className="truncate text-[13px] text-[var(--ds-text-secondary)]">{cls.description}</p>
        <p className="text-[12px] text-ds-text-soft">
          {cls.teacher} · {cls.timeRange}
        </p>
      </div>

      {cls.grade != null ? (
        <span className="shrink-0 text-[22px] font-bold text-ds-sage-strong">{cls.grade}</span>
      ) : null}

      <ChevronRight
        size={20}
        className="shrink-0 text-ds-chevron opacity-60 transition-opacity group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  )
}
