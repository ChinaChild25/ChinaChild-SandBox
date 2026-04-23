"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { submitMyTeacherReview } from "@/lib/teacher-review-storage"
import { useUiLocale } from "@/lib/ui-locale"
import { cn } from "@/lib/utils"

export function TeacherReviewFormBlock({
  teacherSlug,
  userId,
  userName,
  onSuccess
}: {
  teacherSlug: string
  userId: string
  userName: string
  onSuccess?: () => void
}) {
  const { t } = useUiLocale()
  const [stars, setStars] = useState(5)
  const [text, setText] = useState("")
  const [hint, setHint] = useState<string | null>(null)

  return (
    <div className="mt-6 rounded-[var(--ds-radius-lg)] bg-[var(--ds-neutral-row)] p-5 dark:bg-[var(--ds-neutral-row)]">
      <h3 className="text-[16px] font-semibold text-ds-ink dark:text-white">{t("mentor.reviewFormTitle")}</h3>
      <p className="mt-1 text-[12px] text-ds-text-tertiary">{t("mentor.reviewFormNote")}</p>

      <div className="mt-4">
        <span className="text-[13px] font-medium text-ds-text-secondary">{t("mentor.reviewRatingLabel")}</span>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              className="rounded-md p-1 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/10"
              aria-label={String(n)}
            >
              <Star
                className={cn(
                  "h-7 w-7",
                  n <= stars ? "fill-amber-400 stroke-amber-500" : "stroke-neutral-300 dark:stroke-neutral-600"
                )}
                strokeWidth={n <= stars ? 0 : 1.5}
              />
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">{t("mentor.reviewPlaceholder")}</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setHint(null)
          }}
          rows={4}
          className="mt-2 w-full resize-y rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-white px-4 py-3 text-[15px] text-ds-ink outline-none transition-shadow focus:shadow-[0_0_0_2px_var(--ds-ink)] dark:border-white/12 dark:bg-[#1a1a1a] dark:text-white dark:focus:shadow-[0_0_0_2px_#e8e8e8]"
          placeholder={t("mentor.reviewPlaceholder")}
        />
      </label>

      {hint ? <p className="mt-2 text-[13px] text-red-600 dark:text-red-400">{hint}</p> : null}

      <button
        type="button"
        onClick={() => {
          const res = submitMyTeacherReview(userId, teacherSlug, {
            stars,
            text,
            author: userName
          })
          if (!res.ok) {
            if (res.reason === "already") {
              setHint(t("mentor.reviewOnce"))
            } else {
              setHint(t("mentor.reviewMinHint"))
            }
            return
          }
          onSuccess?.()
        }}
        className="mt-4 h-11 w-full rounded-[var(--ds-radius-md)] bg-ds-ink text-[15px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
      >
        {t("mentor.reviewSubmit")}
      </button>
    </div>
  )
}
