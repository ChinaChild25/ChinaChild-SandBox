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
    <Card>
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
        <CardDescription>
          Track your milestones and celebrate your progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="flex items-center gap-6 mb-6 p-4 rounded-lg bg-primary/5">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {unlockedAchievements.length}/{mockAchievements.length}
            </p>
            <p className="text-sm text-muted-foreground">
              Achievements Unlocked
            </p>
          </div>
        </div>

        {/* Unlocked Achievements */}
        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Unlocked
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedAchievements.map((achievement) => {
              const Icon = iconMap[achievement.icon] || Trophy

              return (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Icon className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{achievement.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {achievement.description}
                    </p>
                    {achievement.unlockedAt && (
                      <p className="text-xs text-primary mt-0.5">
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
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              In Progress
            </h3>
            <div className="space-y-3">
              {inProgressAchievements.map((achievement) => {
                const Icon = iconMap[achievement.icon] || Trophy

                return (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border"
                  >
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 relative">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Lock className="h-3 w-3 text-primary" />
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
                            className="h-1.5"
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
