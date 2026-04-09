"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Headphones, PenTool, MessageSquare } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { useAuth } from "@/lib/auth-context"

const features = [
  {
    icon: BookOpen,
    title: "Structured Learning",
    description: "HSK-aligned curriculum from beginner to advanced"
  },
  {
    icon: Headphones,
    title: "Audio Training",
    description: "Native speaker recordings and pronunciation practice"
  },
  {
    icon: PenTool,
    title: "Character Writing",
    description: "Interactive stroke order and handwriting exercises"
  },
  {
    icon: MessageSquare,
    title: "Speaking Practice",
    description: "AI-powered conversation and feedback system"
  }
]

export default function AuthPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [isLogin, setIsLogin] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Branding */}
      <div className="relative flex-1 p-8 lg:p-12 xl:p-16 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background text-lg font-semibold">
            L
          </div>
          <span className="text-xl font-semibold tracking-tight">Lingua</span>
        </div>

        {/* Hero content */}
        <div className="flex-1 flex flex-col justify-center max-w-xl py-12 lg:py-16">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Chinese Language Platform
          </p>
          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-semibold leading-[1.1] tracking-tight text-balance">
            Learn Chinese the modern way
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-md">
            A structured approach to mastering Mandarin. From vocabulary to conversation, 
            build your skills with proven learning methods.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mt-12">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-2xl bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background border border-border">
                  <feature.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden lg:flex items-center gap-12 pt-6 border-t border-border">
          <div>
            <p className="text-3xl font-semibold">50K+</p>
            <p className="text-sm text-muted-foreground mt-1">Active learners</p>
          </div>
          <div>
            <p className="text-3xl font-semibold">200+</p>
            <p className="text-sm text-muted-foreground mt-1">Lessons available</p>
          </div>
          <div>
            <p className="text-3xl font-semibold">4.9</p>
            <p className="text-sm text-muted-foreground mt-1">User rating</p>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-muted/30">
        <div className="w-full max-w-[420px]">
          <Card className="border-0 shadow-2xl shadow-black/5 bg-card">
            <CardHeader className="text-center pb-2 pt-8">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {isLogin ? "Welcome back" : "Create account"}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {isLogin
                  ? "Sign in to continue learning"
                  : "Start your learning journey"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 pb-8 px-8">
              {isLogin ? (
                <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
              )}
            </CardContent>
          </Card>

          {/* Mobile Stats */}
          <div className="flex lg:hidden items-center justify-center gap-8 mt-8 text-center">
            <div>
              <p className="text-xl font-semibold">50K+</p>
              <p className="text-xs text-muted-foreground">Learners</p>
            </div>
            <div>
              <p className="text-xl font-semibold">200+</p>
              <p className="text-xs text-muted-foreground">Lessons</p>
            </div>
            <div>
              <p className="text-xl font-semibold">4.9</p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
