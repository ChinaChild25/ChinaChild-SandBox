import { getAppEnvironmentLabel, isSandboxEnvironment } from "@/lib/app-environment"

export function AppEnvironmentBadge() {
  if (!isSandboxEnvironment()) return null

  const label = getAppEnvironmentLabel() || "Песочница"

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[90] sm:right-4 sm:top-4">
      <div className="rounded-full border border-amber-300/80 bg-amber-100/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-950 shadow-sm backdrop-blur dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
        {label}
      </div>
    </div>
  )
}
