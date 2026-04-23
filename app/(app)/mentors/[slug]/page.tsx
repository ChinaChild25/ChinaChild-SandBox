import { notFound } from "next/navigation"
import { MentorDetailView } from "@/components/mentor-detail-view"
import { resolveMentorDisplaySchedule } from "@/lib/mentor-schedule-from-db"
import { mentorsBySlug, mentorSlugs } from "@/lib/mentors"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return mentorSlugs.map((slug) => ({ slug }))
}

/** Подтягиваем актуальный weekly_template с бэкенда (см. mentor_page_slug + RPC get_mentor_public_schedule). */
export const revalidate = 120

export default async function MentorPage({ params }: Props) {
  const { slug } = await params
  const mentor = mentorsBySlug[slug]
  if (!mentor) notFound()

  const scheduleSlots = await resolveMentorDisplaySchedule(slug, mentor.scheduleSlots)

  return <MentorDetailView mentor={{ ...mentor, scheduleSlots }} />
}
