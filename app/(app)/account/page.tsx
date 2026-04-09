"use client"

import { useState } from "react"
import { User, BookOpen, Trophy, FolderOpen, Settings } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { ProfileForm } from "@/components/account/profile-form"
import { EnrolledCourses } from "@/components/account/enrolled-courses"
import { LearningResources } from "@/components/account/learning-resources"
import { AchievementsSection } from "@/components/account/achievements-section"

export default function AccountPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("profile")

  const memberSince = user?.joinDate
    ? new Date(user.joinDate).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
      })
    : "N/A"

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Account Settings
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            My Account
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile, courses, and learning preferences
          </p>
        </div>
        <Card className="md:w-auto border-0 bg-muted/30 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-foreground text-background flex items-center justify-center text-lg font-semibold">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded-md bg-background border border-border">
                  {user?.level}
                </span>
                <span className="text-muted-foreground">
                  Since {memberSince}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-semibold">
              {user?.learningStreak || 0}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Day Streak</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-semibold">
              {user?.totalLessonsCompleted || 0}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Lessons Done</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-semibold">
              {user?.totalStudyHours || 0}h
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Study Time</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-semibold">5</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Achievements</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto p-1 bg-muted/50 rounded-xl grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-grid gap-1">
          <TabsTrigger value="profile" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Courses</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Resources</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Achievements</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileForm />
          
          {/* Account Settings */}
          <Card className="border-0 bg-muted/30 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Manage your account preferences and security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                <div>
                  <p className="font-medium text-sm">Email Notifications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Receive lesson reminders and updates
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-foreground text-background">
                  Enabled
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                <div>
                  <p className="font-medium text-sm">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add an extra layer of security
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                  Disabled
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                <div>
                  <p className="font-medium text-sm">Language Preference</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Interface and content language
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-muted text-foreground">
                  English
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <EnrolledCourses />
        </TabsContent>

        <TabsContent value="resources">
          <LearningResources />
        </TabsContent>

        <TabsContent value="achievements">
          <AchievementsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
