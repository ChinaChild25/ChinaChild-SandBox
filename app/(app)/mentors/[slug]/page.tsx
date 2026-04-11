import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail } from "lucide-react"
import { mentorsBySlug, mentorSlugs } from "@/lib/mentors"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return mentorSlugs.map((slug) => ({ slug }))
}

export default async function MentorPage({ params }: Props) {
  const { slug } = await params
  const mentor = mentorsBySlug[slug]
  if (!mentor) notFound()

  return (
    <div className="ds-figma-page">
      <div className="mx-auto flex w-full max-w-[var(--ds-shell-max-width)] flex-col gap-4">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-ds-text-secondary transition-colors hover:text-ds-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          На главную
        </Link>

        <section className="ek-surface bg-ds-panel-muted px-7 py-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-ds-sidebar ring-2 ring-white">
              <Image src={mentor.photo} alt={mentor.name} fill className="object-cover" sizes="96px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm uppercase tracking-[0.18em] text-black/45">Преподавательский состав</p>
              <h1 className="mt-2 text-[2.2rem] font-semibold leading-none tracking-tight text-ds-ink">
                {mentor.name}
              </h1>
              <p className="mt-2 text-base text-ds-text-muted">{mentor.role}</p>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ds-text-secondary">{mentor.bio}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {mentor.focus.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full bg-white px-3 py-1 text-sm text-ds-ink ring-1 ring-black/8"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/messages"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ds-ink px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  Написать в чат
                </Link>
                <Link
                  href="/schedule"
                  className="inline-flex items-center justify-center rounded-2xl border border-black/12 bg-white px-5 py-3 text-sm font-medium text-ds-ink hover:bg-black/[0.03]"
                >
                  Расписание
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
