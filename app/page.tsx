"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Users, Award, Globe } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { useAuth } from "@/lib/auth-context"

const features = [
  {
    icon: BookOpen,
    title: "Comprehensive Curriculum",
    description: "From HSK 1 to HSK 6, covering all proficiency levels"
  },
  {
    icon: Users,
    title: "Expert Native Teachers",
    description: "Learn from certified instructors with years of experience"
  },
  {
    icon: Award,
    title: "Interactive Learning",
    description: "Engaging exercises, quizzes, and real-time practice"
  },
  {
    icon: Globe,
    title: "Cultural Immersion",
    description: "Understand Chinese traditions, customs, and modern life"
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Branding */}
      <div className="relative flex-1 bg-primary p-8 lg:p-12 text-primary-foreground overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl font-bold">
              中
            </div>
            <div>
              <h1 className="text-xl font-bold">HanYu Academy</h1>
              <p className="text-sm text-primary-foreground/80">Learn Chinese Online</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="flex-1 flex flex-col justify-center py-8 lg:py-12">
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold leading-tight text-balance">
              Begin Your Chinese Language Journey Today
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/90 max-w-lg">
              Join thousands of learners mastering Mandarin Chinese through personalized lessons, expert guidance, and immersive cultural experiences.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-lg bg-white/10 backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-primary-foreground/80">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="hidden lg:block border-t border-white/20 pt-6">
            <blockquote className="text-lg italic text-primary-foreground/90">
              {'"HanYu Academy transformed my Chinese learning experience. The teachers are incredible and the curriculum is perfectly structured."'}
            </blockquote>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                SM
              </div>
              <div>
                <p className="font-semibold">Sarah Mitchell</p>
                <p className="text-sm text-primary-foreground/70">HSK 5 Graduate</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">
                {isLogin ? "Welcome back" : "Create your account"}
              </CardTitle>
              <CardDescription>
                {isLogin
                  ? "Sign in to continue your learning journey"
                  : "Start learning Chinese today"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLogin ? (
                <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">50K+</p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">200+</p>
              <p className="text-sm text-muted-foreground">Courses</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">98%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
