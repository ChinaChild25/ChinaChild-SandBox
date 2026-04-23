/** Лёгкие «зарисовки» между блоками урока (настроение в духе практикумовских иллюстраций). */

type WhimsyKind = "spark" | "sound" | "memo" | "speech" | "star" | "pencil"

const STROKE = 2.4

export function LessonWhimsy({ kind }: { kind: WhimsyKind }) {
  const common = {
    viewBox: "0 0 120 72",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: "cc-lesson-whimsy-svg",
    "aria-hidden": true as const
  }

  switch (kind) {
    case "spark":
      return (
        <svg {...common}>
          <path
            d="M58 8c2 12 8 18 20 22M42 28c10-4 18-2 24 8M28 48c14-6 28-4 40 6"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.35}
          />
          <circle cx="88" cy="14" r="5" stroke="currentColor" strokeWidth={STROKE} opacity={0.45} />
          <path d="M14 52l8-6-3 10 10-4-6 10" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" opacity={0.4} />
        </svg>
      )
    case "sound":
      return (
        <svg {...common}>
          <path
            d="M38 22h-8v28h8l22 14V8L38 22z"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinejoin="round"
            opacity={0.4}
          />
          <path
            d="M86 26c6 6 6 16 0 22M94 18c10 10 10 28 0 38"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            opacity={0.35}
          />
        </svg>
      )
    case "memo":
      return (
        <svg {...common}>
          <rect x="28" y="10" width="52" height="52" rx="10" stroke="currentColor" strokeWidth={STROKE} opacity={0.38} />
          <path d="M40 28h40M40 38h28M40 48h34" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" opacity={0.32} />
          <circle cx="88" cy="20" r="6" stroke="currentColor" strokeWidth={STROKE} opacity={0.4} />
        </svg>
      )
    case "speech":
      return (
        <svg {...common}>
          <path
            d="M24 18h64c6 0 10 4 10 10v18c0 6-4 10-10 10H52l-14 12v-12H24c-6 0-10-4-10-10V28c0-6 4-10 10-10z"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinejoin="round"
            opacity={0.38}
          />
          <circle cx="44" cy="36" r="3" fill="currentColor" opacity={0.35} />
          <circle cx="60" cy="36" r="3" fill="currentColor" opacity={0.35} />
          <circle cx="76" cy="36" r="3" fill="currentColor" opacity={0.35} />
        </svg>
      )
    case "star":
      return (
        <svg {...common}>
          <path
            d="M60 12l6 18 18 2-14 12 5 18-15-9-15 9 5-18-14-12 18-2 6-18z"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinejoin="round"
            opacity={0.36}
          />
          <path d="M12 50c8-4 16-3 22 4" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" opacity={0.3} />
        </svg>
      )
    case "pencil":
      return (
        <svg {...common}>
          <path
            d="M78 10l22 22-36 36H42V62l36-36z"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinejoin="round"
            opacity={0.38}
          />
          <path d="M20 58c10 2 18 8 24 18" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" opacity={0.32} />
        </svg>
      )
    default:
      return null
  }
}
