import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookOpen, CalendarDays, MessageCircle, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { mentorsBySlug, mentorSlugs } from "@/lib/mentors"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return mentorSlugs.map((slug) => ({ slug }))
}

function ReviewStars({ count }: { count: number }) {
  return (
    <div className="flex shrink-0 gap-0.5 text-amber-400" aria-label={`Оценка ${count} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("h-4 w-4", i < count ? "fill-amber-400 stroke-amber-500" : "fill-transparent stroke-neutral-300")}
          strokeWidth={i < count ? 0 : 1.5}
          aria-hidden
        />
      ))}
    </div>
  )
}

export default async function MentorPage({ params }: Props) {
  const { slug } = await params
  const mentor = mentorsBySlug[slug]
  if (!mentor) notFound()

  const stats = [
    { value: mentor.stats.rating, label: "рейтинг" },
    { value: String(mentor.stats.students), label: "студентов" },
    { value: String(mentor.stats.lessons), label: "уроков" },
    { value: `${mentor.stats.yearsExperience} лет`, label: "опыт" }
  ]

  return (
    <div className="ds-figma-page">
      <div className="rounded-[28px] bg-[#f5f5f5] p-5 md:p-8 dark:bg-ds-surface-muted">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-[#737373] no-underline transition-colors hover:text-ds-ink dark:text-ds-text-tertiary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Назад
        </Link>

        {/* Шапка профиля */}
        <header className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="relative mx-auto h-[160px] w-[160px] shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white shadow-sm md:mx-0 md:h-[176px] md:w-[176px]">
            <Image src={mentor.photo} alt={mentor.name} fill className="object-cover" sizes="176px" unoptimized />
          </div>

          <div className="min-w-0 flex-1 text-center md:text-left">
            <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.03em] text-ds-ink">
              {mentor.name}
            </h1>
            <p className="mt-2 text-[16px] text-[#737373] dark:text-ds-text-secondary">{mentor.titleLine}</p>

            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-4">
              {stats.map((s) => (
                <div key={s.label} className="text-center md:text-left">
                  <div className="text-[22px] font-bold leading-none text-ds-ink md:text-[24px]">{s.value}</div>
                  <div className="mt-1.5 text-[13px] text-[#888] dark:text-ds-text-tertiary">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start">
              <Link
                href={`/messages?mentor=${mentor.slug}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-black px-6 text-[15px] font-semibold text-white no-underline transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
              >
                <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
                Написать
              </Link>
              <Link
                href="/schedule"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border border-black/10 bg-white px-6 text-[15px] font-semibold text-ds-ink no-underline shadow-sm transition-colors hover:bg-[#fafafa] dark:border-white/15 dark:bg-ds-surface dark:hover:bg-white/5"
              >
                <CalendarDays className="h-5 w-5" strokeWidth={2} aria-hidden />
                Расписание
              </Link>
            </div>
          </div>
        </header>

        {/* Основная сетка: центр + правая колонка */}
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-[24px] bg-white p-6 shadow-sm dark:border dark:border-white/10 dark:bg-ds-surface md:p-8">
              <h2 className="text-[18px] font-semibold text-ds-ink">О преподавателе</h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-[#555] dark:text-ds-text-secondary">{mentor.about}</p>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-sm dark:border dark:border-white/10 dark:bg-ds-surface md:p-8">
              <h2 className="text-[18px] font-semibold text-ds-ink">Образование</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#555] dark:text-ds-text-secondary">{mentor.education}</p>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-sm dark:border dark:border-white/10 dark:bg-ds-surface md:p-8">
              <h2 className="text-[18px] font-semibold text-ds-ink">Отзывы студентов</h2>
              <ul className="mt-5 space-y-4 p-0 list-none">
                {mentor.reviews.map((r) => (
                  <li
                    key={r.author}
                    className="rounded-[20px] border border-black/[0.06] bg-[#fafafa] p-5 dark:border-white/10 dark:bg-ds-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-semibold text-ds-ink">{r.author}</span>
                      <ReviewStars count={r.stars} />
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#555] dark:text-ds-text-secondary">{r.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <section className="rounded-[24px] bg-[#e2f0d9] p-6 dark:bg-[#2d3d28] md:p-7">
              <div className="mb-4 flex items-center gap-2 text-[17px] font-semibold text-ds-ink dark:text-white">
                <BookOpen className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                Предметы
              </div>
              <div className="flex flex-wrap gap-2">
                {mentor.subjects.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[var(--ds-radius-md)] bg-white px-3.5 py-2 text-[13px] font-medium text-ds-ink shadow-sm dark:bg-white/15 dark:text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-sm dark:border dark:border-white/10 dark:bg-ds-surface md:p-7">
              <h2 className="text-[17px] font-semibold text-ds-ink">Языки преподавания</h2>
              <ul className="mt-4 space-y-2 pl-5 text-[15px] text-[#555] dark:text-ds-text-secondary [list-style-type:disc]">
                {mentor.languages.map((lang) => (
                  <li key={lang}>{lang}</li>
                ))}
              </ul>
            </section>

            <section className="overflow-hidden rounded-[24px] bg-[#1a1a1a] p-6 text-white md:p-7 dark:bg-[#0a0a0a]">
              <div className="mb-5 flex items-center gap-2 text-[17px] font-semibold">
                <CalendarDays className="h-5 w-5 shrink-0 text-white/90" aria-hidden />
                Расписание занятий
              </div>
              <ul className="divide-y divide-white/12 p-0 list-none">
                {mentor.scheduleSlots.map((row) => (
                  <li key={`${row.day}-${row.time}`} className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
                    <span className="text-[15px] font-medium text-white/95">{row.day}</span>
                    <span className="text-[15px] tabular-nums text-white/75">{row.time}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
