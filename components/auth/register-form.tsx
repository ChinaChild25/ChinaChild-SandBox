"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter()
  const { register, isLoading } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState("")

  const passwordRequirements = [
    { label: "At least 6 characters", met: password.length >= 6 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!passwordRequirements.every((req) => req.met)) {
      setError("Please meet all password requirements")
      return
    }

    if (!acceptTerms) {
      setError("Please accept the terms and conditions")
      return
    }

    const success = await register(name, email, password)
    if (success) {
      router.push("/dashboard")
    } else {
      setError("Registration failed. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          className="h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-foreground/20"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-email" className="text-sm font-medium">Email</Label>
        <Input
          id="reg-email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-foreground/20"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password" className="text-sm font-medium">Password</Label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="h-12 rounded-xl bg-muted/50 border-0 pr-12 focus-visible:ring-1 focus-visible:ring-foreground/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {password && (
          <div className="space-y-1.5 mt-3 p-3 rounded-xl bg-muted/30">
            {passwordRequirements.map((req, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-xs ${
                  req.met ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {req.met ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {req.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          className="h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-foreground/20"
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="text-xs text-destructive flex items-center gap-1.5 mt-2">
            <X className="h-3.5 w-3.5" />
            Passwords do not match
          </p>
        )}
      </div>

      <div className="flex items-start space-x-2 pt-2">
        <Checkbox
          id="terms"
          checked={acceptTerms}
          onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
          className="mt-0.5 rounded-md"
        />
        <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-snug text-muted-foreground">
          I agree to the{" "}
          <a href="#" className="text-foreground hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-foreground hover:underline">
            Privacy Policy
          </a>
        </Label>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
          {error}
        </p>
      )}

      <Button 
        type="submit" 
        className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium mt-2" 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground pt-2">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-foreground hover:underline font-medium"
        >
          Sign in
        </button>
      </p>
    </form>
  )
}
