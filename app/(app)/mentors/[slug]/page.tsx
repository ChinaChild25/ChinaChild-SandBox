import { notFound } from "next/navigation"
import { MentorDetailView } from "@/components/mentor-detail-view"
import { mentorsBySlug, mentorSlugs } from "@/lib/mentors"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return mentorSlugs.map((slug) => ({ slug }))
}

export default async function MentorPage({ params }: Props) {
  const { slug } = await params
  const mentor = mentorsBySlug[slug]
  if (!mentor) notFound()
  return <MentorDetailView mentor={mentor} />
}
