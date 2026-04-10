import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookCheck, CheckCircle2, Clock3 } from "lucide-react"
import { lessonBySlug, lessonSlugs } from "@/lib/course-catalog"

type LessonPageProps = {
  params: Promise<{ lessonSlug: string }>
}

export function generateStaticParams() {
  return lessonSlugs.map((lessonSlug) => ({ lessonSlug }))
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonSlug } = await params
  const lesson = lessonBySlug[lessonSlug]

  if (!lesson) {
    notFound()
  }

  return (
    <div className="px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[76.5rem] flex-col gap-4">
        <section className="ek-surface bg-[#ebebeb] px-7 py-6">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-black/60 hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к курсам
          </Link>
          <h1 className="mt-4 text-[2.5rem] leading-[0.98] font-semibold tracking-[-0.05em] text-[#171a23]">
            {lesson.title}
          </h1>
          <p className="mt-2 text-base text-black/58">
            Курс: {lesson.courseName} · Маршрут: /{lesson.slug}
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
          <section className="ek-surface bg-[#ebebeb] px-7 py-6">
            <h2 className="text-[1.7rem] leading-none font-semibold tracking-[-0.03em] text-[#171a23]">
              Что внутри урока
            </h2>
            <ul className="mt-4 space-y-3">
              {[
                "Видео-объяснение темы",
                "Словарь и иероглифические карточки",
                "Упражнения на закрепление",
                "Домашнее задание с автопроверкой"
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[1rem] text-[#171a23]">
                  <CheckCircle2 className="h-4 w-4 text-[#7aa54f]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="ek-surface bg-[#ebebeb] px-6 py-6">
            <h2 className="text-[1.5rem] leading-none font-semibold tracking-[-0.03em] text-[#171a23]">
              Быстрые действия
            </h2>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#12151d] px-4 py-3 text-sm font-medium text-white hover:bg-[#20242f]"
              >
                <BookCheck className="h-4 w-4" />
                Открыть урок
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-black/12 bg-white px-4 py-3 text-sm font-medium text-[#171a23] hover:bg-black/[0.03]"
              >
                Добавить в расписание
              </button>
              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-black/60">
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Рекомендуемое время: 45 минут
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
