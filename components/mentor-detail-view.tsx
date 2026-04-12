"use client"

import { Fragment, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Headphones,
  MessageCircle,
  Star,
  Users
} from "lucide-react"
import { TeacherReviewFormBlock } from "@/components/teacher-review-form"
import { TelegramIcon, telegramProfileUrl } from "@/components/telegram-icon"
import { useAuth } from "@/lib/auth-context"
import type { MentorProfile } from "@/lib/mentors"
import { getMyReviewForTeacher } from "@/lib/teacher-review-storage"
import { useUiLocale } from "@/lib/ui-locale"
import { cn } from "@/lib/utils"

const mentorShell = "rounded-[28px] p-5 md:p-8"
const mentorCardRadius = "rounded-[24px]"
const actionRadius = "rounded-[var(--ds-radius-md)]"

function ReviewStars({ count, ariaLabel }: { count: number; ariaLabel: string }) {
  return (
    <div className="flex shrink-0 gap-0.5 text-amber-400" aria-label={ariaLabel}>
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

function SharedHero({
  mentor,
  t,
  scheduleHref,
  scheduleLabel
}: {
  mentor: MentorProfile
  t: (k: string, p?: Record<string, string>) => string
  scheduleHref: string
  scheduleLabel: string
}) {
  const stats = [
    { value: mentor.stats.rating, label: t("mentor.rating"), key: "rating" },
    { value: String(mentor.stats.students), label: t("mentor.students"), key: "students" },
    { value: String(mentor.stats.lessons), label: t("mentor.lessons"), key: "lessons" },
    {
      value: t("mentor.yearsExp", { n: String(mentor.stats.yearsExperience) }),
      label: t("mentor.experience"),
      key: "exp"
    }
  ]

  return (
    <header className="ds-mentor-hero">
      <div className="ds-mentor-hero__photo-wrap">
        <Image src={mentor.photo} alt={mentor.name} fill className="object-cover" sizes="176px" unoptimized />
      </div>

      <div className="min-w-0 flex-1 text-center md:text-left">
        <h1 className="text-[clamp(1.625rem,4vw,2.25rem)] font-bold leading-none tracking-[-0.03em] text-ds-ink">
          {mentor.name}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[#666666] dark:text-ds-text-secondary">{mentor.titleLine}</p>

        {/* мобильная сетка; на md+ — один ряд с вертикальными разделителями */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-6 md:hidden">
          {stats.map((s) => (
            <div key={s.key} className="flex flex-col items-center">
              <div className="text-[22px] font-bold leading-none text-ds-ink">{s.value}</div>
              <div className="ds-mentor-hero__stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="ds-mentor-hero__stats-row">
          {stats.map((s, i) => (
            <Fragment key={s.key}>
              {i > 0 ? <span className="ds-mentor-hero__stat-divider" aria-hidden /> : null}
              <div className="ds-mentor-hero__stat-cell">
                <div className="ds-mentor-hero__stat-value">{s.value}</div>
                <div className="ds-mentor-hero__stat-label">{s.label}</div>
              </div>
            </Fragment>
          ))}
        </div>

        <div className="ds-mentor-hero__actions">
          <Link
            href={`/messages?mentor=${mentor.slug}`}
            className={cn(
              "inline-flex h-12 min-w-[8.5rem] items-center justify-center gap-2 bg-ds-ink px-5 text-[15px] font-semibold text-white no-underline transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a]",
              actionRadius
            )}
          >
            <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
            {t("mentor.writeShort")}
          </Link>
          <a
            href={telegramProfileUrl(mentor.telegramUsername)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-12 w-12 shrink-0 items-center justify-center bg-[#2AABEE] text-white no-underline shadow-none transition-opacity hover:opacity-90",
              actionRadius
            )}
            aria-label={t("mentor.telegramAria", { username: mentor.telegramUsername })}
          >
            <TelegramIcon className="h-6 w-6 text-white" />
          </a>
          <Link
            href={scheduleHref}
            className={cn(
              "inline-flex h-12 min-w-[8.5rem] items-center justify-center gap-2 bg-[#f2f2f2] px-5 text-[15px] font-semibold text-ds-ink no-underline transition-colors hover:bg-[#e8e8e8] dark:bg-ds-surface-pill dark:text-ds-ink dark:hover:bg-white/10",
              actionRadius
            )}
          >
            <CalendarDays className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
            {scheduleLabel}
          </Link>
        </div>
      </div>
    </header>
  )
}

function CuratorPageBody({ mentor, t }: { mentor: MentorProfile; t: (k: string, p?: Record<string, string>) => string }) {
  const intro = mentor.curatorIntro ?? mentor.about
  const focus = mentor.curatorFocus ?? []

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="space-y-6 lg:col-span-7">
        <section
          className={cn(
            mentorCardRadius,
            "bg-gradient-to-br from-[#e8ecff] to-[#eef1ff] p-6 dark:from-[#1a1f33] dark:to-[#141824] md:p-8"
          )}
        >
          <div className="mb-3 flex items-center gap-2 text-[18px] font-semibold text-indigo-950 dark:text-indigo-100">
            <Headphones className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            {t("mentor.curatorIntroTitle")}
          </div>
          <p className="text-[15px] leading-[1.65] text-[#2f2f4a] dark:text-indigo-50/90">{intro}</p>
        </section>

        {focus.length > 0 ? (
          <section
            className={cn(
              mentorCardRadius,
              "bg-[#e8e8ec] p-6 dark:bg-[#1a1a1f] md:p-8"
            )}
          >
            <h2 className="text-[18px] font-semibold text-ds-ink dark:text-white">{t("mentor.curatorHelpTitle")}</h2>
            <ul className="mt-5 space-y-3 p-0 list-none">
              {focus.map((line) => (
                <li key={line} className="flex gap-3 text-[15px] leading-snug text-[#3d3d3d] dark:text-ds-text-secondary">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          className={cn(
            mentorCardRadius,
            "bg-[#e4e6ef] p-6 dark:bg-[#16161c] md:p-8"
          )}
        >
          <h2 className="text-[16px] font-semibold text-ds-ink dark:text-white">{t("mentor.curatorCredentialsTitle")}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#555] dark:text-ds-text-secondary">{mentor.education}</p>
        </section>
      </div>

      <div className="space-y-6 lg:col-span-5">
        <section
          className={cn(
            mentorCardRadius,
            "bg-indigo-100/90 p-6 dark:bg-indigo-950/35 md:p-7"
          )}
        >
          <h2 className="text-[17px] font-semibold text-indigo-950 dark:text-indigo-100">{t("mentor.curatorContactTitle")}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#3f3f5c] dark:text-indigo-100/80">
            {t("mentor.curatorContactBody")}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={`/messages?mentor=${mentor.slug}`}
              className={cn(
                "inline-flex h-12 min-w-[8.5rem] items-center justify-center gap-2 bg-ds-ink px-5 text-[15px] font-semibold text-white no-underline transition-opacity hover:opacity-90 dark:bg-white dark:text-[#1a1a1a]",
                actionRadius
              )}
            >
              <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              {t("mentor.writeShort")}
            </Link>
            <a
              href={telegramProfileUrl(mentor.telegramUsername)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex h-12 w-12 shrink-0 items-center justify-center bg-[#2AABEE] text-white no-underline transition-opacity hover:opacity-90",
                actionRadius
              )}
              aria-label={t("mentor.telegramAria", { username: mentor.telegramUsername })}
            >
              <TelegramIcon className="h-6 w-6 text-white" />
            </a>
          </div>
        </section>

        <section
          className={cn(
            mentorCardRadius,
            "bg-[#e8e8ec] p-6 dark:bg-[#1e1e24] md:p-7"
          )}
        >
          <div className="mb-4 flex items-center gap-2 text-[17px] font-semibold text-ds-ink dark:text-white">
            <CalendarDays className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
            {t("mentor.curatorAvailabilityTitle")}
          </div>
          <ul className="flex flex-col gap-2 p-0 list-none">
            {mentor.scheduleSlots.map((row) => (
              <li
                key={`${row.day}-${row.time}`}
                className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-md)] bg-indigo-50/80 px-4 py-3.5 dark:bg-white/[0.06]"
              >
                <span className="text-[15px] font-medium text-ds-ink dark:text-white">{row.day}</span>
                <span className="text-[15px] tabular-nums text-ds-text-secondary">{row.time}</span>
              </li>
            ))}
          </ul>
        </section>

        {mentor.group ? (
          <section
            className={cn(
              mentorCardRadius,
              "bg-[#fce8ec] p-6 dark:bg-[#2d2426] md:p-7"
            )}
          >
            <div className="mb-4 flex items-center gap-2 text-[17px] font-semibold text-ds-ink dark:text-white">
              <Users className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              {t("mentor.yourGroup")}
            </div>
            <p className="text-[15px] font-semibold text-ds-ink dark:text-white">{mentor.group.name}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#5c5c5c] dark:text-white/75">{mentor.group.description}</p>
            <Link
              href={mentor.group.ctaHref}
              className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-ds-sage-strong no-underline transition-opacity hover:opacity-80 dark:text-ds-sage-hover"
            >
              {t("mentor.goToClasses")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function TeacherPageBody({ mentor, t }: { mentor: MentorProfile; t: (k: string, p?: Record<string, string>) => string }) {
  const { user } = useAuth()
  const [reviewTick, setReviewTick] = useState(0)
  const myReview = useMemo(
    () => (user ? getMyReviewForTeacher(user.id, mentor.slug) : null),
    [user, mentor.slug, reviewTick]
  )

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="space-y-6 lg:col-span-7">
        <section className={cn(mentorCardRadius, "bg-[#e2f0d9] p-6 dark:bg-[#2d3d28] md:p-8")}>
          <h2 className="text-[18px] font-semibold text-ds-ink dark:text-white">{t("mentor.about")}</h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-[#3d3d3d] dark:text-white/85">{mentor.about}</p>
        </section>

        <section className={cn(mentorCardRadius, "bg-[#f5f5f5] p-6 dark:bg-[#1e1e1e] md:p-8")}>
          <h2 className="text-[18px] font-semibold text-ds-ink dark:text-white">{t("mentor.education")}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#555] dark:text-ds-text-secondary">{mentor.education}</p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold text-ds-ink dark:text-white">{t("mentor.reviews")}</h2>
          <ul className="mt-5 space-y-4 p-0 list-none">
            {myReview ? (
              <li
                key="__student_review"
                className={cn(
                  mentorCardRadius,
                  "border-2 border-ds-sage/35 bg-ds-sage/15 p-5 dark:border-ds-sage/25 dark:bg-ds-sage/10"
                )}
              >
                <div className="mb-2">
                  <span className="inline-flex rounded-full bg-ds-sage-strong/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ds-sage-hover dark:text-ds-sage-hover">
                    {t("mentor.yourReviewBadge")}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-semibold text-ds-ink dark:text-white">{myReview.author}</span>
                  <ReviewStars count={myReview.stars} ariaLabel={t("mentor.reviewAria", { n: String(myReview.stars) })} />
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#555] dark:text-ds-text-secondary">{myReview.text}</p>
              </li>
            ) : null}
            {mentor.reviews.map((r) => (
              <li key={r.author} className={cn(mentorCardRadius, "bg-[#f5f5f5] p-5 dark:bg-[#1e1e1e]")}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-semibold text-ds-ink dark:text-white">{r.author}</span>
                  <ReviewStars count={r.stars} ariaLabel={t("mentor.reviewAria", { n: String(r.stars) })} />
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#555] dark:text-ds-text-secondary">{r.text}</p>
              </li>
            ))}
          </ul>

          {user && !myReview ? (
            <TeacherReviewFormBlock
              teacherSlug={mentor.slug}
              userId={user.id}
              userName={user.name}
              onSuccess={() => setReviewTick((n) => n + 1)}
            />
          ) : null}
        </section>
      </div>

      <div className="space-y-6 lg:col-span-5">
        <section className="ds-mentor-subjects-card">
          <div className="ds-mentor-subjects-card__head">
            <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
            {t("mentor.subjects")}
          </div>
          <div className="ds-mentor-subjects-pills">
            {mentor.subjects.map((tag) => (
              <span key={tag} className="ds-mentor-subjects-pill">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className={cn(mentorCardRadius, "bg-[#f5f5f5] p-6 dark:bg-[#1e1e1e] md:p-7")}>
          <h2 className="text-[17px] font-semibold text-ds-ink dark:text-white">{t("mentor.languagesTeaching")}</h2>
          <ul className="mt-4 space-y-2 pl-5 text-[15px] text-[#555] dark:text-ds-text-secondary [list-style-type:disc]">
            {mentor.languages.map((lang) => (
              <li key={lang}>{lang}</li>
            ))}
          </ul>
        </section>

        <section className={cn("overflow-hidden", mentorCardRadius, "bg-[#1a1a1a] p-6 text-white md:p-7 dark:bg-[#0a0a0a]")}>
          <div className="mb-5 flex items-center gap-2 text-[17px] font-semibold">
            <CalendarDays className="h-5 w-5 shrink-0 text-white/90" aria-hidden />
            {t("mentor.scheduleTitle")}
          </div>
          <ul className="flex flex-col gap-2 p-0 list-none">
            {mentor.scheduleSlots.map((row) => (
              <li
                key={`${row.day}-${row.time}`}
                className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-md)] bg-[#2c2c2c] px-4 py-3.5 dark:bg-white/[0.08]"
              >
                <span className="text-[15px] font-medium text-white/95">{row.day}</span>
                <span className="text-[15px] tabular-nums text-white/75">{row.time}</span>
              </li>
            ))}
          </ul>
        </section>

        {mentor.group ? (
          <section
            className={cn(
              mentorCardRadius,
              "bg-[#fce8ec] p-6 dark:bg-[#2d2426] md:p-7"
            )}
          >
            <div className="mb-4 flex items-center gap-2 text-[17px] font-semibold text-ds-ink dark:text-white">
              <Users className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              {t("mentor.yourGroup")}
            </div>
            <p className="text-[15px] font-semibold text-ds-ink dark:text-white">{mentor.group.name}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#5c5c5c] dark:text-white/75">{mentor.group.description}</p>
            <Link
              href={mentor.group.ctaHref}
              className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-ds-sage-strong no-underline transition-opacity hover:opacity-80 dark:text-ds-sage-hover"
            >
              {t("mentor.goToClasses")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export function MentorDetailView({ mentor }: { mentor: MentorProfile }) {
  const { t } = useUiLocale()
  const isCurator = mentor.staffKind === "curator"

  return (
    <div className="ds-figma-page">
      <div className={mentorShell}>
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1 text-[14px] font-medium text-[#999999] no-underline transition-colors hover:text-ds-ink dark:text-ds-text-tertiary dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {t("mentor.back")}
        </Link>

        <SharedHero
          mentor={mentor}
          t={t}
          scheduleHref="/schedule"
          scheduleLabel={isCurator ? t("mentor.curatorScheduleCta") : t("mentor.schedule")}
        />

        {isCurator ? <CuratorPageBody mentor={mentor} t={t} /> : <TeacherPageBody mentor={mentor} t={t} />}
      </div>
    </div>
  )
}
