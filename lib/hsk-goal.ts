/** Цель HSK в школе: 1–5, profiles.hsk_goal. */

export const HSK_GOAL_MIN = 1
export const HSK_GOAL_MAX = 5

export function hskGoalRange(): number[] {
  return Array.from({ length: HSK_GOAL_MAX - HSK_GOAL_MIN + 1 }, (_, i) => HSK_GOAL_MIN + i)
}

export function formatHskGoalShort(goal: number | null | undefined): string {
  if (goal === null || goal === undefined || Number.isNaN(goal)) return "—"
  return `HSK ${goal}`
}
