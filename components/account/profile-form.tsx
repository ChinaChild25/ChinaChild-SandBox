"use client"

import { useState } from "react"
import { Loader2, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"

export function ProfileForm() {
  const { user, updateUser, usesSupabase } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    bio: "",
    learningGoal: "conversational",
    studyHoursPerWeek: "5-10"
  })
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSaved(false)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    updateUser(usesSupabase ? { name: formData.name } : { name: formData.name, email: formData.email })
    setIsLoading(false)
    setSaved(true)
    
    setTimeout(() => setSaved(false), 3000)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Profile Information</CardTitle>
        <CardDescription>
          Update your personal details and learning preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20 rounded-2xl">
                <AvatarFallback className="bg-foreground text-background text-xl font-semibold rounded-2xl">
                  {getInitials(formData.name || "U")}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-xl bg-background border border-border text-foreground flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold">{formData.name || "Your Name"}</h3>
              <p className="text-sm text-muted-foreground">{formData.email}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
                {user?.level} Level
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={isLoading}
                className="h-11 rounded-xl bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={isLoading}
                className="h-11 rounded-xl bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us a bit about yourself and why you're learning Chinese..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              disabled={isLoading}
              rows={3}
              className="rounded-xl bg-background border-border resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal" className="text-sm font-medium">Learning Goal</Label>
              <Select
                value={formData.learningGoal}
                onValueChange={(value) =>
                  setFormData({ ...formData, learningGoal: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="goal" className="h-11 rounded-xl bg-background border-border">
                  <SelectValue placeholder="Select your goal" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="conversational">
                    Conversational fluency
                  </SelectItem>
                  <SelectItem value="business">Business Chinese</SelectItem>
                  <SelectItem value="hsk">HSK Certification</SelectItem>
                  <SelectItem value="travel">Travel & Culture</SelectItem>
                  <SelectItem value="academic">Academic Study</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours" className="text-sm font-medium">Weekly Study Hours</Label>
              <Select
                value={formData.studyHoursPerWeek}
                onValueChange={(value) =>
                  setFormData({ ...formData, studyHoursPerWeek: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="hours" className="h-11 rounded-xl bg-background border-border">
                  <SelectValue placeholder="Select study hours" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1-5">1-5 hours</SelectItem>
                  <SelectItem value="5-10">5-10 hours</SelectItem>
                  <SelectItem value="10-15">10-15 hours</SelectItem>
                  <SelectItem value="15+">15+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="rounded-xl h-11 px-6 bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            {saved && (
              <span className="text-sm text-muted-foreground">
                Changes saved successfully
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
