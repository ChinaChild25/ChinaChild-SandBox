"use client"

import {
  Footprints,
  Flame,
  PenTool,
  Music,
  Clock,
  Trophy,
  Lock
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { mockAchievements } from "@/lib/mock-data"

const iconMap: Record<string, React.ElementType> = {
  footprints: Footprints,
  flame: Flame,
  "pen-tool": PenTool,
  music: Music,
  clock: Clock,
  trophy: Trophy
}

export function AchievementsSection() {
  const unlockedAchievements = mockAchievements.filter((a) => a.unlockedAt)
  const inProgressAchievements = mockAchievements.filter(
    (a) => !a.unlockedAt && a.progress !== undefined
  )

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Achievements</CardTitle>
        <CardDescription>
          Track your milestones and celebrate your progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="flex items-center gap-6 mb-6 p-4 rounded-xl bg-background border border-border">
          <div className="h-14 w-14 rounded-xl bg-foreground text-background flex items-center justify-center">
            <Trophy className="h-7 w-7" />
          </div>
          <div>
            <p className="text-2xl font-semibold">
              {unlockedAchievements.length}/{mockAchievements.length}
            </p>
            <p className="text-sm text-muted-foreground">
              Achievements Unlocked
            </p>
          </div>
        </div>

        {/* Unlocked Achievements */}
        <div className="space-y-3 mb-6">
          <h3 className="text-[10px] font-semibold text-muted-foreground">
            Unlocked
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedAchievements.map((achievement) => {
              const Icon = iconMap[achievement.icon] || Trophy

              return (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border"
                >
                  <div className="h-11 w-11 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{achievement.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {achievement.description}
                    </p>
                    {achievement.unlockedAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Unlocked{" "}
                        {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* In Progress */}
        {inProgressAchievements.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-muted-foreground">
              In Progress
            </h3>
            <div className="space-y-3">
              {inProgressAchievements.map((achievement) => {
                const Icon = iconMap[achievement.icon] || Trophy

                return (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border"
                  >
                    <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0 relative">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-md bg-background border border-border flex items-center justify-center">
                        <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{achievement.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {achievement.description}
                      </p>
                      {achievement.progress !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">
                              Progress
                            </span>
                            <span className="font-medium">
                              {achievement.progress}%
                            </span>
                          </div>
                          <Progress
                            value={achievement.progress}
                            className="h-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
