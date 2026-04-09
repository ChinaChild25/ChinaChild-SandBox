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
  const { user, updateUser } = useAuth()
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
    
    updateUser({ name: formData.name, email: formData.email })
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
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal details and learning preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {getInitials(formData.name || "U")}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold">{formData.name || "Your Name"}</h3>
              <p className="text-sm text-muted-foreground">{formData.email}</p>
              <p className="text-sm text-primary mt-1">
                {user?.level} Level Student
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us a bit about yourself and why you're learning Chinese..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="goal">Learning Goal</Label>
              <Select
                value={formData.learningGoal}
                onValueChange={(value) =>
                  setFormData({ ...formData, learningGoal: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="goal">
                  <SelectValue placeholder="Select your goal" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="hours">Weekly Study Hours</Label>
              <Select
                value={formData.studyHoursPerWeek}
                onValueChange={(value) =>
                  setFormData({ ...formData, studyHoursPerWeek: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="hours">
                  <SelectValue placeholder="Select study hours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-5">1-5 hours</SelectItem>
                  <SelectItem value="5-10">5-10 hours</SelectItem>
                  <SelectItem value="10-15">10-15 hours</SelectItem>
                  <SelectItem value="15+">15+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isLoading}>
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
              <span className="text-sm text-green-600">
                Changes saved successfully!
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
